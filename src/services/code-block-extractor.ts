import { logger } from '../utils/logger.js';
import type { UsageExample } from '../types/index.js';

export class CodeBlockExtractor {
  private static readonly USAGE_SECTION_PATTERNS = [
    /^#{1,6}\s*(usage|use|using|how to use|getting started|quick start|examples?|basic usage|installation)\s*$/gim,
    /^usage:?\s*$/gim,
    /^examples?:?\s*$/gim,
    /^installation:?\s*$/gim,
  ];

  private static readonly CODE_BLOCK_PATTERN = /```(\w+)?\n([\s\S]*?)```/g;
  private static readonly MAX_EXAMPLES = 10;
  private static readonly MIN_DESCRIPTION_LENGTH = 10;
  private static readonly MAX_DESCRIPTION_LENGTH = 200;

  private static readonly LANGUAGE_ALIASES: Record<string, string> = {
    'cs': 'csharp',
    'c#': 'csharp',
    'fs': 'fsharp',
    'f#': 'fsharp',
    'vb': 'vbnet',
    'vb.net': 'vbnet',
    'ps1': 'powershell',
    'ps': 'powershell',
    'yaml': 'yml',
    'shell': 'bash',
    'sh': 'bash',
  };

  static extractUsageExamples(readmeContent: string, includeExamples: boolean = true): UsageExample[] {
    if (!includeExamples || !readmeContent) {
      return [];
    }

    try {
      const examples: UsageExample[] = [];
      const sections = this.extractUsageSections(readmeContent);

      for (const section of sections) {
        const sectionExamples = this.extractCodeBlocksFromSection(section);
        examples.push(...sectionExamples);
      }

      // Deduplicate examples based on code content
      const uniqueExamples = this.deduplicateExamples(examples);
      
      // Limit to reasonable number
      const limitedExamples = uniqueExamples.slice(0, this.MAX_EXAMPLES);

      logger.debug(`Extracted ${limitedExamples.length} usage examples from README`);
      return limitedExamples;
    } catch (error) {
      logger.warn('Failed to parse usage examples from README', { error });
      return [];
    }
  }

  private static extractUsageSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');
    let currentSection: string[] = [];
    let inUsageSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isUsageHeader = this.USAGE_SECTION_PATTERNS.some(pattern => {
        pattern.lastIndex = 0; // Reset regex state
        return pattern.test(line);
      });

      if (isUsageHeader) {
        // Save previous section if exists
        if (currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
        }
        currentSection = [line];
        inUsageSection = true;
      } else if (inUsageSection) {
        // Check if we hit another header (new section)
        if (line.match(/^#{1,6}\s+/)) {
          // Save current section and stop
          if (currentSection.length > 0) {
            sections.push(currentSection.join('\n'));
            currentSection = [];
          }
          inUsageSection = false;
        } else {
          currentSection.push(line);
        }
      }
    }

    // Don't forget the last section
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }

    return sections;
  }

  private static extractCodeBlocksFromSection(section: string): UsageExample[] {
    const examples: UsageExample[] = [];
    let match;

    // Reset the regex state
    this.CODE_BLOCK_PATTERN.lastIndex = 0;

    while ((match = this.CODE_BLOCK_PATTERN.exec(section)) !== null) {
      const language = this.normalizeLanguage(match[1] || 'text');
      const code = match[2].trim();

      if (code.length === 0) {
        continue; // Skip empty code blocks
      }

      const description = this.extractExampleDescription(section, match.index);
      const title = this.generateExampleTitle(language, code, description);

      examples.push({
        title,
        description,
        code,
        language,
      });
    }

    return examples;
  }

  private static normalizeLanguage(language: string): string {
    if (!language) return 'text';
    
    const normalized = language.toLowerCase();
    return this.LANGUAGE_ALIASES[normalized] || normalized;
  }

  private static generateExampleTitle(language: string, code: string, description?: string): string {
    if (description && description.length > 5) {
      return description.charAt(0).toUpperCase() + description.slice(1);
    }

    // Generate title based on language and code content
    switch (language) {
      case 'csharp':
      case 'cs':
        return 'C# Example';
      case 'fsharp':
        return 'F# Example';
      case 'vbnet':
        return 'VB.NET Example';
      case 'powershell':
        return 'PowerShell Example';
      case 'xml':
        return 'XML Configuration';
      case 'json':
        return 'JSON Configuration';
      case 'bash':
      case 'shell':
        return 'Command Line Usage';
      default:
        return `${language.charAt(0).toUpperCase() + language.slice(1)} Example`;
    }
  }

  private static extractExampleDescription(section: string, codeBlockIndex: number): string | undefined {
    // Look for text before the code block that could be a description
    const beforeCodeBlock = section.substring(0, codeBlockIndex);
    const lines = beforeCodeBlock.split('\n').reverse();

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('#') || this.looksLikeCode(trimmed)) {
        continue;
      }

      // Remove bullet points and numbering
      const cleaned = trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
      
      if (cleaned.length >= this.MIN_DESCRIPTION_LENGTH && 
          cleaned.length <= this.MAX_DESCRIPTION_LENGTH) {
        return cleaned;
      }
    }

    return undefined;
  }

  private static looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /[{}()[\];]/,  // Code punctuation
      /\w+\(\)/,     // Function calls
      /^\s*[a-zA-Z_]\w*\s*[:=]/,  // Variable assignments
    ];

    return codeIndicators.some(pattern => pattern.test(text));
  }

  private static deduplicateExamples(examples: UsageExample[]): UsageExample[] {
    const seen = new Set<string>();
    const unique: UsageExample[] = [];

    for (const example of examples) {
      // Create a normalized version of the code for comparison
      const normalizedCode = example.code.replace(/\s+/g, ' ').trim().toLowerCase();
      
      if (!seen.has(normalizedCode)) {
        seen.add(normalizedCode);
        unique.push(example);
      }
    }

    return unique;
  }
}