import type { NuSpecPackage, NuGetEnhancedMetadata } from '../types/index.js';

export class ReadmeGenerator {
  static createEnhancedFallbackReadme(packageMetadata: NuSpecPackage, enhancedMetadata: NuGetEnhancedMetadata): string {
    const packageInfo = packageMetadata.package.metadata;
    
    let readmeContent = `# ${packageInfo.title || packageInfo.id}\n\n`;
    
    const packageDescription = enhancedMetadata.description || packageInfo.description;
    if (packageDescription) {
      readmeContent += `${packageDescription}\n\n`;
    }
    
    if (enhancedMetadata.summary && enhancedMetadata.summary !== packageDescription) {
      readmeContent += `## Summary\n\n${enhancedMetadata.summary}\n\n`;
    }
    
    if (enhancedMetadata.releaseNotes) {
      readmeContent += `## Release Notes\n\n${enhancedMetadata.releaseNotes}\n\n`;
    }
    
    if (packageInfo.authors) {
      readmeContent += `**Authors:** ${packageInfo.authors}\n\n`;
    }
    
    if (packageInfo.tags) {
      const parsedTags = packageInfo.tags.split(' ').filter((tag: string) => tag.trim().length > 0);
      if (parsedTags.length > 0) {
        readmeContent += `**Tags:** ${parsedTags.join(', ')}\n\n`;
      }
    }
    
    readmeContent += `## Installation\n\n`;
    readmeContent += `\`\`\`bash\n`;
    readmeContent += `dotnet add package ${packageInfo.id}\n`;
    readmeContent += `\`\`\`\n\n`;
    
    readmeContent += `Or via Package Manager Console:\n\n`;
    readmeContent += `\`\`\`powershell\n`;
    readmeContent += `Install-Package ${packageInfo.id}\n`;
    readmeContent += `\`\`\`\n\n`;
    
    if (packageInfo.projectUrl) {
      readmeContent += `**Project URL:** [${packageInfo.projectUrl}](${packageInfo.projectUrl})\n\n`;
    }
    
    if (packageInfo.licenseExpression || packageInfo.licenseUrl) {
      const licenseText = packageInfo.licenseExpression || 'See license URL';
      const licenseInfo = packageInfo.licenseUrl 
        ? `[${licenseText}](${packageInfo.licenseUrl})`
        : licenseText;
      readmeContent += `**License:** ${licenseInfo}\n\n`;
    }
    
    return readmeContent;
  }

  static createFallbackReadme(packageMetadata: NuSpecPackage): string {
    const packageInfo = packageMetadata.package.metadata;
    
    let readmeContent = `# ${packageInfo.title || packageInfo.id}\n\n`;
    
    if (packageInfo.description) {
      readmeContent += `${packageInfo.description}\n\n`;
    }
    
    readmeContent += `## Installation\n\n`;
    readmeContent += `Install this package using one of the following methods:\n\n`;
    
    readmeContent += `### .NET CLI\n`;
    readmeContent += `\`\`\`bash\n`;
    readmeContent += `dotnet add package ${packageInfo.id}\n`;
    readmeContent += `\`\`\`\n\n`;
    
    readmeContent += `### Package Manager Console\n`;
    readmeContent += `\`\`\`powershell\n`;
    readmeContent += `Install-Package ${packageInfo.id}\n`;
    readmeContent += `\`\`\`\n\n`;
    
    readmeContent += `### PackageReference\n`;
    readmeContent += `\`\`\`xml\n`;
    readmeContent += `<PackageReference Include="${packageInfo.id}" Version="${packageInfo.version}" />\n`;
    readmeContent += `\`\`\`\n\n`;
    
    if (packageInfo.authors) {
      readmeContent += `**Authors:** ${packageInfo.authors}\n\n`;
    }
    
    if (packageInfo.tags) {
      const parsedTags = packageInfo.tags.split(' ').filter((tag: string) => tag.trim().length > 0);
      if (parsedTags.length > 0) {
        readmeContent += `**Tags:** ${parsedTags.join(', ')}\n\n`;
      }
    }
    
    if (packageInfo.projectUrl) {
      readmeContent += `**Project URL:** [${packageInfo.projectUrl}](${packageInfo.projectUrl})\n\n`;
    }
    
    if (packageInfo.licenseExpression || packageInfo.licenseUrl) {
      const licenseText = packageInfo.licenseExpression || 'See license URL';
      const licenseInfo = packageInfo.licenseUrl 
        ? `[${licenseText}](${packageInfo.licenseUrl})`
        : licenseText;
      readmeContent += `**License:** ${licenseInfo}\n\n`;
    }
    
    return readmeContent;
  }
}