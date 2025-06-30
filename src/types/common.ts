export interface UsageExample {
  title: string;
  description?: string | undefined;
  code: string;
  language: string; // 'csharp', 'fsharp', 'vbnet', 'xml', 'powershell', etc.
}

export interface InstallationInfo {
  command: string;     // Primary installation command
  alternatives?: string[]; // Alternative installation methods
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