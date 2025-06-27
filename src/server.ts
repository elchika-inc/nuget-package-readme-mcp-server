import { 
  BasePackageServer, 
  MCPToolDefinition as ToolDefinition, 
  PackageReadmeMcpError, 
} from '@elchika-inc/package-readme-shared';
import { getPackageReadme } from './tools/get-package-readme.js';
import { getPackageInfo } from './tools/get-package-info.js';
import { searchPackages } from './tools/search-packages.js';
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
    if (!args || typeof args !== 'object') {
      throw new PackageReadmeMcpError('Tool arguments must be an object', 'VALIDATION_ERROR');
    }
    
    const params = args as Record<string, unknown>;
    
    if (!params.package_name || typeof params.package_name !== 'string') {
      throw new PackageReadmeMcpError('package_name is required and must be a string', 'VALIDATION_ERROR');
    }
    
    return {
      package_name: params.package_name,
      version: typeof params.version === 'string' ? params.version : 'latest',
      include_examples: typeof params.include_examples === 'boolean' ? params.include_examples : true,
    };
  }

  private validateGetPackageInfoParams(args: unknown): GetPackageInfoParams {
    if (!args || typeof args !== 'object') {
      throw new PackageReadmeMcpError('Tool arguments must be an object', 'VALIDATION_ERROR');
    }
    
    const params = args as Record<string, unknown>;
    
    if (!params.package_name || typeof params.package_name !== 'string') {
      throw new PackageReadmeMcpError('package_name is required and must be a string', 'VALIDATION_ERROR');
    }
    
    return {
      package_name: params.package_name,
      include_dependencies: typeof params.include_dependencies === 'boolean' ? params.include_dependencies : true,
      include_dev_dependencies: typeof params.include_dev_dependencies === 'boolean' ? params.include_dev_dependencies : false,
    };
  }

  private validateSearchPackagesParams(args: unknown): SearchPackagesParams {
    if (!args || typeof args !== 'object') {
      throw new PackageReadmeMcpError('Tool arguments must be an object', 'VALIDATION_ERROR');
    }
    
    const params = args as Record<string, unknown>;
    
    if (!params.query || typeof params.query !== 'string') {
      throw new PackageReadmeMcpError('query is required and must be a string', 'VALIDATION_ERROR');
    }
    
    const result: SearchPackagesParams = {
      query: params.query,
    };
    
    if (params.limit !== undefined) {
      if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 250) {
        throw new PackageReadmeMcpError('limit must be a number between 1 and 250', 'VALIDATION_ERROR');
      }
      result.limit = params.limit;
    }
    
    if (params.quality !== undefined) {
      if (typeof params.quality !== 'number' || params.quality < 0 || params.quality > 1) {
        throw new PackageReadmeMcpError('quality must be a number between 0 and 1', 'VALIDATION_ERROR');
      }
      result.quality = params.quality;
    }
    
    if (params.popularity !== undefined) {
      if (typeof params.popularity !== 'number' || params.popularity < 0 || params.popularity > 1) {
        throw new PackageReadmeMcpError('popularity must be a number between 0 and 1', 'VALIDATION_ERROR');
      }
      result.popularity = params.popularity;
    }
    
    return result;
  }

}

export default NuGetPackageReadmeMcpServer;