import { logger } from '../utils/logger.js';
import type { CacheEntry, CacheOptions } from '../types/index.js';

export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl: number;
  private readonly maxSize: number;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.defaultTtl = options.ttl || 3600 * 1000; // 1 hour default in milliseconds
    this.maxSize = options.maxSize || 104857600; // 100MB default
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const actualTtl = ttl || this.defaultTtl;
    const timestamp = Date.now();
    
    const entry: CacheEntry<T> = {
      data: value,
      timestamp,
      ttl: actualTtl,
    };

    // Check if adding this entry would exceed max size
    if (this.wouldExceedMaxSize(key, entry)) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key} (TTL: ${actualTtl}ms)`);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    // Update timestamp for LRU
    entry.timestamp = now;
    logger.debug(`Cache hit: ${key}`);
    return entry.data;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache deleted: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; memoryUsage: number; hitRate: number } {
    const memoryUsage = this.estimateMemoryUsage();
    return {
      size: this.cache.size,
      memoryUsage,
      hitRate: 0, // TODO: Implement hit rate tracking
    };
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`Cache cleanup: removed ${expiredCount} expired entries`);
    }
  }

  private wouldExceedMaxSize<T>(key: string, entry: CacheEntry<T>): boolean {
    const currentSize = this.estimateMemoryUsage();
    const entrySize = this.estimateEntrySize(key, entry);
    return currentSize + entrySize > this.maxSize;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`Cache LRU eviction: ${oldestKey}`);
    }
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      totalSize += this.estimateEntrySize(key, entry);
    }

    return totalSize;
  }

  private estimateEntrySize<T>(key: string, entry: CacheEntry<T>): number {
    // Rough estimation: key + JSON serialized data + metadata
    const keySize = key.length * 2; // UTF-16
    const dataSize = JSON.stringify(entry.data).length * 2;
    const metadataSize = 24; // timestamp + ttl + object overhead
    
    return keySize + dataSize + metadataSize;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    logger.info('Cache destroyed');
  }
}

// Create cache key helpers
export const createCacheKey = {
  packageInfo: (packageName: string, version: string): string => 
    `pkg_info:${packageName}:${version}`,
  
  packageReadme: (packageName: string, version: string): string => 
    `pkg_readme:${packageName}:${version}`,
  
  searchResults: (query: string, limit: number, quality?: number, popularity?: number): string => {
    const queryHash = Buffer.from(query).toString('base64');
    const params = [queryHash, limit.toString()];
    if (quality !== undefined) {params.push(`q:${quality}`);}
    if (popularity !== undefined) {params.push(`p:${popularity}`);}
    return `search:${params.join(':')}`;
  },
  
  downloadStats: (packageName: string, period: string): string => 
    `stats:${packageName}:${period}:${new Date().toISOString().split('T')[0]}`, // Include date for daily invalidation
};

// Global cache instance
export const cache = new MemoryCache();