// NuGet API Response Types
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

// Enhanced metadata from Registration API
export interface NuGetEnhancedMetadata {
  '@id': string;
  '@type': string[];
  registration?: string;
  id: string;
  version: string;
  description?: string;
  summary?: string;
  title?: string;
  authors?: string;
  copyright?: string;
  language?: string;
  licenseExpression?: string;
  licenseUrl?: string;
  listed?: boolean;
  minClientVersion?: string;
  packageContent?: string;
  projectUrl?: string;
  published?: string;
  requireLicenseAcceptance?: boolean;
  verbatimVersion?: string;
  tags?: string[];
  dependencyGroups?: Array<{
    '@id'?: string;
    '@type'?: string;
    targetFramework?: string;
    dependencies?: Array<{
      '@id'?: string;
      '@type'?: string;
      id: string;
      range: string;
      registration?: string;
    }>;
  }>;
  readme?: string;
  readmeFile?: string;
  releaseNotes?: string;
}