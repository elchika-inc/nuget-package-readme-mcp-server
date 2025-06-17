# NuGet Package README MCP Server

[![npm version](https://img.shields.io/npm/v/nuget-package-readme-mcp-server)](https://www.npmjs.com/package/nuget-package-readme-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/nuget-package-readme-mcp-server)](https://www.npmjs.com/package/nuget-package-readme-mcp-server)
[![GitHub stars](https://img.shields.io/github/stars/naoto24kawa/package-readme-mcp-servers)](https://github.com/naoto24kawa/package-readme-mcp-servers)
[![GitHub issues](https://img.shields.io/github/issues/naoto24kawa/package-readme-mcp-servers)](https://github.com/naoto24kawa/package-readme-mcp-servers/issues)
[![license](https://img.shields.io/npm/l/nuget-package-readme-mcp-server)](https://github.com/naoto24kawa/package-readme-mcp-servers/blob/main/LICENSE)

A Model Context Protocol (MCP) server that provides comprehensive access to NuGet package information, README content, and usage examples. This server enables AI assistants to help developers find, understand, and use .NET packages from the NuGet ecosystem.

## Overview

The NuGet Package README MCP Server bridges the gap between AI assistants and the NuGet package ecosystem, providing intelligent package discovery, detailed metadata retrieval, and README content analysis with automatic usage example extraction.

## Key Features

- 🔍 **Smart Package Search**: Advanced search with quality and popularity filtering
- 📖 **README Retrieval**: Fetch and parse README content from NuGet packages
- 📊 **Package Metadata**: Comprehensive package information including dependencies and licensing
- 💾 **Intelligent Caching**: Memory-based caching with TTL and LRU eviction for optimal performance
- 🔗 **GitHub Integration**: Seamless fallback to GitHub repositories for enhanced README content
- 📝 **Usage Example Extraction**: Automatic parsing and categorization of code examples from documentation
- ⚡ **High Performance**: Optimized API calls with rate limiting and error handling

## Installation

### Prerequisites

Ensure you have the following installed on your system:

- **Node.js**: Version 18.0.0 or higher
- **Package Manager**: npm, yarn, or pnpm
- **Optional**: GitHub Personal Access Token (for enhanced GitHub API access)

### Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd nuget-package-readme-mcp-server
   npm install
   ```

2. **Build the Server**
   ```bash
   npm run build
   ```

3. **Test the Installation**
   ```bash
   npm start
   ```

### Claude Desktop Integration

Add the following configuration to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "nuget-package-readme": {
      "command": "node",
      "args": ["/path/to/nuget-package-readme-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Usage

### Basic Usage Examples

Once integrated with Claude Desktop, you can use natural language to interact with NuGet packages:

- *"Find popular JSON serialization libraries for .NET"*
- *"Get the README for Newtonsoft.Json package"*
- *"Show me usage examples for Microsoft.Extensions.DependencyInjection"*
- *"What are the dependencies of Entity Framework Core?"*

### Development Workflow

```bash
# Development mode with hot reload
npm run dev

# Type checking
npm run typecheck

# Code linting
npm run lint

# Run tests
npm test

# Build for production
npm run build
```

## Available Tools

The server provides three main tools for interacting with NuGet packages:

### 🔍 `search_packages`

Discover NuGet packages using advanced search capabilities.

**Parameters:**
- `query` (string, required): Search terms (e.g., "json", "dependency injection", "logging")
- `limit` (number, optional): Maximum results (default: 20, max: 250)
- `quality` (number, optional): Minimum quality score 0-1 (filters low-quality packages)
- `popularity` (number, optional): Minimum popularity score 0-1 (finds widely-used packages)

**Example Usage:**
```json
{
  "query": "json serialization",
  "limit": 10,
  "quality": 0.7,
  "popularity": 0.5
}
```

### 📖 `get_package_readme`

Retrieve comprehensive README content and usage examples from NuGet packages.

**Parameters:**
- `package_name` (string, required): The exact NuGet package name
- `version` (string, optional): Specific version (default: "latest")
- `include_examples` (boolean, optional): Extract code examples (default: true)

**Example Usage:**
```json
{
  "package_name": "Newtonsoft.Json",
  "version": "13.0.3",
  "include_examples": true
}
```

**Returns:**
- README content in markdown format
- Extracted usage examples categorized by type
- Installation commands (dotnet CLI, Package Manager Console)
- Repository information and links

### 📊 `get_package_info`

Access detailed package metadata, dependencies, and statistics.

**Parameters:**
- `package_name` (string, required): The NuGet package name
- `include_dependencies` (boolean, optional): Include dependency tree (default: true)
- `include_dev_dependencies` (boolean, optional): Include development dependencies (default: false)

**Example Usage:**
```json
{
  "package_name": "Microsoft.Extensions.DependencyInjection",
  "include_dependencies": true,
  "include_dev_dependencies": false
}
```

**Returns:**
- Package metadata (version, description, authors, license)
- Download statistics and popularity metrics
- Dependency information with version constraints
- Repository and project URLs
- Framework compatibility information

## API Integration

### NuGet APIs Used

- **NuGet V3 Flat Container**: `https://api.nuget.org/v3-flatcontainer/` - Package metadata and versions
- **NuGet Search API**: `https://azuresearch-usnc.nuget.org/query` - Package search functionality

### GitHub API

- **Repository README**: Used as fallback when NuGet packages don't include README content
- **Authentication**: Optional GitHub token for higher rate limits

## Configuration

### Environment Variables

Configure the server behavior using these environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub personal access token for enhanced API access | - | No |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `warn` | No |
| `CACHE_TTL` | Cache time-to-live in milliseconds | `3600000` (1 hour) | No |
| `CACHE_MAX_SIZE` | Maximum cache size in bytes | `104857600` (100MB) | No |

### GitHub Token Setup

For optimal performance, configure a GitHub personal access token:

1. Visit [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Generate a new token with `public_repo` scope
3. Add it to your environment configuration

**Benefits of GitHub Token:**
- Higher API rate limits (5,000 vs 60 requests/hour)
- Access to private repository README files
- Better reliability for GitHub API calls

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

## Performance & Limitations

### Performance Characteristics

- **Search Speed**: ~200-500ms per search query
- **README Retrieval**: ~300-800ms per package (varies by source)
- **Package Info**: ~100-300ms per package (cached after first request)
- **Cache Hit Rate**: >90% for popular packages after warm-up

### Rate Limits

- **NuGet API**: No strict limits, but recommended <100 requests/minute
- **GitHub API**: 60 requests/hour (unauthenticated) or 5,000/hour (with token)

### Known Limitations

- Some packages may not have README files available
- GitHub fallback requires internet connectivity
- Cache is memory-based and doesn't persist across restarts
- Large README files (>1MB) may be truncated

## Troubleshooting

### Common Issues

**"Package not found" errors:**
- Verify the exact package name spelling
- Check if the package exists on [nuget.org](https://www.nuget.org)
- Some packages may be unlisted or deprecated

**GitHub API rate limiting:**
- Configure a `GITHUB_TOKEN` environment variable
- Monitor your token usage at [GitHub API rate limit status](https://docs.github.com/en/rest/rate-limit)

**Slow performance:**
- Increase `CACHE_TTL` for longer caching
- Ensure stable internet connection
- Check if GitHub token is properly configured

### Debug Mode

Enable verbose logging to troubleshoot issues:

```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository** and create a feature branch
2. **Install dependencies**: `npm install`
3. **Make your changes** following the existing code style
4. **Add tests** for new functionality
5. **Run the test suite**: `npm test`
6. **Check code quality**: `npm run lint && npm run typecheck`
7. **Submit a pull request** with a clear description

### Development Guidelines

- Follow TypeScript best practices
- Add JSDoc comments for public APIs
- Include unit tests for new features
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

Explore other package ecosystem MCP servers:

- [npm-package-readme-mcp-server](../npm-package-readme-mcp-server) - For Node.js packages
- [composer-package-readme-mcp-server](../composer-package-readme-mcp-server) - For PHP packages  
- [pip-package-readme-mcp-server](../pip-package-readme-mcp-server) - For Python packages
- [gem-package-readme-mcp-server](../gem-package-readme-mcp-server) - For Ruby gems
- [cargo-package-readme-mcp-server](../cargo-package-readme-mcp-server) - For Rust crates

## Support

Need help? Here's how to get support:

1. **Documentation**: Check this README and inline code documentation
2. **GitHub Issues**: [Create an issue](https://github.com/your-repo/issues) with:
   - Clear problem description
   - Steps to reproduce
   - Error messages and logs
   - Environment details (Node.js version, OS, etc.)
3. **Discussions**: Join our [GitHub Discussions](https://github.com/your-repo/discussions) for questions and ideas

---

**Made with ❤️ for the .NET developer community**