export interface UsageExample {
  title: string;
  description?: string | undefined;
  code: string;
  language: string; // 'csharp', 'fsharp', 'vbnet', 'xml', 'powershell', etc.
}

export interface InstallationInfo {
  dotnet: string;      // "dotnet add package PackageName"
  packageManager?: string;    // "Install-Package PackageName"
  paket?: string;      // "paket add PackageName"
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface RepositoryInfo {
  type: string;
  url: string;
  directory?: string | undefined;
}

export interface PackageBasicInfo {
  name: string;
  version: string;
  description: string;
  title?: string | undefined;
  packageTypes?: string[] | undefined;
  homepage?: string | undefined;
  projectUrl?: string | undefined;
  license: string;
  licenseUrl?: string | undefined;
  authors: string[];
  owners?: string[] | undefined;
  tags: string[];
  iconUrl?: string | undefined;
  targetFrameworks?: string[] | undefined;
}

export interface DownloadStats {
  last_day: number;
  last_week: number;
  last_month: number;
}

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
  tags: string[];
  authors: string[];
  totalDownloads: number;
  verified: boolean;
  packageTypes: string[];
  versions: Array<{
    version: string;
    downloads: number;
  }>;
}

// Tool Parameters
export interface GetPackageReadmeParams {
  package_name: string;    // Package name (required)
  version?: string;        // Version specification (optional, default: "latest")
  include_examples?: boolean; // Whether to include examples (optional, default: true)
}

export interface GetPackageInfoParams {
  package_name: string;
  include_dependencies?: boolean; // Whether to include dependencies (default: true)
  include_dev_dependencies?: boolean; // Whether to include development dependencies (default: false)
}

export interface SearchPackagesParams {
  query: string;          // Search query
  limit?: number;         // Maximum number of results (default: 20)
  quality?: number;       // Minimum quality score (0-1)
  popularity?: number;    // Minimum popularity score (0-1)
}

// Tool Responses
export interface PackageReadmeResponse {
  package_name: string;
  version: string;
  description: string;
  readme_content: string;
  usage_examples: UsageExample[];
  installation: InstallationInfo;
  basic_info: PackageBasicInfo;
  repository?: RepositoryInfo | undefined;
}

export interface PackageInfoResponse {
  package_name: string;
  latest_version: string;
  description: string;
  authors: string[];
  license: string;
  tags: string[];
  dependencies?: Record<string, string> | undefined;
  dev_dependencies?: Record<string, string> | undefined;
  download_stats: DownloadStats;
  repository?: RepositoryInfo | undefined;
}

export interface SearchPackagesResponse {
  query: string;
  total: number;
  packages: PackageSearchResult[];
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// NuGet API Types
export interface NuGetRegistrationInfo {
  '@id': string;
  '@type': string[];
  'commitId': string;
  'commitTimeStamp': string;
  'count': number;
  'items': NuGetRegistrationPage[];
}

export interface NuGetRegistrationPage {
  '@id': string;
  '@type': string;
  'commitId': string;
  'commitTimeStamp': string;
  'count': number;
  'parent': string;
  'lower': string;
  'upper': string;
  'items': NuGetPackageVersion[];
}

export interface NuGetPackageVersion {
  '@id': string;
  '@type': string;
  'commitId': string;
  'commitTimeStamp': string;
  'catalogEntry': {
    '@id': string;
    '@type': string;
    'authors': string;
    'dependencyGroups'?: NuGetDependencyGroup[];
    'description': string;
    'iconUrl'?: string;
    'id': string;
    'language'?: string;
    'licenseExpression'?: string;
    'licenseUrl'?: string;
    'listed': boolean;
    'minClientVersion'?: string;
    'packageContent': string;
    'projectUrl'?: string;
    'published': string;
    'requireLicenseAcceptance': boolean;
    'summary'?: string;
    'tags'?: string[];
    'title'?: string;
    'version': string;
  };
  'packageContent': string;
  'registration': string;
}

export interface NuGetDependencyGroup {
  '@id'?: string;
  '@type'?: string;
  'targetFramework'?: string;
  'dependencies'?: NuGetDependency[];
}

export interface NuGetDependency {
  '@id'?: string;
  '@type'?: string;
  'id': string;
  'range': string;
  'registration'?: string;
}

export interface NuGetSearchResponse {
  '@context': {
    '@base': string;
    '@vocab': string;
  };
  'totalHits': number;
  'data': NuGetSearchResult[];
}

export interface NuGetSearchResult {
  '@id': string;
  '@type': string;
  'registration': string;
  'id': string;
  'version': string;
  'description': string;
  'summary'?: string;
  'title'?: string;
  'iconUrl'?: string;
  'licenseUrl'?: string;
  'projectUrl'?: string;
  'tags': string[];
  'authors': string[];
  'totalDownloads': number;
  'verified': boolean;
  'packageTypes': Array<{
    name: string;
  }>;
  'versions': Array<{
    version: string;
    downloads: number;
    '@id': string;
  }>;
}

export interface NuGetDownloadStats {
  totalDownloads: number;
  data: Array<{
    downloads: number;
    packageVersion: string;
  }>;
}

// NuSpec XML Types
export interface NuSpecPackage {
  package: {
    metadata: {
      id: string;
      version: string;
      title?: string | undefined;
      authors: string;
      owners?: string | undefined;
      licenseUrl?: string | undefined;
      licenseExpression?: string | undefined;
      projectUrl?: string | undefined;
      iconUrl?: string | undefined;
      requireLicenseAcceptance?: boolean | undefined;
      description: string;
      releaseNotes?: string | undefined;
      copyright?: string | undefined;
      tags?: string | undefined;
      dependencies?: {
        group?: Array<{
          $: { targetFramework?: string };
          dependency?: Array<{
            $: {
              id: string;
              version?: string;
              include?: string;
              exclude?: string;
            };
          }>;
        }>;
        dependency?: Array<{
          $: {
            id: string;
            version?: string;
          };
        }>;
      };
      frameworkAssemblies?: {
        frameworkAssembly?: Array<{
          $: {
            assemblyName: string;
            targetFramework?: string;
          };
        }>;
      };
      references?: {
        group?: Array<{
          $: { targetFramework?: string };
          reference?: Array<{
            $: { file: string };
          }>;
        }>;
        reference?: Array<{
          $: { file: string };
        }>;
      };
    };
  };
}

// GitHub API Types
export interface GitHubReadmeResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

// Error Types
export class PackageReadmeMcpError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PackageReadmeMcpError';
  }
}

export class PackageNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string) {
    super(`Package '${packageName}' not found`, 'PACKAGE_NOT_FOUND', 404);
  }
}

export class VersionNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string, version: string) {
    super(`Version '${version}' of package '${packageName}' not found`, 'VERSION_NOT_FOUND', 404);
  }
}

export class RateLimitError extends PackageReadmeMcpError {
  constructor(service: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

export class NetworkError extends PackageReadmeMcpError {
  constructor(message: string, originalError?: Error) {
    super(`Network error: ${message}`, 'NETWORK_ERROR', undefined, originalError);
  }
}