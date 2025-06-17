import { logger } from '../utils/logger.js';
import { validatePackageName, validateVersion } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { nugetApi } from '../services/nuget-api.js';
import { githubApi } from '../services/github-api.js';
import { readmeParser } from '../services/readme-parser.js';
import type {
  GetPackageReadmeParams,
  PackageReadmeResponse,
  InstallationInfo,
  PackageBasicInfo,
  RepositoryInfo,
} from '../types/index.js';

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  const { package_name, version = 'latest', include_examples = true } = params;

  logger.info(`Fetching package README: ${package_name}@${version}`);

  // Validate inputs
  validatePackageName(package_name);
  if (version !== 'latest') {
    validateVersion(version);
  }

  // Check cache first
  const cacheKey = createCacheKey.packageReadme(package_name, version);
  const cached = cache.get<PackageReadmeResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for package README: ${package_name}@${version}`);
    return cached;
  }

  try {
    // First, check if package exists using direct API call
    logger.debug(`Checking package existence: ${package_name}`);
    const packageExists = await nugetApi.checkPackageExists(package_name);
    
    if (!packageExists) {
      logger.warn(`Package not found: ${package_name}`);
      return {
        package_name,
        version: version,
        description: 'Package not found',
        readme_content: '',
        usage_examples: [],
        installation: {
          command: `dotnet add package ${package_name}`,
          alternatives: [
            `Install-Package ${package_name}`,
            `paket add ${package_name}`,
          ],
          dotnet: `dotnet add package ${package_name}`,
          packageManager: `Install-Package ${package_name}`,
          paket: `paket add ${package_name}`,
        },
        basic_info: {
          name: package_name,
          version: version,
          description: 'Package not found',
          license: 'Unknown',
          authors: [],
          tags: [],
        },
        exists: false,
      };
    }
    
    logger.debug(`Package exists: ${package_name}`);

    // Get package metadata from NuGet API
    const packageMetadata = await nugetApi.getPackageMetadata(package_name, version);
    const actualVersion = packageMetadata.package.metadata.version;

    // Try to get README content - prioritize NuGet registry over GitHub
    let readmeContent = '';
    let readmeSource = 'none';
    let repository: RepositoryInfo | undefined;

    // First, try to get README directly from NuGet
    const nugetReadme = await nugetApi.getPackageReadme(package_name, actualVersion);
    if (nugetReadme) {
      readmeContent = nugetReadme;
      readmeSource = 'nuget';
      logger.debug(`Got README from NuGet registry: ${package_name}`);
    }

    // If no README from NuGet, try enhanced metadata for richer description
    if (!readmeContent) {
      const enhancedMetadata = await nugetApi.getEnhancedPackageMetadata(package_name, actualVersion);
      if (enhancedMetadata && enhancedMetadata.catalogEntry) {
        const catalogEntry = enhancedMetadata.catalogEntry;
        if (catalogEntry.description && catalogEntry.description.length > packageMetadata.package.metadata.description?.length) {
          readmeContent = createEnhancedFallbackReadme(packageMetadata, catalogEntry);
          readmeSource = 'nuget-enhanced';
          logger.debug(`Created enhanced README from NuGet metadata: ${package_name}`);
        }
      }
    }

    // Create repository info from project URL for fallback
    if (packageMetadata.package.metadata.projectUrl) {
      const projectUrl = packageMetadata.package.metadata.projectUrl;
      if (projectUrl.includes('github.com')) {
        repository = {
          type: 'git',
          url: projectUrl,
        };

        // Only try GitHub if we don't have good content from NuGet
        if (!readmeContent) {
          const githubReadme = await githubApi.getReadmeFromRepository(repository);
          if (githubReadme) {
            readmeContent = githubReadme;
            readmeSource = 'github';
            logger.debug(`Got README from GitHub: ${package_name}`);
          }
        }
      }
    }

    // If no README found, create a basic description from package metadata
    if (!readmeContent) {
      readmeContent = createFallbackReadme(packageMetadata);
      readmeSource = 'generated';
      logger.debug(`Generated README from package metadata: ${package_name}`);
    }

    // Clean and process README content
    const cleanedReadme = readmeParser.cleanMarkdown(readmeContent);
    
    // Extract usage examples
    const usageExamples = readmeParser.parseUsageExamples(readmeContent, include_examples);

    // Create installation info
    const installation: InstallationInfo = {
      command: `dotnet add package ${package_name}`,
      alternatives: [
        `Install-Package ${package_name}`,
        `paket add ${package_name}`,
      ],
      dotnet: `dotnet add package ${package_name}`,
      packageManager: `Install-Package ${package_name}`,
      paket: `paket add ${package_name}`,
    };

    // Parse tags from the metadata
    const tags = packageMetadata.package.metadata.tags 
      ? packageMetadata.package.metadata.tags.split(' ').filter(tag => tag.trim().length > 0)
      : [];

    // Parse authors
    const authors = packageMetadata.package.metadata.authors 
      ? packageMetadata.package.metadata.authors.split(',').map(author => author.trim())
      : [];

    // Create basic info
    const basicInfo: PackageBasicInfo = {
      name: packageMetadata.package.metadata.id,
      version: actualVersion,
      description: packageMetadata.package.metadata.description || 'No description available',
      title: packageMetadata.package.metadata.title || undefined,
      homepage: packageMetadata.package.metadata.projectUrl || undefined,
      projectUrl: packageMetadata.package.metadata.projectUrl || undefined,
      license: packageMetadata.package.metadata.licenseExpression || 'Unknown',
      licenseUrl: packageMetadata.package.metadata.licenseUrl || undefined,
      authors,
      tags,
    };

    // Create response
    const response: PackageReadmeResponse = {
      package_name,
      version: actualVersion,
      description: basicInfo.description,
      readme_content: cleanedReadme,
      usage_examples: usageExamples,
      installation,
      basic_info: basicInfo,
      repository: repository || undefined,
      exists: true,
    };

    // Cache the response
    cache.set(cacheKey, response);

    logger.info(`Successfully fetched package README: ${package_name}@${actualVersion} (README source: ${readmeSource})`);
    return response;

  } catch (error) {
    logger.error(`Failed to fetch package README: ${package_name}@${version}`, { error });
    throw error;
  }
}

function createEnhancedFallbackReadme(packageMetadata: any, catalogEntry: any): string {
  const metadata = packageMetadata.package.metadata;
  
  let readme = `# ${metadata.title || metadata.id}\n\n`;
  
  // Use enhanced description if available and longer
  const description = catalogEntry.description || metadata.description;
  if (description) {
    readme += `${description}\n\n`;
  }
  
  // Add summary if different from description
  if (catalogEntry.summary && catalogEntry.summary !== description) {
    readme += `## Summary\n\n${catalogEntry.summary}\n\n`;
  }
  
  // Add release notes if available
  if (catalogEntry.releaseNotes) {
    readme += `## Release Notes\n\n${catalogEntry.releaseNotes}\n\n`;
  }
  
  if (metadata.authors) {
    readme += `**Authors:** ${metadata.authors}\n\n`;
  }
  
  if (metadata.tags) {
    const tags = metadata.tags.split(' ').filter((tag: string) => tag.trim().length > 0);
    if (tags.length > 0) {
      readme += `**Tags:** ${tags.join(', ')}\n\n`;
    }
  }
  
  readme += `## Installation\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `dotnet add package ${metadata.id}\n`;
  readme += `\`\`\`\n\n`;
  
  readme += `Or via Package Manager Console:\n\n`;
  readme += `\`\`\`powershell\n`;
  readme += `Install-Package ${metadata.id}\n`;
  readme += `\`\`\`\n\n`;
  
  if (metadata.projectUrl) {
    readme += `For more information, visit the [project page](${metadata.projectUrl}).\n\n`;
  }
  
  return readme;
}

function createFallbackReadme(packageMetadata: any): string {
  const metadata = packageMetadata.package.metadata;
  
  let readme = `# ${metadata.title || metadata.id}\n\n`;
  
  if (metadata.description) {
    readme += `${metadata.description}\n\n`;
  }
  
  if (metadata.authors) {
    readme += `**Authors:** ${metadata.authors}\n\n`;
  }
  
  if (metadata.tags) {
    const tags = metadata.tags.split(' ').filter((tag: string) => tag.trim().length > 0);
    if (tags.length > 0) {
      readme += `**Tags:** ${tags.join(', ')}\n\n`;
    }
  }
  
  readme += `## Installation\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `dotnet add package ${metadata.id}\n`;
  readme += `\`\`\`\n\n`;
  
  readme += `Or via Package Manager Console:\n\n`;
  readme += `\`\`\`powershell\n`;
  readme += `Install-Package ${metadata.id}\n`;
  readme += `\`\`\`\n\n`;
  
  if (metadata.projectUrl) {
    readme += `For more information, visit the [project page](${metadata.projectUrl}).\n\n`;
  }
  
  return readme;
}