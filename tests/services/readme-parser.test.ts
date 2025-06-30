import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadmeParser } from '../../src/services/readme-parser.js';
import type { UsageExample } from '../../src/types/index.js';

describe('ReadmeParser', () => {
  let parser: ReadmeParser;

  beforeEach(() => {
    parser = new ReadmeParser();
  });

  describe('parseUsageExamples', () => {
    it('should return empty array when includeExamples is false', () => {
      const readme = '# Test\n```csharp\nvar x = 1;\n```';
      const result = parser.parseUsageExamples(readme, false);
      expect(result).toEqual([]);
    });

    it('should return empty array when readmeContent is empty', () => {
      const result = parser.parseUsageExamples('', true);
      expect(result).toEqual([]);
    });

    it('should extract code examples from usage sections', () => {
      const readme = `
# MyPackage

Some description.

## Usage

Here's how to use this package:

\`\`\`csharp
using MyPackage;
var service = new MyService();
service.DoSomething();
\`\`\`

## Installation

Install via NuGet:

\`\`\`bash
dotnet add package MyPackage
\`\`\`
`;

      const result = parser.parseUsageExamples(readme, true);
      expect(result).toHaveLength(2);
      
      expect(result[0]).toEqual({
        title: 'Using Statement',
        description: "Here's how to use this package:",
        code: 'using MyPackage;\nvar service = new MyService();\nservice.DoSomething();',
        language: 'csharp',
      });

      expect(result[1]).toEqual({
        title: 'Installation',
        description: 'Install via NuGet:',
        code: 'dotnet add package MyPackage',
        language: 'bash',
      });
    });

    it('should handle code blocks without language specification', () => {
      const readme = `
# Usage

Example:

\`\`\`
var x = 1;
\`\`\`
`;

      const result = parser.parseUsageExamples(readme, true);
      expect(result).toHaveLength(1);
      expect(result[0].language).toBe('text');
      expect(result[0].code).toBe('var x = 1;');
    });

    it('should skip empty code blocks', () => {
      const readme = `
# Usage

\`\`\`csharp
\`\`\`

\`\`\`csharp
var x = 1;
\`\`\`
`;

      const result = parser.parseUsageExamples(readme, true);
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('var x = 1;');
    });

    it('should deduplicate similar examples', () => {
      const readme = `
# Usage

\`\`\`csharp
var x = 1;
\`\`\`

\`\`\`csharp
var  x  =  1;
\`\`\`
`;

      const result = parser.parseUsageExamples(readme, true);
      expect(result).toHaveLength(1);
    });

    it('should limit to maximum number of examples', () => {
      const codeBlocks = Array.from({ length: 15 }, (_, i) => `\`\`\`csharp\nvar x${i} = ${i};\n\`\`\``).join('\n\n');
      const readme = `# Usage\n\n${codeBlocks}`;

      const result = parser.parseUsageExamples(readme, true);
      expect(result.length).toBeLessThanOrEqual(10); // MAX_EXAMPLES
    });

    it('should handle malformed README gracefully', () => {
      const readme = '```csharp\nunclosed code block...';
      const result = parser.parseUsageExamples(readme, true);
      expect(result).toEqual([]);
    });
  });

  describe('generateExampleTitle', () => {
    it('should generate appropriate titles for different languages', () => {
      const testCases = [
        { code: 'dotnet add package Test', language: 'bash', expected: 'Installation' },
        { code: 'Install-Package Test', language: 'powershell', expected: 'Installation' },
        { code: 'paket add Test', language: 'shell', expected: 'Installation' },
        { code: 'ls -la', language: 'bash', expected: 'Command Line Usage' },
        { code: 'using System;', language: 'csharp', expected: 'Using Statement' },
        { code: 'var x = 1;', language: 'csharp', expected: 'C# Example' },
        { code: 'class MyClass {}', language: 'csharp', expected: 'C# Example' },
        { code: 'public void Method() {}', language: 'csharp', expected: 'C# Example' },
        { code: 'let x = 1', language: 'fsharp', expected: 'F# Example' },
        { code: 'Dim x As Integer', language: 'vbnet', expected: 'VB.NET Example' },
        { code: '<PackageReference Include="Test" />', language: 'xml', expected: 'Project Configuration' },
        { code: '<configuration>', language: 'xml', expected: 'XML Configuration' },
        { code: '{ "name": "test" }', language: 'json', expected: 'JSON Configuration' },
        { code: 'name: test', language: 'yaml', expected: 'YAML Configuration' },
        { code: 'some code', language: 'unknown', expected: 'Code Example' },
      ];

      for (const { code, language, expected } of testCases) {
        const result = (parser as any).generateExampleTitle(code, language);
        expect(result).toBe(expected);
      }
    });
  });

  describe('normalizeLanguage', () => {
    it('should normalize language aliases correctly', () => {
      const testCases = [
        { input: 'cs', expected: 'csharp' },
        { input: 'c#', expected: 'csharp' },
        { input: 'fs', expected: 'fsharp' },
        { input: 'f#', expected: 'fsharp' },
        { input: 'vb', expected: 'vbnet' },
        { input: 'js', expected: 'javascript' },
        { input: 'ts', expected: 'typescript' },
        { input: 'sh', expected: 'bash' },
        { input: 'shell', expected: 'bash' },
        { input: 'ps1', expected: 'powershell' },
        { input: 'yml', expected: 'yaml' },
        { input: 'md', expected: 'markdown' },
        { input: 'python', expected: 'python' }, // unchanged
      ];

      for (const { input, expected } of testCases) {
        const result = (parser as any).normalizeLanguage(input);
        expect(result).toBe(expected);
      }
    });
  });

  describe('cleanMarkdown', () => {
    it('should remove badges but keep meaningful alt text', () => {
      const markdown = '![Build Status](https://example.com/badge.svg) ![Coverage](https://example.com/coverage.svg)';
      const result = parser.cleanMarkdown(markdown);
      expect(result).toBe('Build Status Coverage');
    });

    it('should remove badges with meaningless alt text', () => {
      const markdown = '![](https://example.com/badge.svg) ![x](https://example.com/coverage.svg)';
      const result = parser.cleanMarkdown(markdown);
      expect(result).toBe('');
    });

    it('should convert relative links to text', () => {
      const markdown = 'See [documentation](./docs/README.md) and [API](https://example.com/api)';
      const result = parser.cleanMarkdown(markdown);
      expect(result).toBe('See documentation and [API](https://example.com/api)');
    });

    it('should clean up excessive whitespace', () => {
      const markdown = 'Line 1\n\n\n\nLine 2\n\n\n\n\nLine 3';
      const result = parser.cleanMarkdown(markdown);
      expect(result).toBe('Line 1\n\nLine 2\n\nLine 3');
    });

    it('should handle malformed markdown gracefully', () => {
      const malformed = '![unclosed';
      const result = parser.cleanMarkdown(malformed);
      expect(result).toBe(malformed);
    });
  });

  describe('extractDescription', () => {
    it('should extract first meaningful paragraph', () => {
      const readme = `
# MyPackage

![Build](https://example.com/badge.svg)

This is a useful package that does amazing things. It provides a simple API for complex operations.

## Installation

Install via NuGet.
`;

      const result = parser.extractDescription(readme);
      expect(result).toBe('This is a useful package that does amazing things. It provides a simple API for complex operations.');
    });

    it('should skip headers and badges', () => {
      const readme = `
# MyPackage
## Another Header
![Badge](https://example.com/badge.svg)
[![Another Badge](https://example.com/badge2.svg)](https://example.com)

This is the actual description.
`;

      const result = parser.extractDescription(readme);
      expect(result).toBe('This is the actual description.');
    });

    it('should combine continuation text within limits', () => {
      const readme = `
# Package

Short description here. This continues the description with more details.
`;

      const result = parser.extractDescription(readme);
      expect(result).toBe('Short description here. This continues the description with more details.');
    });

    it('should stop at paragraph length limit', () => {
      const longText = 'A'.repeat(150);
      const veryLongText = 'B'.repeat(200);
      const readme = `
# Package

${longText}
${veryLongText}
`;

      const result = parser.extractDescription(readme);
      expect(result).toBe(longText);
    });

    it('should return default message for empty or short content', () => {
      const readme = `
# Package

x
`;

      const result = parser.extractDescription(readme);
      expect(result).toBe('No description available');
    });

    it('should handle malformed content gracefully', () => {
      const result = parser.extractDescription('');
      expect(result).toBe('No description available');
    });
  });

  describe('looksLikeCode', () => {
    it('should identify code-like text', () => {
      const testCases = [
        { text: '{ key: value }', expected: true },
        { text: 'function test() {', expected: true },
        { text: 'using System;', expected: true },
        { text: 'var x = 1;', expected: true },
        { text: 'class MyClass', expected: true },
        { text: 'public string Name', expected: true },
        { text: 'namespace MyApp', expected: true },
        { text: '$ dotnet run', expected: true },
        { text: '// This is a comment', expected: true },
        { text: '# Shell comment', expected: true },
        { text: '<configuration>', expected: true },
        { text: 'This is normal text.', expected: false },
        { text: 'A simple description here.', expected: false },
      ];

      for (const { text, expected } of testCases) {
        const result = (parser as any).looksLikeCode(text);
        expect(result).toBe(expected);
      }
    });
  });

  describe('extractExampleDescription', () => {
    it('should extract description before code block', () => {
      const section = `
## Usage

This shows how to use the feature:

\`\`\`csharp
var x = 1;
\`\`\`
`;

      const codeBlockIndex = section.indexOf('```csharp');
      const result = (parser as any).extractExampleDescription(section, codeBlockIndex);
      expect(result).toBe('This shows how to use the feature:');
    });

    it('should remove bullet points from descriptions', () => {
      const section = `
## Usage

* This is a bullet point description

\`\`\`csharp
var x = 1;
\`\`\`
`;

      const codeBlockIndex = section.indexOf('```csharp');
      const result = (parser as any).extractExampleDescription(section, codeBlockIndex);
      expect(result).toBe('This is a bullet point description');
    });

    it('should skip code-like text', () => {
      const section = `
## Usage

var setup = new Setup();

\`\`\`csharp
var x = 1;
\`\`\`
`;

      const codeBlockIndex = section.indexOf('```csharp');
      const result = (parser as any).extractExampleDescription(section, codeBlockIndex);
      expect(result).toBeUndefined();
    });

    it('should skip text that is too short or too long', () => {
      const shortSection = `
## Usage

Short

\`\`\`csharp
var x = 1;
\`\`\`
`;

      const longText = 'A'.repeat(250);
      const longSection = `
## Usage

${longText}

\`\`\`csharp
var x = 1;
\`\`\`
`;

      const shortCodeBlockIndex = shortSection.indexOf('```csharp');
      const longCodeBlockIndex = longSection.indexOf('```csharp');
      
      expect((parser as any).extractExampleDescription(shortSection, shortCodeBlockIndex)).toBeUndefined();
      expect((parser as any).extractExampleDescription(longSection, longCodeBlockIndex)).toBeUndefined();
    });
  });
});