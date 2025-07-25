import { logger } from '../utils/logger.js';
import { validatePackageName } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { nugetApi } from '../services/nuget-unified-api.js';
import type {
  GetPackageInfoParams,
  PackageInfoResponse,
  RepositoryInfo,
} from '../types/index.js';

export async function getPackageInfo(params: GetPackageInfoParams): Promise<PackageInfoResponse> {
  const { 
    package_name, 
    include_dependencies = true, 
    include_dev_dependencies = false 
  } = params;

  logger.info(`Fetching package info: ${package_name}`);

  // Validate inputs
  validatePackageName(package_name);

  // Check cache first
  const cacheKey = createCacheKey.packageInfo(package_name, 'latest');
  const cached = cache.get<PackageInfoResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for package info: ${package_name}`);
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
        latest_version: 'unknown',
        description: 'Package not found',
        authors: [],
        license: 'Unknown',
        tags: [],
        dependencies: {},
        dev_dependencies: undefined,
        download_stats: {
          last_day: 0,
          last_week: 0,
          last_month: 0,
        },
        repository: undefined,
        exists: false,
      };
    }
    
    logger.debug(`Package exists: ${package_name}`);

    // Get available versions to find the latest
    const versions = await nugetApi.getPackageVersions(package_name);
    if (versions.length === 0) {
      throw new Error(`No versions found for package ${package_name}`);
    }

    // Get the latest version (last in the array)
    const latestVersion = versions[versions.length - 1];
    
    // Get package metadata for latest version
    const packageMetadata = await nugetApi.getPackageMetadata(package_name, latestVersion);

    // Get download statistics
    const downloadStats = await nugetApi.getAllDownloadStats(package_name);

    // Parse authors
    const authors = packageMetadata.package.metadata.authors 
      ? packageMetadata.package.metadata.authors.split(',').map(author => typeof author === 'string' ? author.trim() : '').filter(author => author.length > 0)
      : [];

    // Parse tags
    const tags = packageMetadata.package.metadata.tags 
      ? packageMetadata.package.metadata.tags.split(' ').filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      : [];

    // Extract repository information from project URL
    let repository: RepositoryInfo | undefined;
    if (packageMetadata.package.metadata.projectUrl && packageMetadata.package.metadata.projectUrl.includes('github.com')) {
      repository = {
        type: 'git',
        url: packageMetadata.package.metadata.projectUrl,
      };
    }

    // Prepare dependencies (NuGet dependencies structure is more complex)
    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> | undefined;

    if (include_dependencies && packageMetadata.package.metadata.dependencies) {
      
      // Handle different dependency group structures
      const depGroups = packageMetadata.package.metadata.dependencies;
      
      if (depGroups.dependency) {
        // Simple dependency array
        for (const dep of depGroups.dependency) {
          const depWithAttrs = dep as any;
          if (depWithAttrs.$ && depWithAttrs.$.id) {
            dependencies[depWithAttrs.$.id] = depWithAttrs.$.version || '*';
          }
        }
      }
      
      if (depGroups.group) {
        // Grouped dependencies by target framework
        for (const group of depGroups.group) {
          const groupWithAttrs = group as any;
          if (groupWithAttrs.dependency) {
            for (const dep of groupWithAttrs.dependency) {
              const depWithAttrs = dep as any;
              if (depWithAttrs.$ && depWithAttrs.$.id) {
                const key = groupWithAttrs.$.targetFramework 
                  ? `${depWithAttrs.$.id} (${groupWithAttrs.$.targetFramework})`
                  : depWithAttrs.$.id;
                dependencies[key] = depWithAttrs.$.version || '*';
              }
            }
          }
        }
      }
      
      // Dependencies object is always present, might be empty
    }

    // NuGet doesn't typically have dev dependencies in the same way as npm
    // Most development dependencies are handled via different means in .NET
    if (include_dev_dependencies) {
      // We could potentially look for dependencies that are marked as developmentDependency
      // but this is not commonly used in NuGet packages
      devDependencies = undefined;
    }

    // Create response
    const response: PackageInfoResponse = {
      package_name,
      latest_version: latestVersion,
      description: packageMetadata.package.metadata.description || 'No description available',
      authors,
      license: packageMetadata.package.metadata.licenseExpression || 'Unknown',
      tags,
      dependencies: dependencies,
      dev_dependencies: devDependencies || undefined,
      download_stats: downloadStats,
      repository: repository || undefined,
      exists: true,
    };

    // Cache the response
    cache.set(cacheKey, response);

    logger.info(`Successfully fetched package info: ${package_name}@${latestVersion}`);
    return response;

  } catch (error) {
    logger.error(`Failed to fetch package info: ${package_name}`, { error });
    throw error;
  }
}