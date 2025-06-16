import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import type { 
  NuGetSearchResponse, 
  NuGetDownloadStats,
  NuSpecPackage,
} from '../types/index.js';
import {
  VersionNotFoundError,
} from '../types/index.js';

export class NuGetApiClient {
  private readonly registrationBaseUrl = 'https://api.nuget.org/v3-flatcontainer';
  private readonly searchUrl = 'https://azuresearch-usnc.nuget.org/query';
  // private readonly serviceIndexUrl = 'https://api.nuget.org/v3/index.json'; // Currently unused
  private readonly timeout: number;

  constructor(timeout?: number) {
    this.timeout = timeout || 30000;
  }

  async getPackageVersions(packageName: string): Promise<string[]> {
    const url = `${this.registrationBaseUrl}/${packageName.toLowerCase()}/index.json`;
    
    return withRetry(async () => {
      logger.debug(`Fetching package versions: ${packageName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'nuget-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          handleHttpError(response.status, response, `NuGet registry for package ${packageName}`);
        }

        const data = await response.json() as { versions: string[] };
        logger.debug(`Successfully fetched ${data.versions.length} versions for package: ${packageName}`);
        return data.versions;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `NuGet registry for package ${packageName}`);
        }
        handleApiError(error, `NuGet registry for package ${packageName}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `NuGet registry getPackageVersions(${packageName})`);
  }

  async getPackageMetadata(packageName: string, version: string): Promise<NuSpecPackage> {
    // Resolve latest version if needed
    let actualVersion = version;
    if (version === 'latest') {
      const versions = await this.getPackageVersions(packageName);
      if (versions.length === 0) {
        throw new VersionNotFoundError(packageName, version);
      }
      actualVersion = versions[versions.length - 1];
    }

    const url = `${this.registrationBaseUrl}/${packageName.toLowerCase()}/${actualVersion.toLowerCase()}/${packageName.toLowerCase()}.nuspec`;
    
    return withRetry(async () => {
      logger.debug(`Fetching package metadata: ${packageName}@${actualVersion}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/xml',
            'User-Agent': 'nuget-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          handleHttpError(response.status, response, `NuGet metadata for package ${packageName}@${actualVersion}`);
        }

        const xmlText = await response.text();
        const parsed = await this.parseNuSpec(xmlText);
        logger.debug(`Successfully fetched package metadata: ${packageName}@${actualVersion}`);
        return parsed;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `NuGet metadata for package ${packageName}@${actualVersion}`);
        }
        handleApiError(error, `NuGet metadata for package ${packageName}@${actualVersion}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `NuGet registry getPackageMetadata(${packageName}, ${actualVersion})`);
  }

  async searchPackages(
    query: string,
    limit: number = 20
  ): Promise<NuGetSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      take: limit.toString(),
      prerelease: 'false',
    });

    // NuGet search doesn't have explicit quality/popularity filters like npm
    // But we can use semVerLevel parameter for more control
    params.append('semVerLevel', '2.0.0');

    const url = `${this.searchUrl}?${params.toString()}`;

    return withRetry(async () => {
      logger.debug(`Searching packages: ${query} (limit: ${limit})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'nuget-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          handleHttpError(response.status, response, `NuGet search for query ${query}`);
        }

        const data = await response.json() as NuGetSearchResponse;
        logger.debug(`Successfully searched packages: ${query}, found ${data.totalHits} results`);
        return data;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `NuGet search for query ${query}`);
        }
        handleApiError(error, `NuGet search for query ${query}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `NuGet registry searchPackages(${query})`);
  }

  async getDownloadStats(packageName: string): Promise<NuGetDownloadStats> {
    const url = `${this.registrationBaseUrl}/${packageName.toLowerCase()}/index.json`;
    
    return withRetry(async () => {
      logger.debug(`Fetching download stats: ${packageName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'nuget-package-readme-mcp/1.0.0',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Package might not exist, return zero stats
            return {
              totalDownloads: 0,
              data: [],
            };
          }
          handleHttpError(response.status, response, `NuGet downloads for package ${packageName}`);
        }

        const data = await response.json() as { versions: string[] };
        // NuGet flat container doesn't provide download stats directly
        // For now, we'll return mock data - in a real implementation,
        // you might need to use the NuGet Gallery API or other sources
        const mockStats: NuGetDownloadStats = {
          totalDownloads: 0,
          data: data.versions.map(version => ({
            downloads: 0,
            packageVersion: version,
          })),
        };
        
        logger.debug(`Successfully fetched download stats: ${packageName}`);
        return mockStats;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `NuGet downloads for package ${packageName}`);
        }
        handleApiError(error, `NuGet downloads for package ${packageName}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `NuGet registry getDownloadStats(${packageName})`);
  }

  async getAllDownloadStats(packageName: string): Promise<{
    last_day: number;
    last_week: number;
    last_month: number;
  }> {
    try {
      const stats = await this.getDownloadStats(packageName);
      
      // Since NuGet doesn't provide time-based download stats through the flat container API,
      // we'll return the total downloads divided by time periods as a rough approximation
      const total = stats.totalDownloads;
      return {
        last_day: Math.floor(total * 0.001), // Rough approximation
        last_week: Math.floor(total * 0.007), // Rough approximation
        last_month: Math.floor(total * 0.03), // Rough approximation
      };
    } catch (error) {
      logger.warn(`Failed to fetch download stats for ${packageName}, using zeros`, { error });
      return {
        last_day: 0,
        last_week: 0,
        last_month: 0,
      };
    }
  }

  private async parseNuSpec(xmlText: string): Promise<NuSpecPackage> {
    // Simple XML parsing for NuSpec files
    // In a production environment, you might want to use a proper XML parser
    try {
      // Extract basic metadata using regex patterns
      const getId = (xml: string): string => {
        const match = xml.match(/<id>([^<]+)<\/id>/i);
        return match ? match[1].trim() : '';
      };

      const getVersion = (xml: string): string => {
        const match = xml.match(/<version>([^<]+)<\/version>/i);
        return match ? match[1].trim() : '';
      };

      const getDescription = (xml: string): string => {
        const match = xml.match(/<description>([^<]+)<\/description>/i);
        return match ? match[1].trim() : '';
      };

      const getAuthors = (xml: string): string => {
        const match = xml.match(/<authors>([^<]+)<\/authors>/i);
        return match ? match[1].trim() : '';
      };

      const getLicense = (xml: string): string => {
        const licenseMatch = xml.match(/<license[^>]*>([^<]+)<\/license>/i);
        const licenseUrlMatch = xml.match(/<licenseUrl>([^<]+)<\/licenseUrl>/i);
        const licenseExpressionMatch = xml.match(/<licenseExpression>([^<]+)<\/licenseExpression>/i);
        
        return licenseExpressionMatch?.[1] || licenseMatch?.[1] || licenseUrlMatch?.[1] || 'Unknown';
      };

      const getTags = (xml: string): string => {
        const match = xml.match(/<tags>([^<]+)<\/tags>/i);
        return match ? match[1].trim() : '';
      };

      const getProjectUrl = (xml: string): string | undefined => {
        const match = xml.match(/<projectUrl>([^<]+)<\/projectUrl>/i);
        return match ? match[1].trim() : undefined;
      };

      const getTitle = (xml: string): string | undefined => {
        const match = xml.match(/<title>([^<]+)<\/title>/i);
        return match ? match[1].trim() : undefined;
      };

      // Create a simplified NuSpec structure
      const nuspec: NuSpecPackage = {
        package: {
          metadata: {
            id: getId(xmlText),
            version: getVersion(xmlText),
            title: getTitle(xmlText),
            authors: getAuthors(xmlText),
            description: getDescription(xmlText),
            tags: getTags(xmlText),
            projectUrl: getProjectUrl(xmlText),
            licenseExpression: getLicense(xmlText),
          },
        },
      };

      return nuspec;
    } catch (error) {
      logger.error('Failed to parse NuSpec XML', { error });
      throw new Error('Failed to parse package metadata');
    }
  }
}

export const nugetApi = new NuGetApiClient();