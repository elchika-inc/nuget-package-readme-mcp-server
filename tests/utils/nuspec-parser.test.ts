import { describe, it, expect, vi } from 'vitest';
import { NuSpecParser } from '../../src/utils/nuspec-parser.js';
import type { NuSpecPackage } from '../../src/types/index.js';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger,
}));

describe('NuSpecParser', () => {
  describe('parseNuSpec', () => {
    it('should parse basic NuSpec XML with all fields', async () => {
      const xmlText = `<?xml version="1.0"?>
<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">
  <metadata>
    <id>Newtonsoft.Json</id>
    <version>13.0.1</version>
    <title>Json.NET</title>
    <authors>James Newton-King</authors>
    <description>Json.NET is a popular high-performance JSON framework for .NET</description>
    <tags>json linq xml</tags>
    <projectUrl>https://www.newtonsoft.com/json</projectUrl>
    <licenseExpression>MIT</licenseExpression>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result).toEqual({
        package: {
          metadata: {
            id: 'Newtonsoft.Json',
            version: '13.0.1',
            title: 'Json.NET',
            authors: 'James Newton-King',
            description: 'Json.NET is a popular high-performance JSON framework for .NET',
            tags: 'json linq xml',
            projectUrl: 'https://www.newtonsoft.com/json',
            licenseExpression: 'MIT',
          },
        },
      } as NuSpecPackage);
    });

    it('should parse NuSpec XML with minimal required fields', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>MinimalPackage</id>
    <version>1.0.0</version>
    <authors>Unknown</authors>
    <description>A minimal package</description>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result).toEqual({
        package: {
          metadata: {
            id: 'MinimalPackage',
            version: '1.0.0',
            title: undefined,
            authors: 'Unknown',
            description: 'A minimal package',
            tags: '',
            projectUrl: undefined,
            licenseExpression: 'Unknown',
          },
        },
      } as NuSpecPackage);
    });

    it('should handle case-insensitive XML tags', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <ID>CaseInsensitive</ID>
    <VERSION>2.0.0</VERSION>
    <AUTHORS>Test Author</AUTHORS>
    <DESCRIPTION>Case insensitive test</DESCRIPTION>
    <TAGS>test</TAGS>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.id).toBe('CaseInsensitive');
      expect(result.package.metadata.version).toBe('2.0.0');
      expect(result.package.metadata.authors).toBe('Test Author');
      expect(result.package.metadata.description).toBe('Case insensitive test');
      expect(result.package.metadata.tags).toBe('test');
    });

    it('should prioritize licenseExpression over license and licenseUrl', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>LicenseTest</id>
    <version>1.0.0</version>
    <authors>Test</authors>
    <description>Testing license parsing</description>
    <license>Old License</license>
    <licenseUrl>https://example.com/license</licenseUrl>
    <licenseExpression>Apache-2.0</licenseExpression>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.licenseExpression).toBe('Apache-2.0');
    });

    it('should fallback to license when licenseExpression is not available', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>LicenseTest</id>
    <version>1.0.0</version>
    <authors>Test</authors>
    <description>Testing license parsing</description>
    <license>BSD-3-Clause</license>
    <licenseUrl>https://example.com/license</licenseUrl>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.licenseExpression).toBe('BSD-3-Clause');
    });

    it('should fallback to licenseUrl when license and licenseExpression are not available', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>LicenseTest</id>
    <version>1.0.0</version>
    <authors>Test</authors>
    <description>Testing license parsing</description>
    <licenseUrl>https://example.com/license</licenseUrl>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.licenseExpression).toBe('https://example.com/license');
    });

    it('should default to "Unknown" when no license information is available', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>NoLicense</id>
    <version>1.0.0</version>
    <authors>Test</authors>
    <description>No license info</description>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.licenseExpression).toBe('Unknown');
    });

    it('should trim whitespace from all extracted values', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>  WhitespaceTest  </id>
    <version>  1.0.0  </version>
    <title>  Test Title  </title>
    <authors>  Test Author  </authors>
    <description>  Test Description  </description>
    <tags>  tag1 tag2  </tags>
    <projectUrl>  https://example.com  </projectUrl>
    <licenseExpression>  MIT  </licenseExpression>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.id).toBe('WhitespaceTest');
      expect(result.package.metadata.version).toBe('1.0.0');
      expect(result.package.metadata.title).toBe('Test Title');
      expect(result.package.metadata.authors).toBe('Test Author');
      expect(result.package.metadata.description).toBe('Test Description');
      expect(result.package.metadata.tags).toBe('tag1 tag2');
      expect(result.package.metadata.projectUrl).toBe('https://example.com');
      expect(result.package.metadata.licenseExpression).toBe('MIT');
    });

    it('should handle empty XML tags', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id></id>
    <version></version>
    <authors></authors>
    <description></description>
    <tags></tags>
    <title></title>
    <projectUrl></projectUrl>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.id).toBe('');
      expect(result.package.metadata.version).toBe('');
      expect(result.package.metadata.authors).toBe('');
      expect(result.package.metadata.description).toBe('');
      expect(result.package.metadata.tags).toBe('');
      expect(result.package.metadata.title).toBe('');
      expect(result.package.metadata.projectUrl).toBe('');
      expect(result.package.metadata.licenseExpression).toBe('Unknown');
    });

    it('should handle missing optional fields', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>MissingFields</id>
    <version>1.0.0</version>
    <authors>Test Author</authors>
    <description>Test Description</description>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.id).toBe('MissingFields');
      expect(result.package.metadata.version).toBe('1.0.0');
      expect(result.package.metadata.authors).toBe('Test Author');
      expect(result.package.metadata.description).toBe('Test Description');
      expect(result.package.metadata.title).toBeUndefined();
      expect(result.package.metadata.tags).toBe('');
      expect(result.package.metadata.projectUrl).toBeUndefined();
      expect(result.package.metadata.licenseExpression).toBe('Unknown');
    });

    it('should handle complex XML with CDATA and special characters', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>ComplexPackage</id>
    <version>1.0.0</version>
    <authors><![CDATA[Author & Co.]]></authors>
    <description><![CDATA[A package with <special> characters & symbols]]></description>
    <tags>special &amp; characters</tags>
  </metadata>
</package>`;

      // Note: This parser uses simple regex, so CDATA won't be handled properly
      // This test documents the current behavior
      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.id).toBe('ComplexPackage');
      expect(result.package.metadata.version).toBe('1.0.0');
      // The current parser doesn't handle CDATA properly, so these will be empty
      expect(result.package.metadata.authors).toBe('');
      expect(result.package.metadata.description).toBe('');
      expect(result.package.metadata.tags).toBe('special &amp; characters');
    });

    it('should handle multiline content', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>MultilinePackage</id>
    <version>1.0.0</version>
    <authors>Test Author</authors>
    <description>This is a very long description
    that spans multiple lines
    and contains detailed information</description>
  </metadata>
</package>`;

      // The current regex-based parser won't handle multiline content properly
      // This test documents the current behavior
      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.id).toBe('MultilinePackage');
      expect(result.package.metadata.version).toBe('1.0.0');
      expect(result.package.metadata.authors).toBe('Test Author');
      // Multiline content won't be captured by the current regex
      expect(result.package.metadata.description).toBe('');
    });

    it('should throw error and log when parsing fails', async () => {
      // Invalid XML that might cause the parsing to fail
      const invalidXml = 'invalid-xml-content';

      await expect(NuSpecParser.parseNuSpec(invalidXml)).rejects.toThrow('Failed to parse package metadata');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to parse NuSpec XML', { error: expect.any(Error) });
    });

    it('should handle license with attributes', async () => {
      const xmlText = `<?xml version="1.0"?>
<package>
  <metadata>
    <id>LicenseWithAttributes</id>
    <version>1.0.0</version>
    <authors>Test</authors>
    <description>Testing license with attributes</description>
    <license type="expression">MIT</license>
  </metadata>
</package>`;

      const result = await NuSpecParser.parseNuSpec(xmlText);

      expect(result.package.metadata.licenseExpression).toBe('MIT');
    });
  });
});