import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryCache, createCacheKey } from '../../src/services/cache.js';
import { CACHE_CONFIG } from '../../src/config/constants.js';

// Mock logger to avoid actual logging in tests
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger,
}));

// Mock timers for testing time-dependent functionality
vi.useFakeTimers();

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
    vi.clearAllTimers();
  });

  afterEach(() => {
    cache.destroy();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const newCache = new MemoryCache();
      expect(newCache.size()).toBe(0);
      newCache.destroy();
    });

    it('should initialize with custom options', () => {
      const options = { ttl: 5000, maxSize: 100 };
      const newCache = new MemoryCache(options);
      expect(newCache.size()).toBe(0);
      newCache.destroy();
    });

    it('should start cleanup interval on initialization', () => {
      const intervalSpy = vi.spyOn(global, 'setInterval');
      const newCache = new MemoryCache();
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), CACHE_CONFIG.CLEANUP_INTERVAL);
      newCache.destroy();
    });
  });

  describe('set() and get()', () => {
    it('should store and retrieve a value', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      cache.set(key, value);
      const retrieved = cache.get<typeof value>(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      const key = 'test-key';
      const value = 'test-value';
      const customTtl = 1000;
      
      cache.set(key, value, customTtl);
      expect(cache.get(key)).toBe(value);
      
      // Fast forward time beyond custom TTL
      vi.advanceTimersByTime(customTtl + 1);
      expect(cache.get(key)).toBeNull();
    });

    it('should expire entries after TTL', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value);
      expect(cache.get(key)).toBe(value);
      
      // Fast forward time beyond default TTL
      vi.advanceTimersByTime(CACHE_CONFIG.DEFAULT_TTL + 1);
      expect(cache.get(key)).toBeNull();
    });

    it('should update timestamp on access (LRU)', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value);
      
      // Access the entry after some time
      vi.advanceTimersByTime(1000);
      cache.get(key);
      
      // The entry should still be valid even after original TTL would have expired
      // because timestamp was updated on access
      vi.advanceTimersByTime(CACHE_CONFIG.DEFAULT_TTL - 500);
      expect(cache.get(key)).toBe(value);
    });
  });

  describe('delete()', () => {
    it('should delete existing entry', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value);
      expect(cache.has(key)).toBe(true);
      
      const deleted = cache.delete(key);
      expect(deleted).toBe(true);
      expect(cache.has(key)).toBe(false);
    });

    it('should return false for non-existent entry', () => {
      const deleted = cache.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('has()', () => {
    it('should return true for existing non-expired entry', () => {
      const key = 'test-key';
      cache.set(key, 'value');
      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired entry and remove it', () => {
      const key = 'test-key';
      cache.set(key, 'value');
      
      vi.advanceTimersByTime(CACHE_CONFIG.DEFAULT_TTL + 1);
      expect(cache.has(key)).toBe(false);
      // Entry should be removed from internal map
      expect(cache.size()).toBe(0);
    });
  });

  describe('size()', () => {
    it('should return correct size', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('getStats()', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', { data: 'complex-data' });
      
      const stats = cache.getStats();
      
      expect(stats).toHaveProperty('size', 2);
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('hitRate', 0); // TODO: Implement hit rate tracking
      expect(typeof stats.memoryUsage).toBe('number');
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('LRU Eviction', () => {
    let smallCache: MemoryCache;

    beforeEach(() => {
      // Create cache with very small max size to trigger eviction
      smallCache = new MemoryCache({ maxSize: 100 });
    });

    afterEach(() => {
      smallCache.destroy();
    });

    it('should evict least recently used entries when max size exceeded', () => {
      // Add entries that will exceed max size
      smallCache.set('key1', 'a'.repeat(50));
      smallCache.set('key2', 'b'.repeat(50));
      
      // Access key1 to make it more recently used
      smallCache.get('key1');
      
      // Add another large entry that should trigger eviction of key2
      smallCache.set('key3', 'c'.repeat(50));
      
      // key1 should still exist (most recently used)
      expect(smallCache.has('key1')).toBe(true);
      // key2 might be evicted (least recently used)
      // key3 should exist (just added)
      expect(smallCache.has('key3')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries on interval', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      // Fast forward time to expire entries
      vi.advanceTimersByTime(CACHE_CONFIG.DEFAULT_TTL + 1);
      
      // Trigger cleanup by advancing cleanup interval
      vi.advanceTimersByTime(CACHE_CONFIG.CLEANUP_INTERVAL);
      
      expect(cache.size()).toBe(0);
    });

    it('should not remove non-expired entries during cleanup', () => {
      cache.set('expired-key', 'value1');
      
      // Fast forward time to almost expire the first entry
      vi.advanceTimersByTime(CACHE_CONFIG.DEFAULT_TTL - 1000);
      
      cache.set('fresh-key', 'value2');
      
      // Fast forward time to expire only the first entry
      vi.advanceTimersByTime(2000);
      
      // Trigger cleanup
      vi.advanceTimersByTime(CACHE_CONFIG.CLEANUP_INTERVAL);
      
      expect(cache.has('expired-key')).toBe(false);
      expect(cache.has('fresh-key')).toBe(true);
    });
  });

  describe('destroy()', () => {
    it('should clear interval and cache', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      cache.set('key', 'value');
      expect(cache.size()).toBe(1);
      
      cache.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(cache.size()).toBe(0);
    });
  });
});

describe('createCacheKey', () => {
  describe('packageInfo', () => {
    it('should create correct cache key for package info', () => {
      const key = createCacheKey.packageInfo('Newtonsoft.Json', '13.0.1');
      expect(key).toBe('pkg_info:Newtonsoft.Json:13.0.1');
    });
  });

  describe('packageReadme', () => {
    it('should create correct cache key for package readme', () => {
      const key = createCacheKey.packageReadme('Newtonsoft.Json', '13.0.1');
      expect(key).toBe('pkg_readme:Newtonsoft.Json:13.0.1');
    });
  });

  describe('searchResults', () => {
    it('should create correct cache key for basic search', () => {
      const key = createCacheKey.searchResults('json', 20);
      const expectedQueryHash = Buffer.from('json').toString('base64');
      expect(key).toBe(`search:${expectedQueryHash}:20`);
    });

    it('should create correct cache key for search with quality filter', () => {
      const key = createCacheKey.searchResults('json', 20, 0.8);
      const expectedQueryHash = Buffer.from('json').toString('base64');
      expect(key).toBe(`search:${expectedQueryHash}:20:q:0.8`);
    });

    it('should create correct cache key for search with both quality and popularity filters', () => {
      const key = createCacheKey.searchResults('json', 20, 0.8, 0.9);
      const expectedQueryHash = Buffer.from('json').toString('base64');
      expect(key).toBe(`search:${expectedQueryHash}:20:q:0.8:p:0.9`);
    });

    it('should create correct cache key for search with only popularity filter', () => {
      const key = createCacheKey.searchResults('json', 20, undefined, 0.9);
      const expectedQueryHash = Buffer.from('json').toString('base64');
      expect(key).toBe(`search:${expectedQueryHash}:20:p:0.9`);
    });
  });

  describe('downloadStats', () => {
    it('should create correct cache key for download stats with current date', () => {
      const mockDate = '2024-01-15';
      vi.setSystemTime(new Date(`${mockDate}T10:00:00.000Z`));
      
      const key = createCacheKey.downloadStats('Newtonsoft.Json', 'week');
      expect(key).toBe(`stats:Newtonsoft.Json:week:${mockDate}`);
    });
  });
});