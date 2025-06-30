import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getPackageReadme } from '../../src/tools/get-package-readme.js';
import type { GetPackageReadmeParams, PackageReadmeResponse, NuSpecPackage } from '../../src/types/index.js';

// Mock all dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/utils/validators.js', () => ({
  validatePackageName: vi.fn(),
  validateVersion: vi.fn(),
}));

vi.mock('../../src/services/cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
  createCacheKey: {
    packageReadme: vi.fn((packageName: string, version: string) => `readme:${packageName}:${version}`),
  },
}));

vi.mock('../../src/services/nuget-unified-api.js', () => ({
  nugetApi: {
    checkPackageExists: vi.fn(),
    getPackageMetadata: vi.fn(),
    getPackageReadme: vi.fn(),
    getEnhancedPackageMetadata: vi.fn(),
  },
}));

vi.mock('../../src/services/github-api.js', () => ({
  githubApi: {
    getReadmeFromRepository: vi.fn(),
  },
}));

vi.mock('../../src/services/readme-parser-unified.js', () => ({
  readmeParser: {
    cleanMarkdown: vi.fn((content: string) => content),
    parseUsageExamples: vi.fn(() => []),
  },
}));

vi.mock('../../src/services/readme-generator.js', () => ({
  ReadmeGenerator: {
    createFallbackReadme: vi.fn(() => 'Generated README'),
    createEnhancedFallbackReadme: vi.fn(() => 'Enhanced README'),
  },
}));

describe('getPackageReadme', () => {

  const mockPackageMetadata: NuSpecPackage = {
    package: {
      metadata: {
        id: 'Newtonsoft.Json',
        version: '13.0.1',
        description: 'Popular high-performance JSON framework for .NET',
        authors: 'James Newton-King',
        tags: 'json linq xml',
        projectUrl: 'https://github.com/JamesNK/Newtonsoft.Json',
        licenseExpression: 'MIT',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    it('should validate required package_name parameter', async () => {
      const params = {} as GetPackageReadmeParams;
      const { validatePackageName } = await import('../../src/utils/validators.js');
      
      vi.mocked(validatePackageName).mockImplementation(() => {
        throw new Error('Package name is required');
      });

      await expect(getPackageReadme(params)).rejects.toThrow('Package name is required');
      expect(validatePackageName).toHaveBeenCalledWith(undefined);
    });

    it('should validate package_name type', async () => {
      const params = { package_name: 123 } as any;
      
      mockValidators.validatePackageName.mockImplementation(() => {
        throw new Error('Package name must be a string');
      });

      await expect(getPackageReadme(params)).rejects.toThrow('Package name must be a string');
    });

    it('should validate version when not "latest"', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
        version: '13.0.1',
      };
      
      mockValidators.validateVersion.mockImplementation(() => {
        throw new Error('Invalid version format');
      });

      await expect(getPackageReadme(params)).rejects.toThrow('Invalid version format');
      expect(mockValidators.validateVersion).toHaveBeenCalledWith('13.0.1');
    });

    it('should not validate version when "latest"', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
        version: 'latest',
      };

      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockResolvedValue(false);

      await getPackageReadme(params);

      expect(mockValidators.validateVersion).not.toHaveBeenCalled();
    });
  });

  describe('Cache Handling', () => {
    it('should return cached result when available', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      const cachedResponse: PackageReadmeResponse = {
        package_name: 'Newtonsoft.Json',
        version: '13.0.1',
        description: 'Cached response',
        readme_content: 'Cached README',
        usage_examples: [],
        installation: {
          command: 'dotnet add package Newtonsoft.Json',
          alternatives: [],
          dotnet: 'dotnet add package Newtonsoft.Json',
          packageManager: 'Install-Package Newtonsoft.Json',
          paket: 'paket add Newtonsoft.Json',
        },
        basic_info: {
          name: 'Newtonsoft.Json',
          version: '13.0.1',
          description: 'Cached response',
          license: 'MIT',
          authors: [],
          tags: [],
        },
        exists: true,
      };

      mockCache.cache.get.mockReturnValue(cachedResponse);

      const result = await getPackageReadme(params);

      expect(result).toBe(cachedResponse);
      expect(mockCache.cache.get).toHaveBeenCalledWith('readme:Newtonsoft.Json:latest');
      expect(mockNugetApi.nugetApi.checkPackageExists).not.toHaveBeenCalled();
    });

    it('should cache successful response', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockResolvedValue(true);
      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(mockPackageMetadata);
      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue('NuGet README content');
      mockReadmeParser.readmeParser.cleanMarkdown.mockReturnValue('Cleaned README');
      mockReadmeParser.readmeParser.parseUsageExamples.mockReturnValue(['example1', 'example2']);

      const result = await getPackageReadme(params);

      expect(mockCache.cache.set).toHaveBeenCalledWith(
        'readme:Newtonsoft.Json:latest',
        expect.any(Object)
      );
      expect(result.exists).toBe(true);
    });
  });

  describe('Package Existence Check', () => {
    it('should return not found response when package does not exist', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'NonExistentPackage',
      };

      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockResolvedValue(false);

      const result = await getPackageReadme(params);

      expect(result.exists).toBe(false);
      expect(result.package_name).toBe('NonExistentPackage');
      expect(result.description).toBe('Package not found');
      expect(result.readme_content).toBe('');
    });
  });

  describe('README Content Sources', () => {
    beforeEach(() => {
      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockResolvedValue(true);
      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(mockPackageMetadata);
      mockReadmeParser.readmeParser.cleanMarkdown.mockImplementation((content: string) => content);
      mockReadmeParser.readmeParser.parseUsageExamples.mockReturnValue([]);
    });

    it('should use NuGet README when available', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue('NuGet README content');

      const result = await getPackageReadme(params);

      expect(result.readme_content).toBe('NuGet README content');
      expect(mockNugetApi.nugetApi.getPackageReadme).toHaveBeenCalledWith('Newtonsoft.Json', '13.0.1');
      expect(mockGithubApi.githubApi.getReadmeFromRepository).not.toHaveBeenCalled();
    });

    it('should use enhanced NuGet metadata when available and better than basic', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue(null);
      mockNugetApi.nugetApi.getEnhancedPackageMetadata.mockResolvedValue({
        description: 'Very detailed enhanced description that is much longer than the basic one',
      });
      mockReadmeGenerator.ReadmeGenerator.createEnhancedFallbackReadme.mockReturnValue('Enhanced README');

      const result = await getPackageReadme(params);

      expect(result.readme_content).toBe('Enhanced README');
      expect(mockReadmeGenerator.ReadmeGenerator.createEnhancedFallbackReadme).toHaveBeenCalled();
    });

    it('should use GitHub README when project URL is GitHub and NuGet README not available', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue(null);
      mockNugetApi.nugetApi.getEnhancedPackageMetadata.mockResolvedValue(null);
      mockGithubApi.githubApi.getReadmeFromRepository.mockResolvedValue('GitHub README content');

      const result = await getPackageReadme(params);

      expect(result.readme_content).toBe('GitHub README content');
      expect(mockGithubApi.githubApi.getReadmeFromRepository).toHaveBeenCalledWith({
        type: 'git',
        url: 'https://github.com/JamesNK/Newtonsoft.Json',
      });
    });

    it('should generate fallback README when no other sources available', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue(null);
      mockNugetApi.nugetApi.getEnhancedPackageMetadata.mockResolvedValue(null);
      mockGithubApi.githubApi.getReadmeFromRepository.mockResolvedValue(null);
      mockReadmeGenerator.ReadmeGenerator.createFallbackReadme.mockReturnValue('Generated README');

      const result = await getPackageReadme(params);

      expect(result.readme_content).toBe('Generated README');
      expect(mockReadmeGenerator.ReadmeGenerator.createFallbackReadme).toHaveBeenCalledWith(mockPackageMetadata);
    });

    it('should not try GitHub when project URL is not GitHub', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'TestPackage',
      };

      const nonGithubMetadata: NuSpecPackage = {
        package: {
          metadata: {
            ...mockPackageMetadata.package.metadata,
            projectUrl: 'https://example.com/project',
          },
        },
      };

      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(nonGithubMetadata);
      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue(null);
      mockNugetApi.nugetApi.getEnhancedPackageMetadata.mockResolvedValue(null);
      mockReadmeGenerator.ReadmeGenerator.createFallbackReadme.mockReturnValue('Generated README');

      const result = await getPackageReadme(params);

      expect(mockGithubApi.githubApi.getReadmeFromRepository).not.toHaveBeenCalled();
      expect(result.readme_content).toBe('Generated README');
    });
  });

  describe('Response Structure', () => {
    beforeEach(() => {
      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockResolvedValue(true);
      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(mockPackageMetadata);
      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue('README content');
      mockReadmeParser.readmeParser.cleanMarkdown.mockImplementation((content: string) => content);
      mockReadmeParser.readmeParser.parseUsageExamples.mockReturnValue(['usage example']);
    });

    it('should return complete response structure', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
        version: '13.0.1',
        include_examples: true,
      };

      const result = await getPackageReadme(params);

      expect(result).toEqual({
        package_name: 'Newtonsoft.Json',
        version: '13.0.1',
        description: 'Popular high-performance JSON framework for .NET',
        readme_content: 'README content',
        usage_examples: ['usage example'],
        installation: {
          command: 'dotnet add package Newtonsoft.Json',
          alternatives: [
            'Install-Package Newtonsoft.Json',
            'paket add Newtonsoft.Json',
          ],
          dotnet: 'dotnet add package Newtonsoft.Json',
          packageManager: 'Install-Package Newtonsoft.Json',
          paket: 'paket add Newtonsoft.Json',
        },
        basic_info: {
          name: 'Newtonsoft.Json',
          version: '13.0.1',
          description: 'Popular high-performance JSON framework for .NET',
          license: 'MIT',
          authors: ['James Newton-King'],
          tags: ['json', 'linq', 'xml'],
          projectUrl: 'https://github.com/JamesNK/Newtonsoft.Json',
        },
        exists: true,
      });
    });

    it('should parse tags and authors correctly', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'TestPackage',
      };

      const metadataWithMultipleAuthors: NuSpecPackage = {
        package: {
          metadata: {
            ...mockPackageMetadata.package.metadata,
            authors: 'Author One, Author Two,Author Three',
            tags: 'tag1 tag2   tag3',
          },
        },
      };

      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(metadataWithMultipleAuthors);

      const result = await getPackageReadme(params);

      expect(result.basic_info.authors).toEqual(['Author One', 'Author Two', 'Author Three']);
      expect(result.basic_info.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle missing optional fields', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'MinimalPackage',
      };

      const minimalMetadata: NuSpecPackage = {
        package: {
          metadata: {
            id: 'MinimalPackage',
            version: '1.0.0',
            description: 'Minimal description',
            authors: '',
            tags: '',
            licenseExpression: undefined,
          },
        },
      };

      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(minimalMetadata);

      const result = await getPackageReadme(params);

      expect(result.basic_info.authors).toEqual([]);
      expect(result.basic_info.tags).toEqual([]);
      expect(result.basic_info.license).toBe('Unknown');
      expect(result.basic_info.title).toBeUndefined();
      expect(result.basic_info.projectUrl).toBeUndefined();
    });
  });

  describe('Usage Examples', () => {
    beforeEach(() => {
      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockResolvedValue(true);
      mockNugetApi.nugetApi.getPackageMetadata.mockResolvedValue(mockPackageMetadata);
      mockNugetApi.nugetApi.getPackageReadme.mockResolvedValue('README content');
      mockReadmeParser.readmeParser.cleanMarkdown.mockImplementation((content: string) => content);
    });

    it('should include usage examples when include_examples is true', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
        include_examples: true,
      };

      mockReadmeParser.readmeParser.parseUsageExamples.mockReturnValue(['example1', 'example2']);

      const result = await getPackageReadme(params);

      expect(mockReadmeParser.readmeParser.parseUsageExamples).toHaveBeenCalledWith('README content', true);
      expect(result.usage_examples).toEqual(['example1', 'example2']);
    });

    it('should exclude usage examples when include_examples is false', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
        include_examples: false,
      };

      const result = await getPackageReadme(params);

      expect(mockReadmeParser.readmeParser.parseUsageExamples).toHaveBeenCalledWith('README content', false);
    });

    it('should include usage examples by default', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      const result = await getPackageReadme(params);

      expect(mockReadmeParser.readmeParser.parseUsageExamples).toHaveBeenCalledWith('README content', true);
    });
  });

  describe('Error Handling', () => {
    it('should propagate validation errors', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'InvalidPackage',
      };

      mockValidators.validatePackageName.mockImplementation(() => {
        throw new Error('Invalid package name format');
      });

      await expect(getPackageReadme(params)).rejects.toThrow('Invalid package name format');
    });

    it('should handle API errors gracefully', async () => {
      const params: GetPackageReadmeParams = {
        package_name: 'Newtonsoft.Json',
      };

      mockCache.cache.get.mockReturnValue(null);
      mockNugetApi.nugetApi.checkPackageExists.mockRejectedValue(new Error('API Error'));

      await expect(getPackageReadme(params)).rejects.toThrow('API Error');
    });
  });
});
