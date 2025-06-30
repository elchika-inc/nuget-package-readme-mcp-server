import { MarkdownCleaner } from './markdown-cleaner.js';
import { CodeBlockExtractor } from './code-block-extractor.js';
import type { UsageExample } from '../types/index.js';

export class ReadmeParser {
  static parseUsageExamples(readmeContent: string, includeExamples: boolean = true): UsageExample[] {
    return CodeBlockExtractor.extractUsageExamples(readmeContent, includeExamples);
  }

  static cleanMarkdown(content: string): string {
    return MarkdownCleaner.cleanMarkdown(content);
  }

  static extractDescription(content: string, maxLength?: number): string {
    return MarkdownCleaner.extractDescription(content, maxLength);
  }
}

export const readmeParser = new ReadmeParser();