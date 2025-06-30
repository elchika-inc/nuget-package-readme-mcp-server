import { logger } from '../utils/logger.js';
import { validateSearchQuery, validateLimit, validateScore } from '../utils/validators.js';
import { cache, createCacheKey } from '../services/cache.js';
import { nugetApi } from '../services/nuget-unified-api.js';
import type {
  SearchPackagesParams,
  SearchPackagesResponse,
  PackageSearchResult,
} from '../types/index.js';

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  const { 
    query, 
    limit = 20, 
    quality, 
    popularity 
  } = params;

  logger.info(`Searching packages: "${query}" (limit: ${limit})`);

  // Validate inputs
  validateSearchQuery(query);
  validateLimit(limit);
  
  if (quality !== undefined) {
    validateScore(quality, 'Quality');
  }
  
  if (popularity !== undefined) {
    validateScore(popularity, 'Popularity');
  }

  // Check cache first
  const cacheKey = createCacheKey.searchResults(query, limit, quality, popularity);
  const cached = cache.get<SearchPackagesResponse>(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for search: "${query}"`);
    return cached;
  }

  try {
    // Search packages using NuGet API
    const searchResults = await nugetApi.searchPackages(query, limit);
    
    // Transform results to our format
    const packages: PackageSearchResult[] = searchResults.data.map(pkg => {
      // Extract authors (can be multiple)
      const authors = pkg.authors || [];

      // Map package types
      const packageTypes = pkg.packageTypes.map(pt => pt.name);

      // Create simplified version info
      const versions = pkg.versions.map(v => ({
        version: v.version,
        downloads: v.downloads,
      }));

      return {
        name: pkg.id,
        version: pkg.version,
        description: pkg.description || pkg.summary || 'No description available',
        tags: pkg.tags || [],
        authors,
        totalDownloads: pkg.totalDownloads,
        verified: pkg.verified,
        packageTypes,
        versions,
      };
    });

    // Apply client-side filtering for quality and popularity
    // Since NuGet search API doesn't have explicit quality/popularity filters,
    // we'll approximate using download counts and verification status
    let filteredPackages = packages;
    
    if (quality !== undefined) {
      // Use verification status and package type as quality indicators
      filteredPackages = filteredPackages.filter(pkg => {
        let qualityScore = 0;
        if (pkg.verified) qualityScore += 0.5;
        if (pkg.packageTypes.includes('Dependency')) qualityScore += 0.3;
        if (pkg.authors.length > 0) qualityScore += 0.2;
        return qualityScore >= quality;
      });
    }
    
    if (popularity !== undefined) {
      // Use download counts as popularity indicator
      const maxDownloads = Math.max(...filteredPackages.map(pkg => pkg.totalDownloads), 1);
      filteredPackages = filteredPackages.filter(pkg => {
        const popularityScore = pkg.totalDownloads / maxDownloads;
        return popularityScore >= popularity;
      });
    }

    // Sort by total downloads (most popular first)
    filteredPackages.sort((a, b) => b.totalDownloads - a.totalDownloads);

    // Create response
    const response: SearchPackagesResponse = {
      query,
      total_count: filteredPackages.length,
      packages: filteredPackages,
    };

    // Cache the response (shorter TTL for search results)
    cache.set(cacheKey, response, 600000); // 10 minutes

    logger.info(`Successfully searched packages: "${query}", found ${response.total_count} results`);
    return response;

  } catch (error) {
    logger.error(`Failed to search packages: "${query}"`, { error });
    throw error;
  }
}