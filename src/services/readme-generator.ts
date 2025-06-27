import type { NuSpecPackage } from '../types/index.js';

export class ReadmeGenerator {
  static createEnhancedFallbackReadme(packageMetadata: NuSpecPackage, catalogEntry: any): string {
    const metadata = packageMetadata.package.metadata;
    
    let readme = `# ${metadata.title || metadata.id}\n\n`;
    
    const description = catalogEntry.description || metadata.description;
    if (description) {
      readme += `${description}\n\n`;
    }
    
    if (catalogEntry.summary && catalogEntry.summary !== description) {
      readme += `## Summary\n\n${catalogEntry.summary}\n\n`;
    }
    
    if (catalogEntry.releaseNotes) {
      readme += `## Release Notes\n\n${catalogEntry.releaseNotes}\n\n`;
    }
    
    if (metadata.authors) {
      readme += `**Authors:** ${metadata.authors}\n\n`;
    }
    
    if (metadata.tags) {
      const tags = metadata.tags.split(' ').filter((tag: string) => tag.trim().length > 0);
      if (tags.length > 0) {
        readme += `**Tags:** ${tags.join(', ')}\n\n`;
      }
    }
    
    readme += `## Installation\n\n`;
    readme += `\`\`\`bash\n`;
    readme += `dotnet add package ${metadata.id}\n`;
    readme += `\`\`\`\n\n`;
    
    readme += `Or via Package Manager Console:\n\n`;
    readme += `\`\`\`powershell\n`;
    readme += `Install-Package ${metadata.id}\n`;
    readme += `\`\`\`\n\n`;
    
    if (metadata.projectUrl) {
      readme += `For more information, visit the [project page](${metadata.projectUrl}).\n\n`;
    }
    
    return readme;
  }

  static createFallbackReadme(packageMetadata: NuSpecPackage): string {
    const metadata = packageMetadata.package.metadata;
    
    let readme = `# ${metadata.title || metadata.id}\n\n`;
    
    if (metadata.description) {
      readme += `${metadata.description}\n\n`;
    }
    
    if (metadata.authors) {
      readme += `**Authors:** ${metadata.authors}\n\n`;
    }
    
    if (metadata.tags) {
      const tags = metadata.tags.split(' ').filter((tag: string) => tag.trim().length > 0);
      if (tags.length > 0) {
        readme += `**Tags:** ${tags.join(', ')}\n\n`;
      }
    }
    
    readme += `## Installation\n\n`;
    readme += `\`\`\`bash\n`;
    readme += `dotnet add package ${metadata.id}\n`;
    readme += `\`\`\`\n\n`;
    
    readme += `Or via Package Manager Console:\n\n`;
    readme += `\`\`\`powershell\n`;
    readme += `Install-Package ${metadata.id}\n`;
    readme += `\`\`\`\n\n`;
    
    if (metadata.projectUrl) {
      readme += `For more information, visit the [project page](${metadata.projectUrl}).\n\n`;
    }
    
    return readme;
  }
}