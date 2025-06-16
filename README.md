# NuGet Package README MCP Server

A Model Context Protocol (MCP) server for fetching NuGet package README files and usage information. This server provides tools to search, retrieve, and analyze .NET packages from the NuGet registry.

## Features

- **Package README Retrieval**: Fetch README content and extract usage examples from NuGet packages
- **Package Information**: Get detailed package metadata including dependencies, authors, and licensing
- **Package Search**: Search the NuGet registry with filtering capabilities
- **Intelligent Caching**: Memory-based caching with TTL and LRU eviction
- **GitHub Integration**: Fallback to GitHub for README content when not available in NuGet
- **Usage Example Extraction**: Automatically parse and categorize code examples from README files

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm, yarn, or pnpm

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

## Usage

### As an MCP Server

The server can be used with any MCP-compatible client (like Claude Desktop):

```json
{
  "mcpServers": {
    "nuget-package-readme": {
      "command": "node",
      "args": ["/path/to/nuget-package-readme-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

### Development

```bash
# Start in development mode
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Available Tools

### 1. get_package_readme

Fetches a package's README content and extracts usage examples.

**Parameters:**
- `package_name` (string, required): The NuGet package name
- `version` (string, optional): Package version (default: "latest")
- `include_examples` (boolean, optional): Whether to extract usage examples (default: true)

**Example:**
```typescript
{
  "package_name": "Newtonsoft.Json",
  "version": "latest",
  "include_examples": true
}
```

### 2. get_package_info

Retrieves detailed package information including metadata and dependencies.

**Parameters:**
- `package_name` (string, required): The NuGet package name
- `include_dependencies` (boolean, optional): Include dependency information (default: true)
- `include_dev_dependencies` (boolean, optional): Include development dependencies (default: false)

**Example:**
```typescript
{
  "package_name": "Microsoft.Extensions.DependencyInjection",
  "include_dependencies": true
}
```

### 3. search_packages

Searches for packages in the NuGet registry.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Maximum results to return (default: 20, max: 250)
- `quality` (number, optional): Minimum quality score 0-1
- `popularity` (number, optional): Minimum popularity score 0-1

**Example:**
```typescript
{
  "query": "json serialization",
  "limit": 10,
  "quality": 0.7
}
```

## API Integration

### NuGet APIs Used

- **NuGet V3 Flat Container**: `https://api.nuget.org/v3-flatcontainer/` - Package metadata and versions
- **NuGet Search API**: `https://azuresearch-usnc.nuget.org/query` - Package search functionality

### GitHub API

- **Repository README**: Used as fallback when NuGet packages don't include README content
- **Authentication**: Optional GitHub token for higher rate limits

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: GitHub personal access token for API requests (optional but recommended)
- `LOG_LEVEL`: Logging level (debug, info, warn, error) - default: warn
- `CACHE_TTL`: Cache time-to-live in milliseconds - default: 3600000 (1 hour)
- `CACHE_MAX_SIZE`: Maximum cache size in bytes - default: 104857600 (100MB)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  NuGet Package  │───▶│   NuGet API     │
│   (Claude etc)  │    │  README Server  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │   GitHub API    │
                       │   (Fallback)    │
                       └─────────────────┘
```

### Components

- **Tools**: Implementation of the three main MCP tools
- **Services**: 
  - `nuget-api.ts`: NuGet API client
  - `github-api.ts`: GitHub API client for README fallback
  - `cache.ts`: Memory caching with TTL and LRU
  - `readme-parser.ts`: README content parsing and example extraction
- **Utils**: Logging, error handling, and validation utilities

## Data Types

### Installation Commands

```typescript
interface InstallationInfo {
  dotnet: string;          // "dotnet add package PackageName"
  packageManager?: string; // "Install-Package PackageName"
  paket?: string;         // "paket add PackageName"
}
```

### Usage Examples

The server automatically extracts and categorizes code examples:

- **C# Examples**: Using statements, class definitions, method implementations
- **XML Configuration**: Project file references, configuration files
- **PowerShell**: Package Manager Console commands
- **Installation Commands**: dotnet CLI, Package Manager, Paket

## Caching Strategy

- **Memory Cache**: In-memory LRU cache with configurable TTL
- **Cache Keys**: Structured keys for different data types
- **TTL**: 1 hour for package data, 10 minutes for search results
- **Size Limit**: 100MB default with automatic LRU eviction

## Error Handling

- **Package Not Found**: Returns appropriate 404 errors
- **Rate Limiting**: Automatic retry with exponential backoff
- **Network Errors**: Graceful degradation with fallback mechanisms
- **Validation**: Input parameter validation with descriptive errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and type checking
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- [npm-package-readme-mcp-server](../npm-package-readme-mcp-server): Similar server for npm packages
- [composer-package-readme-mcp-server](../composer-package-readme-mcp-server): Similar server for Composer packages

## Support

For issues and questions:
1. Check existing GitHub issues
2. Create a new issue with detailed information
3. Include logs and reproduction steps