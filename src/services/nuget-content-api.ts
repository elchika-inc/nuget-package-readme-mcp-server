import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import { NUGET_API_CONFIG, DOWNLOAD_STATS_RATIOS } from '../config/constants.js';
import type { 
  NuGetDownloadStats,
} from '../types/index.js';

export class NuGetContentApiClient {
  private readonly registrationBaseUrl = NUGET_API_CONFIG.ENDPOINTS.FLAT_CONTAINER;
  private readonly timeout: number;

  constructor(timeout?: number) {
    this.timeout = timeout || NUGET_API_CONFIG.DEFAULT_TIMEOUT;
  }

  async getPackageReadme(packageName: string, version: string): Promise<string | null> {
    // Try to get README content directly from NuGet
    const readmeUrl = `${this.registrationBaseUrl}/${packageName.toLowerCase()}/${version.toLowerCase()}/readme`;
    
    return withRetry(async () => {
      logger.debug(`Attempting to fetch README from NuGet: ${packageName}@${version}`);
      
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
          logger.debug(`No README found in NuGet package: ${packageName}@${version}`);
          return null;
        }

        if (!response.ok) {
          logger.debug(`Failed to fetch README from NuGet: ${packageName}@${version}, status: ${response.status}`);
          return null;
        }

        const readmeContent = await response.text();
        if (readmeContent && readmeContent.trim().length > 0) {
          logger.debug(`Successfully fetched README from NuGet: ${packageName}@${version}`);
          return readmeContent;
        }
        
        return null;
      } catch (error) {
        logger.debug(`Failed to fetch README from NuGet: ${packageName}@${version}`, { error });
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    }, 1, 0, `NuGet README getPackageReadme(${packageName}, ${version})`);
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
}