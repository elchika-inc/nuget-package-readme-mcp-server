import { describe, it, expect, beforeEach } from 'vitest';

// This is an integration test that focuses on validating the tool signature and basic functionality
// without complex mocking that may cause issues with different runtime environments

describe('get-package-readme integration', () => {
  let getPackageReadme: any;

  beforeEach(async () => {
    // Dynamic import to avoid issues with module resolution in different environments
    try {
      const module = await import('../../src/tools/get-package-readme.js');
      getPackageReadme = module.getPackageReadme;
    } catch (error) {
      // For environments where ESM import fails, try require
      getPackageReadme = require('../../dist/src/tools/get-package-readme.js').getPackageReadme;
    }
  });

  describe('Function Signature', () => {
    it('should export getPackageReadme function', () => {
      expect(typeof getPackageReadme).toBe('function');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject when package_name is missing', async () => {
      await expect(getPackageReadme({})).rejects.toThrow();
    });

    it('should reject when package_name is empty string', async () => {
      await expect(getPackageReadme({ package_name: '' })).rejects.toThrow();
    });

    it('should reject when package_name is not a string', async () => {
      await expect(getPackageReadme({ package_name: 123 })).rejects.toThrow();
    });

    it('should reject when package_name contains invalid characters', async () => {
      await expect(getPackageReadme({ package_name: 'invalid/package' })).rejects.toThrow();
    });
  });

  describe('Response Structure (for non-existent packages)', () => {
    it('should return proper structure for non-existent package', async () => {
      // Using a package that is very unlikely to exist
      const result = await getPackageReadme({ 
        package_name: 'this-package-should-not-exist-12345' 
      });

      expect(result).toHaveProperty('package_name');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('readme_content');
      expect(result).toHaveProperty('usage_examples');
      expect(result).toHaveProperty('installation');
      expect(result).toHaveProperty('basic_info');
      expect(result).toHaveProperty('exists');

      // For non-existent package, exists should be false
      expect(result.exists).toBe(false);
      expect(result.package_name).toBe('this-package-should-not-exist-12345');
    });
  });

  describe('Installation Commands', () => {
    it('should generate correct installation commands for any package', async () => {
      const packageName = 'test-package';
      const result = await getPackageReadme({ package_name: packageName });

      expect(result.installation).toHaveProperty('command');
      expect(result.installation).toHaveProperty('alternatives');
      expect(result.installation).toHaveProperty('dotnet');
      expect(result.installation).toHaveProperty('packageManager');
      expect(result.installation).toHaveProperty('paket');

      // Check specific command formats
      expect(result.installation.dotnet).toBe(`dotnet add package ${packageName}`);
      expect(result.installation.packageManager).toBe(`Install-Package ${packageName}`);
      expect(result.installation.paket).toBe(`paket add ${packageName}`);
    });
  });

  describe('Optional Parameters', () => {
    it('should handle version parameter', async () => {
      const result = await getPackageReadme({ 
        package_name: 'non-existent-package',
        version: '1.0.0'
      });

      expect(result.version).toBe('1.0.0');
    });

    it('should handle include_examples parameter', async () => {
      const result = await getPackageReadme({ 
        package_name: 'non-existent-package',
        include_examples: false
      });

      expect(Array.isArray(result.usage_examples)).toBe(true);
    });

    it('should default to latest version', async () => {
      const result = await getPackageReadme({ 
        package_name: 'non-existent-package'
      });

      // Default version handling varies, but should not crash
      expect(typeof result.version).toBe('string');
    });

    it('should default to including examples', async () => {
      const result = await getPackageReadme({ 
        package_name: 'non-existent-package'
      });

      expect(Array.isArray(result.usage_examples)).toBe(true);
    });
  });
});