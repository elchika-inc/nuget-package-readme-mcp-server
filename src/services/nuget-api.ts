import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import { NuSpecParser } from '../utils/nuspec-parser.js';
import { NUGET_API_CONFIG, DOWNLOAD_STATS_RATIOS } from '../config/constants.js';
import type { 
  NuGetSearchResponse, 
  NuGetDownloadStats,
  NuSpecPackage,
} from '../types/index.js';
import {
  VersionNotFoundError,
} from '../types/index.js';

export class NuGetApiClient {
  private readonly registrationBaseUrl = NUGET_API_CONFIG.ENDPOINTS.FLAT_CONTAINER;
  private readonly registrationApiUrl = NUGET_API_CONFIG.ENDPOINTS.REGISTRATION;
  private readonly searchUrl = NUGET_API_CONFIG.ENDPOINTS.SEARCH;
  private readonly timeout: number;

  constructor(timeout?: number) {
    this.timeout = timeout || NUGET_API_CONFIG.DEFAULT_TIMEOUT;
  }

  async checkPackageExists(packageName: string): Promise<boolean> {
    const url = `${this.registrationBaseUrl}/${packageName.toLowerCase()}/index.json`;
    
    return withRetry(async () => {
      logger.debug(`Checking package existence: ${packageName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
          },
        });

        if (response.status === 404) {
          logger.debug(`Package does not exist: ${packageName}`);
          return false;
        }

        if (!response.ok) {
          handleHttpError(response.status, response, `NuGet registry for package ${packageName}`);
        }

        logger.debug(`Package exists: ${packageName}`);
        return true;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `NuGet registry for package ${packageName}`);
        }
        // If there's a network error, we assume the package doesn't exist
        logger.debug(`Package existence check failed, assuming does not exist: ${packageName}`, { error });
        return false;
      } finally {
        clearTimeout(timeoutId);
      }
    }, NUGET_API_CONFIG.RETRY_ATTEMPTS, NUGET_API_CONFIG.BASE_RETRY_DELAY, `NuGet registry checkPackageExists(${packageName})`);
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
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
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
    }, NUGET_API_CONFIG.RETRY_ATTEMPTS, NUGET_API_CONFIG.BASE_RETRY_DELAY, `NuGet registry getPackageVersions(${packageName})`);
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
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
          },
        });

        if (!response.ok) {
          handleHttpError(response.status, response, `NuGet metadata for package ${packageName}@${actualVersion}`);
        }

        const xmlText = await response.text();
        const parsed = await NuSpecParser.parseNuSpec(xmlText);
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
    }, NUGET_API_CONFIG.RETRY_ATTEMPTS, NUGET_API_CONFIG.BASE_RETRY_DELAY, `NuGet registry getPackageMetadata(${packageName}, ${actualVersion})`);
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
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
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
    }, NUGET_API_CONFIG.RETRY_ATTEMPTS, NUGET_API_CONFIG.BASE_RETRY_DELAY, `NuGet registry searchPackages(${query})`);
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
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
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
    }, NUGET_API_CONFIG.RETRY_ATTEMPTS, NUGET_API_CONFIG.BASE_RETRY_DELAY, `NuGet registry getDownloadStats(${packageName})`);
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
      const totalDownloads = stats.totalDownloads;
      return {
        last_day: Math.floor(totalDownloads * DOWNLOAD_STATS_RATIOS.DAILY),
        last_week: Math.floor(totalDownloads * DOWNLOAD_STATS_RATIOS.WEEKLY),
        last_month: Math.floor(totalDownloads * DOWNLOAD_STATS_RATIOS.MONTHLY),
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

  async getPackageReadme(packageName: string, version: string): Promise<string | null> {
    // Try to get README content directly from NuGet
    let actualVersion = version;
    if (version === 'latest') {
      const versions = await this.getPackageVersions(packageName);
      if (versions.length === 0) {
        return null;
      }
      actualVersion = versions[versions.length - 1];
    }

    const readmeUrl = `${this.registrationBaseUrl}/${packageName.toLowerCase()}/${actualVersion.toLowerCase()}/readme`;
    
    return withRetry(async () => {
      logger.debug(`Attempting to fetch README from NuGet: ${packageName}@${actualVersion}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(readmeUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'text/plain, text/markdown, */*',
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
          },
        });

        if (response.status === 404) {
          logger.debug(`No README found in NuGet package: ${packageName}@${actualVersion}`);
          return null;
        }

        if (!response.ok) {
          logger.debug(`Failed to fetch README from NuGet: ${packageName}@${actualVersion}, status: ${response.status}`);
          return null;
        }

        const readmeContent = await response.text();
        if (readmeContent && readmeContent.trim().length > 0) {
          logger.debug(`Successfully fetched README from NuGet: ${packageName}@${actualVersion}`);
          return readmeContent;
        }
        
        return null;
      } catch (error) {
        logger.debug(`Failed to fetch README from NuGet: ${packageName}@${actualVersion}`, { error });
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    }, 1, 0, `NuGet README getPackageReadme(${packageName}, ${actualVersion})`);
  }

  async getEnhancedPackageMetadata(packageName: string, version: string): Promise<import('../types/index.js').NuGetEnhancedMetadata | null> {
    // Try to get enhanced metadata from Registration API
    let actualVersion = version;
    if (version === 'latest') {
      const versions = await this.getPackageVersions(packageName);
      if (versions.length === 0) {
        throw new VersionNotFoundError(packageName, version);
      }
      actualVersion = versions[versions.length - 1];
    }

    const registrationUrl = `${this.registrationApiUrl}/${packageName.toLowerCase()}/${actualVersion.toLowerCase()}.json`;
    
    return withRetry(async () => {
      logger.debug(`Fetching enhanced package metadata: ${packageName}@${actualVersion}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(registrationUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': NUGET_API_CONFIG.USER_AGENT,
          },
        });

        if (response.status === 404) {
          logger.debug(`Enhanced metadata not available for: ${packageName}@${actualVersion}`);
          return null;
        }

        if (!response.ok) {
          logger.debug(`Failed to fetch enhanced metadata: ${packageName}@${actualVersion}, status: ${response.status}`);
          return null;
        }

        const data = await response.json();
        logger.debug(`Successfully fetched enhanced metadata: ${packageName}@${actualVersion}`);
        return data;
      } catch (error) {
        logger.debug(`Failed to fetch enhanced metadata: ${packageName}@${actualVersion}`, { error });
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    }, 1, 0, `NuGet Registration getEnhancedPackageMetadata(${packageName}, ${actualVersion})`);
  }

}

export const nugetApi = new NuGetApiClient();