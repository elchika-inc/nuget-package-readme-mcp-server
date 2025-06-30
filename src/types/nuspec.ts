// NuSpec XML Types
export interface NuSpecPackage {
  package: {
    metadata: {
      id: string;
      version: string;
      title?: string | undefined;
      authors: string;
      owners?: string | undefined;
      license?: string | undefined;
      licenseUrl?: string | undefined;
      licenseExpression?: string | undefined;
      projectUrl?: string | undefined;
      iconUrl?: string | undefined;
      requireLicenseAcceptance?: boolean | undefined;
      description: string;
      releaseNotes?: string | undefined;
      copyright?: string | undefined;
      tags?: string | undefined;
      repository?: {
        type: string;
        url: string;
        branch?: string | undefined;
        commit?: string | undefined;
      } | undefined;
      dependencies?: {
        group?: Array<{
          targetFramework?: string | undefined;
          dependency?: Array<{
            id: string;
            version?: string | undefined;
            include?: string | undefined;
            exclude?: string | undefined;
          }> | undefined;
        }> | undefined;
        dependency?: Array<{
          id: string;
          version?: string | undefined;
          include?: string | undefined;
          exclude?: string | undefined;
        }> | undefined;
      } | undefined;
    };
  };
}