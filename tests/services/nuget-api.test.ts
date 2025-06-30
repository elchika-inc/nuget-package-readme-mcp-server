import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NuGetApiClient } from '../../src/services/nuget-api.js';
import { VersionNotFoundError } from '../../src/types/index.js';

// Global fetchをモック
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('NuGetApiClient', () => {
  let apiClient: NuGetApiClient;
  let abortSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    apiClient = new NuGetApiClient(5000);
    vi.clearAllMocks();
    abortSpy = vi.spyOn(AbortController.prototype, 'abort');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkPackageExists', () => {
    it('should return true when package exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: ['1.0.0'] }),
      });

      const result = await apiClient.checkPackageExists('Newtonsoft.Json');
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nuget.org/v3-flatcontainer/newtonsoft.json/index.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'nuget-package-readme-mcp/1.0.0',
          }),
        })
      );
    });

    it('should return false when package does not exist (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await apiClient.checkPackageExists('NonExistentPackage');
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiClient.checkPackageExists('TestPackage');
      expect(result).toBe(false);
    });

    it('should handle timeout', async () => {
      const slowResponse = new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({ versions: ['1.0.0'] }),
        }), 10000);
      });
      mockFetch.mockReturnValueOnce(slowResponse);

      // タイムアウトは5秒に設定されているので、すぐにAbortControllerが呼ばれるべき
      setTimeout(() => {
        expect(abortSpy).toHaveBeenCalled();
      }, 100);

      const result = await apiClient.checkPackageExists('TestPackage');
      expect(result).toBe(false);
    });
  });

  describe('getPackageVersions', () => {
    it('should return package versions', async () => {
      const mockVersions = ['1.0.0', '1.1.0', '2.0.0'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: mockVersions }),
      });

      const result = await apiClient.getPackageVersions('Newtonsoft.Json');
      expect(result).toEqual(mockVersions);
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(apiClient.getPackageVersions('TestPackage')).rejects.toThrow();
    });
  });

  describe('getPackageMetadata', () => {
    it('should fetch metadata for specific version', async () => {
      const mockNuspecXml = `<?xml version="1.0" encoding="utf-8"?>
        <package>
          <metadata>
            <id>TestPackage</id>
            <version>1.0.0</version>
            <description>Test description</description>
          </metadata>
        </package>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockNuspecXml,
      });

      const result = await apiClient.getPackageMetadata('TestPackage', '1.0.0');
      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nuget.org/v3-flatcontainer/testpackage/1.0.0/testpackage.nuspec',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/xml',
          }),
        })
      );
    });

    it('should resolve latest version', async () => {
      const mockVersions = ['1.0.0', '1.1.0', '2.0.0'];
      const mockNuspecXml = `<?xml version="1.0" encoding="utf-8"?>
        <package>
          <metadata>
            <id>TestPackage</id>
            <version>2.0.0</version>
            <description>Test description</description>
          </metadata>
        </package>`;

      // First call to get versions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: mockVersions }),
      });

      // Second call to get nuspec
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockNuspecXml,
      });

      await apiClient.getPackageMetadata('TestPackage', 'latest');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://api.nuget.org/v3-flatcontainer/testpackage/2.0.0/testpackage.nuspec',
        expect.any(Object)
      );
    });

    it('should throw VersionNotFoundError when no versions exist for latest', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: [] }),
      });

      await expect(apiClient.getPackageMetadata('TestPackage', 'latest'))
        .rejects.toThrow(VersionNotFoundError);
    });
  });

  describe('searchPackages', () => {
    it('should search packages with correct parameters', async () => {
      const mockSearchResponse = {
        totalHits: 1,
        data: [{
          id: 'TestPackage',
          version: '1.0.0',
          description: 'Test package',
          authors: ['Test Author'],
          totalDownloads: 1000,
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      const result = await apiClient.searchPackages('test', 10);
      expect(result).toEqual(mockSearchResponse);
      
      const expectedUrl = 'https://azuresearch-usnc.nuget.org/query?q=test&take=10&prerelease=false&semVerLevel=2.0.0';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should use default limit when not provided', async () => {
      const mockSearchResponse = { totalHits: 0, data: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResponse,
      });

      await apiClient.searchPackages('test');
      
      const expectedUrl = 'https://azuresearch-usnc.nuget.org/query?q=test&take=20&prerelease=false&semVerLevel=2.0.0';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });
  });

  describe('getDownloadStats', () => {
    it('should return mock download stats', async () => {
      const mockVersions = ['1.0.0', '1.1.0'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: mockVersions }),
      });

      const result = await apiClient.getDownloadStats('TestPackage');
      expect(result).toEqual({
        totalDownloads: 0,
        data: [
          { downloads: 0, packageVersion: '1.0.0' },
          { downloads: 0, packageVersion: '1.1.0' },
        ],
      });
    });

    it('should return zero stats for non-existent package', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await apiClient.getDownloadStats('NonExistentPackage');
      expect(result).toEqual({
        totalDownloads: 0,
        data: [],
      });
    });
  });

  describe('getAllDownloadStats', () => {
    it('should return time-based download approximations', async () => {
      const mockVersions = ['1.0.0'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: mockVersions }),
      });

      const result = await apiClient.getAllDownloadStats('TestPackage');
      expect(result).toEqual({
        last_day: 0,
        last_week: 0,
        last_month: 0,
      });
    });

    it('should return zeros on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await apiClient.getAllDownloadStats('TestPackage');
      expect(result).toEqual({
        last_day: 0,
        last_week: 0,
        last_month: 0,
      });
    });
  });

  describe('getPackageReadme', () => {
    it('should return README content when available', async () => {
      const mockReadme = '# TestPackage\n\nThis is a test package.';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockReadme,
      });

      const result = await apiClient.getPackageReadme('TestPackage', '1.0.0');
      expect(result).toBe(mockReadme);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nuget.org/v3-flatcontainer/testpackage/1.0.0/readme',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'text/plain, text/markdown, */*',
          }),
        })
      );
    });

    it('should return null when README not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await apiClient.getPackageReadme('TestPackage', '1.0.0');
      expect(result).toBeNull();
    });

    it('should return null for empty README content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '   ',
      });

      const result = await apiClient.getPackageReadme('TestPackage', '1.0.0');
      expect(result).toBeNull();
    });

    it('should resolve latest version for README', async () => {
      const mockVersions = ['1.0.0', '2.0.0'];
      const mockReadme = '# TestPackage v2.0.0';

      // First call to get versions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: mockVersions }),
      });

      // Second call to get README
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockReadme,
      });

      const result = await apiClient.getPackageReadme('TestPackage', 'latest');
      expect(result).toBe(mockReadme);
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://api.nuget.org/v3-flatcontainer/testpackage/2.0.0/readme',
        expect.any(Object)
      );
    });
  });

  describe('getEnhancedPackageMetadata', () => {
    it('should return enhanced metadata when available', async () => {
      const mockMetadata = {
        packageRegistration: 'TestPackage',
        catalogEntry: {
          id: 'TestPackage',
          version: '1.0.0',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMetadata,
      });

      const result = await apiClient.getEnhancedPackageMetadata('TestPackage', '1.0.0');
      expect(result).toEqual(mockMetadata);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nuget.org/v3/registration5-semver1/testpackage/1.0.0.json',
        expect.any(Object)
      );
    });

    it('should return null when enhanced metadata not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await apiClient.getEnhancedPackageMetadata('TestPackage', '1.0.0');
      expect(result).toBeNull();
    });

    it('should resolve latest version for enhanced metadata', async () => {
      const mockVersions = ['1.0.0', '2.0.0'];
      const mockMetadata = { version: '2.0.0' };

      // First call to get versions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ versions: mockVersions }),
      });

      // Second call to get enhanced metadata
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMetadata,
      });

      await apiClient.getEnhancedPackageMetadata('TestPackage', 'latest');
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://api.nuget.org/v3/registration5-semver1/testpackage/2.0.0.json',
        expect.any(Object)
      );
    });
  });

  describe('constructor', () => {
    it('should use default timeout when not provided', () => {
      const client = new NuGetApiClient();
      expect(client).toBeDefined();
    });

    it('should use custom timeout when provided', () => {
      const client = new NuGetApiClient(10000);
      expect(client).toBeDefined();
    });
  });
});