import { 
  BasePackageServer, 
  MCPToolDefinition as ToolDefinition, 
  PackageReadmeMcpError, 
} from '@elchika-inc/package-readme-shared';
import { getPackageReadme } from './tools/get-package-readme.js';
import { getPackageInfo } from './tools/get-package-info.js';
import { searchPackages } from './tools/search-packages.js';
import {
  validateArgs,
  validateRequiredString,
  validateOptionalString,
  validateOptionalBoolean,
  validateOptionalNumber,
} from './utils/validation-helper.js';
import type {
  GetPackageReadmeParams,
  GetPackageInfoParams,
  SearchPackagesParams,
} from './types/index.js';

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_readme_from_nuget: {
    name: 'get_readme_from_nuget',
    description: 'Get package README and usage examples from NuGet registry',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the NuGet package',
        },
        version: {
          type: 'string',
          description: 'The version of the package (default: "latest")',
          default: 'latest',
        },
        include_examples: {
          type: 'boolean',
          description: 'Whether to include usage examples (default: true)',
          default: true,
        }
      },
      required: ['package_name'],
    }
  },
  get_package_info_from_nuget: {
    name: 'get_package_info_from_nuget',
    description: 'Get package basic information and dependencies from NuGet registry',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the NuGet package',
        },
        include_dependencies: {
          type: 'boolean',
          description: 'Whether to include dependencies (default: true)',
          default: true,
        },
        include_dev_dependencies: {
          type: 'boolean',
          description: 'Whether to include development dependencies (default: false)',
          default: false,
        }
      },
      required: ['package_name'],
    }
  },
  search_packages_from_nuget: {
    name: 'search_packages_from_nuget',
    description: 'Search for packages in NuGet registry',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
          default: 20,
          minimum: 1,
          maximum: 250,
        },
        quality: {
          type: 'number',
          description: 'Minimum quality score (0-1)',
          minimum: 0,
          maximum: 1,
        },
        popularity: {
          type: 'number',
          description: 'Minimum popularity score (0-1)',
          minimum: 0,
          maximum: 1,
        }
      },
      required: ['query'],
    }
  },
} as const;

export class NuGetPackageReadmeMcpServer extends BasePackageServer {
  constructor() {
    super({
      name: 'nuget-package-readme-mcp',
      version: '1.0.0',
    });
  }

  protected getToolDefinitions(): Record<string, ToolDefinition> {
    return TOOL_DEFINITIONS;
  }

  protected async handleToolCall(name: string, args: unknown): Promise<unknown> {
    // Validate that args is an object
    if (!args || typeof args !== 'object') {
      throw new PackageReadmeMcpError(
        'Tool arguments must be an object',
        'VALIDATION_ERROR'
      );
    }

    switch (name) {
      case 'get_readme_from_nuget':
        return await this.handleGetPackageReadme(this.validateGetPackageReadmeParams(args));
      
      case 'get_package_info_from_nuget':
        return await this.handleGetPackageInfo(this.validateGetPackageInfoParams(args));
      
      case 'search_packages_from_nuget':
        return await this.handleSearchPackages(this.validateSearchPackagesParams(args));
      
      default:
        throw new PackageReadmeMcpError(
          `Unknown tool: ${name}`,
          'VALIDATION_ERROR'
        );
    }
  }

  private async handleGetPackageReadme(params: GetPackageReadmeParams) {
    return await getPackageReadme(params);
  }

  private async handleGetPackageInfo(params: GetPackageInfoParams) {
    return await getPackageInfo(params);
  }

  private async handleSearchPackages(params: SearchPackagesParams) {
    return await searchPackages(params);
  }

  private validateGetPackageReadmeParams(args: unknown): GetPackageReadmeParams {
    const params = validateArgs(args);
    
    return {
      package_name: validateRequiredString(params.package_name, 'package_name'),
      version: validateOptionalString(params.version, 'latest'),
      include_examples: validateOptionalBoolean(params.include_examples, true),
    };
  }

  private validateGetPackageInfoParams(args: unknown): GetPackageInfoParams {
    const params = validateArgs(args);
    
    return {
      package_name: validateRequiredString(params.package_name, 'package_name'),
      include_dependencies: validateOptionalBoolean(params.include_dependencies, true),
      include_dev_dependencies: validateOptionalBoolean(params.include_dev_dependencies, false),
    };
  }

  private validateSearchPackagesParams(args: unknown): SearchPackagesParams {
    const params = validateArgs(args);
    
    const result: SearchPackagesParams = {
      query: validateRequiredString(params.query, 'query'),
    };
    
    const limit = validateOptionalNumber(params.limit, 1, 250, 'limit');
    if (limit !== undefined) {
      result.limit = limit;
    }
    
    const quality = validateOptionalNumber(params.quality, 0, 1, 'quality');
    if (quality !== undefined) {
      result.quality = quality;
    }
    
    const popularity = validateOptionalNumber(params.popularity, 0, 1, 'popularity');
    if (popularity !== undefined) {
      result.popularity = popularity;
    }
    
    return result;
  }

}

export default NuGetPackageReadmeMcpServer;