import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitHubApiClient } from '../../src/services/github-api.js';
import { GITHUB_CONFIG } from '../../src/config/constants.js';
import * as errorHandler from '../../src/utils/error-handler.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/utils/error-handler.js', () => ({
  handleApiError: vi.fn(),
  handleHttpError: vi.fn(),
  withRetry: vi.fn(async (fn) => await fn()),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHubApiClient', () => {
  let client: GitHubApiClient;
  let mockAbortController: { abort: vi.Mock; signal: AbortSignal };

  beforeEach(() => {
    client = new GitHubApiClient();
    
    // Mock AbortController
    mockAbortController = {
      abort: vi.fn(),
      signal: {} as AbortSignal,
    };
    vi.stubGlobal('AbortController', vi.fn(() => mockAbortController));
    
    // Mock setTimeout and clearTimeout
    vi.stubGlobal('setTimeout', vi.fn((fn, delay) => {
      // Return a mock timer ID
      return 123;
    }));
    vi.stubGlobal('clearTimeout', vi.fn());
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default config', () => {
      const newClient = new GitHubApiClient();
      expect(newClient).toBeInstanceOf(GitHubApiClient);
    });

    it('should initialize with custom token and timeout', () => {
      const token = 'custom-token';
      const timeout = 5000;
      const newClient = new GitHubApiClient(token, timeout);
      expect(newClient).toBeInstanceOf(GitHubApiClient);
    });

    it('should warn when no token provided', () => {
      const { logger } = require('../../src/utils/logger.js');
      new GitHubApiClient();
      expect(logger.warn).toHaveBeenCalledWith('GitHub token not provided. Rate limits will be lower.');
    });
  });

  describe('getReadme', () => {
    const owner = 'microsoft';
    const repo = 'dotnet';
    const mockReadmeContent = '# .NET\nThis is the README for .NET';

    it('should fetch README successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockReadmeContent),
      });

      const result = await client.getReadme(owner, repo);

      expect(result).toBe(mockReadmeContent);
      expect(mockFetch).toHaveBeenCalledWith(
        `${GITHUB_CONFIG.BASE_URL}/repos/${owner}/${repo}/readme`,
        {
          signal: mockAbortController.signal,
          headers: {
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': GITHUB_CONFIG.USER_AGENT,
          },
        }
      );
    });

    it('should include authorization header when token provided', async () => {
      const token = 'test-token';
      const clientWithToken = new GitHubApiClient(token);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockReadmeContent),
      });

      await clientWithToken.getReadme(owner, repo);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `token ${token}`,
          }),
        })
      );
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await client.getReadme(owner, repo);

      expect(errorHandler.handleHttpError).toHaveBeenCalledWith(
        404,
        mockResponse,
        `GitHub README for ${owner}/${repo}`
      );
    });

    it('should handle timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));
      Object.defineProperty(Error.prototype, 'name', {
        value: 'AbortError',
        configurable: true,
      });

      await client.getReadme(owner, repo);

      expect(errorHandler.handleApiError).toHaveBeenCalledWith(
        expect.any(Error),
        `GitHub README for ${owner}/${repo}`
      );
    });

    it('should clear timeout after request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockReadmeContent),
      });

      await client.getReadme(owner, repo);

      expect(clearTimeout).toHaveBeenCalledWith(123);
    });

    it('should encode owner and repo names', async () => {
      const specialOwner = 'owner with spaces';
      const specialRepo = 'repo@special';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockReadmeContent),
      });

      await client.getReadme(specialOwner, specialRepo);

      expect(mockFetch).toHaveBeenCalledWith(
        `${GITHUB_CONFIG.BASE_URL}/repos/${encodeURIComponent(specialOwner)}/${encodeURIComponent(specialRepo)}/readme`,
        expect.any(Object)
      );
    });
  });

  describe('parseRepositoryUrl', () => {
    it('should parse HTTPS GitHub URL', () => {
      const url = 'https://github.com/microsoft/dotnet';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });

    it('should parse HTTPS GitHub URL with .git suffix', () => {
      const url = 'https://github.com/microsoft/dotnet.git';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });

    it('should parse HTTPS GitHub URL with additional path', () => {
      const url = 'https://github.com/microsoft/dotnet/tree/main';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });

    it('should parse git+https GitHub URL', () => {
      const url = 'git+https://github.com/microsoft/dotnet.git';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });

    it('should parse git:// GitHub URL', () => {
      const url = 'git://github.com/microsoft/dotnet.git';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });

    it('should parse SSH GitHub URL', () => {
      const url = 'git@github.com:microsoft/dotnet.git';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://gitlab.com/owner/repo',
        'https://bitbucket.org/owner/repo',
        'not-a-url',
        '',
        'https://github.com/',
        'https://github.com/owner',
      ];

      invalidUrls.forEach(url => {
        const result = client.parseRepositoryUrl(url);
        expect(result).toBeNull();
      });
    });

    it('should handle errors gracefully', () => {
      // Mock a scenario where regex matching throws an error
      const originalMatch = String.prototype.match;
      String.prototype.match = vi.fn(() => {
        throw new Error('Regex error');
      });

      const result = client.parseRepositoryUrl('https://github.com/owner/repo');
      expect(result).toBeNull();

      // Restore original method
      String.prototype.match = originalMatch;
    });
  });

  describe('getReadmeFromRepository', () => {
    it('should return null for non-git repositories', async () => {
      const repository = {
        type: 'svn' as const,
        url: 'https://github.com/microsoft/dotnet',
      };

      const result = await client.getReadmeFromRepository(repository);
      expect(result).toBeNull();
    });

    it('should return null for unparseable URLs', async () => {
      const repository = {
        type: 'git' as const,
        url: 'https://gitlab.com/owner/repo',
      };

      const result = await client.getReadmeFromRepository(repository);
      expect(result).toBeNull();
    });

    it('should fetch README for valid git repository', async () => {
      const repository = {
        type: 'git' as const,
        url: 'https://github.com/microsoft/dotnet',
      };
      const mockReadmeContent = '# .NET README';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(mockReadmeContent),
      });

      const result = await client.getReadmeFromRepository(repository);
      expect(result).toBe(mockReadmeContent);
    });

    it('should return null when README fetch fails', async () => {
      const repository = {
        type: 'git' as const,
        url: 'https://github.com/microsoft/dotnet',
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.getReadmeFromRepository(repository);
      expect(result).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    describe('isRateLimited', () => {
      it('should return false (TODO: implement rate limit tracking)', () => {
        const result = client.isRateLimited();
        expect(result).toBe(false);
      });
    });

    describe('getRateLimitStatus', () => {
      it('should return null (TODO: implement rate limit status tracking)', () => {
        const result = client.getRateLimitStatus();
        expect(result).toBeNull();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle repositories with special characters in names', () => {
      const url = 'https://github.com/user-name/repo.name-with.dots';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'user-name',
        repo: 'repo.name-with.dots',
      });
    });

    it('should handle case-sensitive repository names', () => {
      const url = 'https://github.com/Microsoft/DOTNET';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'Microsoft',
        repo: 'DOTNET',
      });
    });

    it('should handle HTTP (non-HTTPS) URLs', () => {
      const url = 'http://github.com/microsoft/dotnet';
      const result = client.parseRepositoryUrl(url);
      
      expect(result).toEqual({
        owner: 'microsoft',
        repo: 'dotnet',
      });
    });
  });
});