import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import { NuSpecParser } from '../utils/nuspec-parser.js';
import { NUGET_API_CONFIG } from '../config/constants.js';
import type { 
  NuSpecPackage,
  NuGetEnhancedMetadata,
} from '../types/index.js';
import {
  VersionNotFoundError,
} from '../types/index.js';

export class NuGetPackageApiClient {
  private readonly registrationBaseUrl = NUGET_API_CONFIG.ENDPOINTS.FLAT_CONTAINER;
  private readonly registrationApiUrl = NUGET_API_CONFIG.ENDPOINTS.REGISTRATION;
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

  async getEnhancedPackageMetadata(packageName: string, version: string): Promise<NuGetEnhancedMetadata | null> {
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