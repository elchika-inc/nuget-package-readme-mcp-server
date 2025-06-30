import type { 
  UsageExample, 
  InstallationInfo, 
  PackageBasicInfo, 
  RepositoryInfo, 
  PackageSearchResult,
  DownloadStats 
} from './common.js';

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
  exists: boolean;
}

export interface PackageInfoResponse {
  package_name: string;
  version?: string;
  latest_version: string;
  description: string;
  authors: string[];
  license: string;
  tags: string[];
  basic_info?: PackageBasicInfo;
  dependencies: {
    [targetFramework: string]: Array<{
      name: string;
      version: string;
    }>;
  } | Record<string, string>;
  dev_dependencies?: any;
  download_stats: DownloadStats;
  repository?: RepositoryInfo | undefined;
  exists: boolean;
}

export interface SearchPackagesResponse {
  query: string;
  total_count: number;
  packages: PackageSearchResult[];
}