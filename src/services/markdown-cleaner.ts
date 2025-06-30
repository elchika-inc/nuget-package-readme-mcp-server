export class MarkdownCleaner {
  private static readonly BADGE_PATTERN = /!\[[^\]]*\]\([^)]+\)/g;
  private static readonly RELATIVE_LINK_PATTERN = /\[([^\]]+)\]\((?!https?:\/\/)[^)]+\)/g;
  private static readonly EXCESSIVE_WHITESPACE_PATTERN = /\n{3,}/g;
  private static readonly MEANINGLESS_ALT_TEXTS = ['build', 'status', 'badge', 'license', 'version', 'downloads', 'coverage'];

  static cleanMarkdown(content: string): string {
    if (!content) {
      return '';
    }

    let cleaned = content;

    // Remove badges but keep meaningful alt text
    cleaned = cleaned.replace(this.BADGE_PATTERN, (match) => {
      const altTextMatch = match.match(/!\[([^\]]*)\]/);
      if (altTextMatch) {
        const altText = altTextMatch[1].toLowerCase();
        const isMeaningless = this.MEANINGLESS_ALT_TEXTS.some(meaningless => 
          altText.includes(meaningless)
        );
        return isMeaningless ? '' : altText;
      }
      return '';
    });

    // Convert relative links to text
    cleaned = cleaned.replace(this.RELATIVE_LINK_PATTERN, '$1');

    // Clean up excessive whitespace
    cleaned = cleaned.replace(this.EXCESSIVE_WHITESPACE_PATTERN, '\n\n');

    return cleaned.trim();
  }

  static extractDescription(content: string, maxLength: number = 300): string {
    if (!content) {
      return 'No description available';
    }

    const lines = content.split('\n');
    let description = '';
    let paragraphLength = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip headers, badges, and empty lines
      if (!trimmedLine || 
          trimmedLine.startsWith('#') || 
          trimmedLine.startsWith('![')||
          this.looksLikeCode(trimmedLine)) {
        continue;
      }

      // Start collecting meaningful content
      if (description) {
        description += ' ';
      }
      description += trimmedLine;
      paragraphLength += trimmedLine.length;

      // Stop if we've reached a reasonable paragraph length
      if (paragraphLength >= maxLength) {
        break;
      }
    }

    if (description.length < 20) {
      return 'No meaningful description available';
    }

    // Truncate if too long
    if (description.length > maxLength) {
      description = description.substring(0, maxLength).trim() + '...';
    }

    return description;
  }

  private static looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /[{}()[\];]/,  // Code punctuation
      /\w+\(\)/,     // Function calls
      /^\s*[a-zA-Z_]\w*\s*[:=]/,  // Variable assignments
      /^\s*import\s+/,  // Import statements
      /^\s*using\s+/,   // Using statements
    ];

    return codeIndicators.some(pattern => pattern.test(text));
  }
}