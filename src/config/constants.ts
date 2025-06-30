// API Configuration
export const NUGET_API_CONFIG = {
  DEFAULT_TIMEOUT: parseInt(process.env.NUGET_TIMEOUT || '30000', 10),
  RETRY_ATTEMPTS: parseInt(process.env.NUGET_RETRY_ATTEMPTS || '3', 10),
  BASE_RETRY_DELAY: parseInt(process.env.NUGET_BASE_RETRY_DELAY || '1000', 10),
  USER_AGENT: process.env.USER_AGENT || 'nuget-package-readme-mcp/1.0.0',
  ENDPOINTS: {
    FLAT_CONTAINER: process.env.NUGET_FLAT_CONTAINER_URL || 'https://api.nuget.org/v3-flatcontainer',
    REGISTRATION: process.env.NUGET_REGISTRATION_URL || 'https://api.nuget.org/v3/registration5-semver1',
    SEARCH: process.env.NUGET_SEARCH_URL || 'https://azuresearch-usnc.nuget.org/query',
  },
} as const;

// Cache Configuration  
export const CACHE_CONFIG = {
  DEFAULT_TTL: parseInt(process.env.CACHE_TTL || '3600000', 10), // 1 hour default
  MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '104857600', 10), // 100MB default
  CLEANUP_INTERVAL: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '300000', 10), // 5 minutes default
} as const;

// Download Statistics Approximation Ratios
export const DOWNLOAD_STATS_RATIOS = {
  DAILY: 0.001,
  WEEKLY: 0.007,
  MONTHLY: 0.03,
} as const;

// GitHub Configuration
export const GITHUB_CONFIG = {
  BASE_URL: process.env.GITHUB_API_URL || 'https://api.github.com',
  TIMEOUT: parseInt(process.env.GITHUB_TIMEOUT || '15000', 10),
  USER_AGENT: process.env.USER_AGENT || 'nuget-package-readme-mcp/1.0.0',
  TOKEN: process.env.GITHUB_TOKEN,
} as const;

// Validation Constants
export const VALIDATION_LIMITS = {
  PACKAGE_NAME_MAX_LENGTH: 100,
  QUERY_MAX_LENGTH: 1000,
  SEARCH_LIMIT_MAX: 1000,
  SEARCH_LIMIT_DEFAULT: 20,
} as const;