import { logger } from './logger.js';
import type { NuSpecPackage } from '../types/index.js';

export class NuSpecParser {
  static async parseNuSpec(xmlText: string): Promise<NuSpecPackage> {
    try {
      const getId = (xml: string): string => {
        const match = xml.match(/<id>([^<]+)<\/id>/i);
        return match ? match[1].trim() : '';
      };

      const getVersion = (xml: string): string => {
        const match = xml.match(/<version>([^<]+)<\/version>/i);
        return match ? match[1].trim() : '';
      };

      const getDescription = (xml: string): string => {
        const match = xml.match(/<description>([^<]+)<\/description>/i);
        return match ? match[1].trim() : '';
      };

      const getAuthors = (xml: string): string => {
        const match = xml.match(/<authors>([^<]+)<\/authors>/i);
        return match ? match[1].trim() : '';
      };

      const getLicense = (xml: string): string => {
        const licenseMatch = xml.match(/<license[^>]*>([^<]+)<\/license>/i);
        const licenseUrlMatch = xml.match(/<licenseUrl>([^<]+)<\/licenseUrl>/i);
        const licenseExpressionMatch = xml.match(/<licenseExpression>([^<]+)<\/licenseExpression>/i);
        
        return licenseExpressionMatch?.[1] || licenseMatch?.[1] || licenseUrlMatch?.[1] || 'Unknown';
      };

      const getTags = (xml: string): string => {
        const match = xml.match(/<tags>([^<]+)<\/tags>/i);
        return match ? match[1].trim() : '';
      };

      const getProjectUrl = (xml: string): string | undefined => {
        const match = xml.match(/<projectUrl>([^<]+)<\/projectUrl>/i);
        return match ? match[1].trim() : undefined;
      };

      const getTitle = (xml: string): string | undefined => {
        const match = xml.match(/<title>([^<]+)<\/title>/i);
        return match ? match[1].trim() : undefined;
      };

      const nuspec: NuSpecPackage = {
        package: {
          metadata: {
            id: getId(xmlText),
            version: getVersion(xmlText),
            title: getTitle(xmlText),
            authors: getAuthors(xmlText),
            description: getDescription(xmlText),
            tags: getTags(xmlText),
            projectUrl: getProjectUrl(xmlText),
            licenseExpression: getLicense(xmlText),
          },
        },
      };

      return nuspec;
    } catch (error) {
      logger.error('Failed to parse NuSpec XML', { error });
      throw new Error('Failed to parse package metadata');
    }
  }
}