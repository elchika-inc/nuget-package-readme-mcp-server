import { NuGetPackageApiClient } from './nuget-package-api.js';
import { NuGetSearchApiClient } from './nuget-search-api.js';
import { NuGetContentApiClient } from './nuget-content-api.js';

export class NuGetApiClient {
  private packageApi: NuGetPackageApiClient;
  private searchApi: NuGetSearchApiClient;
  private contentApi: NuGetContentApiClient;

  constructor(timeout?: number) {
    this.packageApi = new NuGetPackageApiClient(timeout);
    this.searchApi = new NuGetSearchApiClient(timeout);
    this.contentApi = new NuGetContentApiClient(timeout);
  }

  // Package operations
  async checkPackageExists(packageName: string) {
    return this.packageApi.checkPackageExists(packageName);
  }

  async getPackageVersions(packageName: string) {
    return this.packageApi.getPackageVersions(packageName);
  }

  async getPackageMetadata(packageName: string, version: string) {
    return this.packageApi.getPackageMetadata(packageName, version);
  }

  async getEnhancedPackageMetadata(packageName: string, version: string) {
    return this.packageApi.getEnhancedPackageMetadata(packageName, version);
  }

  // Search operations
  async searchPackages(query: string, limit?: number) {
    return this.searchApi.searchPackages(query, limit);
  }

  // Content operations
  async getPackageReadme(packageName: string, version: string) {
    return this.contentApi.getPackageReadme(packageName, version);
  }

  async getDownloadStats(packageName: string) {
    return this.contentApi.getDownloadStats(packageName);
  }

  async getAllDownloadStats(packageName: string) {
    return this.contentApi.getAllDownloadStats(packageName);
  }
}

export const nugetApi = new NuGetApiClient();