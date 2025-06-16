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
    // Get package metadata from NuGet API
    const packageMetadata = await nugetApi.getPackageMetadata(package_name, version);
    const actualVersion = packageMetadata.package.metadata.version;

    // Try to get README content from GitHub repository
    let readmeContent = '';
    let readmeSource = 'none';
    let repository: RepositoryInfo | undefined;

    // Create repository info from project URL
    if (packageMetadata.package.metadata.projectUrl) {
      const projectUrl = packageMetadata.package.metadata.projectUrl;
      if (projectUrl.includes('github.com')) {
        repository = {
          type: 'git',
          url: projectUrl,
        };

        // Try to get README from GitHub
        const githubReadme = await githubApi.getReadmeFromRepository(repository);
        if (githubReadme) {
          readmeContent = githubReadme;
          readmeSource = 'github';
          logger.debug(`Got README from GitHub: ${package_name}`);
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