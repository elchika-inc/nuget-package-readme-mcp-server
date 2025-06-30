import { logger } from '../utils/logger.js';
import { validatePackageName, validateVersion } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { nugetApi } from '../services/nuget-unified-api.js';
import { githubApi } from '../services/github-api.js';
import { ReadmeParser } from '../services/readme-parser-unified.js';
import { ReadmeGenerator } from '../services/readme-generator.js';
import type {
  GetPackageReadmeParams,
  PackageReadmeResponse,
  InstallationInfo,
  PackageBasicInfo,
  RepositoryInfo,
  NuSpecPackage,
} from '../types/index.js';

interface ReadmeResult {
  content: string;
  source: string;
  repository?: RepositoryInfo;
}

function createNotFoundResponse(packageName: string, version: string): PackageReadmeResponse {
  return {
    package_name: packageName,
    version: version,
    description: 'Package not found',
    readme_content: '',
    usage_examples: [],
    installation: createInstallationInfo(packageName),
    basic_info: {
      name: packageName,
      version: version,
      description: 'Package not found',
      license: 'Unknown',
      authors: [],
      tags: [],
    },
    exists: false,
  };
}

function createInstallationInfo(packageName: string): InstallationInfo {
  return {
    command: `dotnet add package ${packageName}`,
    alternatives: [
      `Install-Package ${packageName}`,
      `paket add ${packageName}`,
    ],
    dotnet: `dotnet add package ${packageName}`,
    packageManager: `Install-Package ${packageName}`,
    paket: `paket add ${packageName}`,
  };
}

async function getReadmeContent(packageName: string, version: string, packageMetadata: NuSpecPackage): Promise<ReadmeResult> {
  let readmeContent = '';
  let readmeSource = 'none';
  let repository: RepositoryInfo | undefined;

  // First, try to get README directly from NuGet
  const nugetReadme = await nugetApi.getPackageReadme(packageName, version);
  if (nugetReadme) {
    readmeContent = nugetReadme;
    readmeSource = 'nuget';
    logger.debug(`Got README from NuGet registry: ${packageName}`);
    return { content: readmeContent, source: readmeSource, repository };
  }

  // Try enhanced metadata for richer description
  const enhancedMetadata = await nugetApi.getEnhancedPackageMetadata(packageName, version);
  if (enhancedMetadata) {
    const description = enhancedMetadata.description || enhancedMetadata.summary;
    if (description && description.length > (packageMetadata.package.metadata.description?.length || 0)) {
      readmeContent = ReadmeGenerator.createEnhancedFallbackReadme(packageMetadata, enhancedMetadata);
      readmeSource = 'nuget-enhanced';
      logger.debug(`Created enhanced README from NuGet metadata: ${packageName}`);
      return { content: readmeContent, source: readmeSource, repository };
    }
  }

  // Try GitHub as fallback
  if (packageMetadata.package.metadata.projectUrl?.includes('github.com')) {
    repository = {
      type: 'git',
      url: packageMetadata.package.metadata.projectUrl,
    };

    const githubReadme = await githubApi.getReadmeFromRepository(repository);
    if (githubReadme) {
      readmeContent = githubReadme;
      readmeSource = 'github';
      logger.debug(`Got README from GitHub: ${packageName}`);
      return { content: readmeContent, source: readmeSource, repository };
    }
  }

  // Generate fallback README
  readmeContent = ReadmeGenerator.createFallbackReadme(packageMetadata);
  readmeSource = 'generated';
  logger.debug(`Generated README from package metadata: ${packageName}`);
  
  return { content: readmeContent, source: readmeSource, repository };
}

function createBasicInfo(packageMetadata: NuSpecPackage, actualVersion: string): PackageBasicInfo {
  const metadata = packageMetadata.package.metadata;
  
  const parsedTags = metadata.tags 
    ? metadata.tags.split(' ').filter(tag => tag.trim().length > 0)
    : [];

  const parsedAuthors = metadata.authors 
    ? metadata.authors.split(',').map(author => author.trim())
    : [];

  return {
    name: metadata.id,
    version: actualVersion,
    description: metadata.description || 'No description available',
    title: metadata.title || undefined,
    homepage: metadata.projectUrl || undefined,
    projectUrl: metadata.projectUrl || undefined,
    license: metadata.licenseExpression || 'Unknown',
    licenseUrl: metadata.licenseUrl || undefined,
    authors: parsedAuthors,
    tags: parsedTags,
  };
}

function buildResponse(
  packageName: string,
  actualVersion: string,
  readmeResult: ReadmeResult,
  packageMetadata: NuSpecPackage,
  includeExamples: boolean
): PackageReadmeResponse {
  const cleanedReadme = ReadmeParser.cleanMarkdown(readmeResult.content);
  const usageExamples = ReadmeParser.parseUsageExamples(readmeResult.content, includeExamples);
  const installation = createInstallationInfo(packageName);
  const basicInfo = createBasicInfo(packageMetadata, actualVersion);

  return {
    package_name: packageName,
    version: actualVersion,
    description: basicInfo.description,
    readme_content: cleanedReadme,
    usage_examples: usageExamples,
    installation,
    basic_info: basicInfo,
    repository: readmeResult.repository || undefined,
    exists: true,
  };
}

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
    // Check if package exists
    logger.debug(`Checking package existence: ${package_name}`);
    const packageExists = await nugetApi.checkPackageExists(package_name);
    
    if (!packageExists) {
      logger.warn(`Package not found: ${package_name}`);
      return createNotFoundResponse(package_name, version);
    }
    
    logger.debug(`Package exists: ${package_name}`);

    // Get package metadata
    const packageMetadata = await nugetApi.getPackageMetadata(package_name, version);
    const actualVersion = packageMetadata.package.metadata.version;

    // Get README content from various sources
    const readmeResult = await getReadmeContent(package_name, actualVersion, packageMetadata);

    // Build and cache response
    const response = buildResponse(package_name, actualVersion, readmeResult, packageMetadata, include_examples);
    
    cache.set(cacheKey, response);

    logger.info(`Successfully fetched package README: ${package_name}@${actualVersion} (README source: ${readmeResult.source})`);
    return response;

  } catch (error) {
    logger.error(`Failed to fetch package README: ${package_name}@${version}`, { error });
    throw error;
  }
}