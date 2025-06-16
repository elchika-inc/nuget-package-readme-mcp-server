import { logger } from '../utils/logger.js';
import { handleApiError, handleHttpError, withRetry } from '../utils/error-handler.js';
import type { RepositoryInfo } from '../types/index.js';

export class GitHubApiClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly token?: string | undefined;
  private readonly timeout: number;

  constructor(token?: string, timeout?: number) {
    this.token = token;
    this.timeout = timeout || 30000;
    
    if (!this.token) {
      logger.warn('GitHub token not provided. Rate limits will be lower.');
    }
  }

  async getReadme(owner: string, repo: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
    
    return withRetry(async () => {
      logger.debug(`Fetching README from GitHub: ${owner}/${repo}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'nuget-package-readme-mcp/1.0.0',
        };

        if (this.token) {
          headers['Authorization'] = `token ${this.token}`;
        }

        const response = await fetch(url, {
          signal: controller.signal,
          headers,
        });

        if (!response.ok) {
          handleHttpError(response.status, response, `GitHub README for ${owner}/${repo}`);
        }

        const readmeContent = await response.text();
        logger.debug(`Successfully fetched README from GitHub: ${owner}/${repo}`);
        return readmeContent;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          handleApiError(new Error('Request timeout'), `GitHub README for ${owner}/${repo}`);
        }
        handleApiError(error, `GitHub README for ${owner}/${repo}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }, 3, 1000, `GitHub API getReadme(${owner}/${repo})`);
  }

  parseRepositoryUrl(repositoryUrl: string): { owner: string; repo: string } | null {
    try {
      // Handle various GitHub URL formats
      const patterns = [
        /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
        /^git\+https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
        /^git:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
        /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
      ];

      for (const pattern of patterns) {
        const match = repositoryUrl.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
          };
        }
      }

      logger.debug(`Could not parse GitHub repository URL: ${repositoryUrl}`);
      return null;
    } catch (error) {
      logger.debug(`Error parsing repository URL: ${repositoryUrl}`, { error });
      return null;
    }
  }

  async getReadmeFromRepository(repository: RepositoryInfo): Promise<string | null> {
    if (repository.type !== 'git') {
      return null;
    }

    const parsed = this.parseRepositoryUrl(repository.url);
    if (!parsed) {
      return null;
    }

    try {
      return await this.getReadme(parsed.owner, parsed.repo);
    } catch (error) {
      logger.debug(`Failed to fetch README from GitHub: ${parsed.owner}/${parsed.repo}`, { error });
      return null;
    }
  }

  isRateLimited(): boolean {
    // TODO: Implement rate limit tracking
    return false;
  }

  getRateLimitStatus(): {
    limit: number;
    remaining: number;
    resetTime: number;
  } | null {
    // TODO: Implement rate limit status tracking
    return null;
  }
}

export const githubApi = new GitHubApiClient();