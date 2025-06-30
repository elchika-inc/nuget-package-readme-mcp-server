import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import { NUGET_API_CONFIG } from '../config/constants.js';
import type { 
  NuGetSearchResponse,
} from '../types/index.js';

export class NuGetSearchApiClient {
  private readonly searchUrl = NUGET_API_CONFIG.ENDPOINTS.SEARCH;
  private readonly timeout: number;

  constructor(timeout?: number) {
    this.timeout = timeout || NUGET_API_CONFIG.DEFAULT_TIMEOUT;
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
}