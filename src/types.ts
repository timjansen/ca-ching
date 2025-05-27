/**
 * Cache key type - can be a string or array of strings
 */
export type CacheKey = string | string[];

/**
 * Eviction policies supported by the cache
 */
export type EvictionPolicy = 'lru' | 'filo' | 'random';

/**
 * Fetch function type for automatic cache population
 */
export type FetchFunction<T> = (key: CacheKey, context?: any) => Promise<T> | T;

/**
 * Serialize function to convert objects to JSON/string for multi-layer caching
 */
export type SerializeFunction<T> = (value: T) => string;

/**
 * Deserialize function to convert JSON/string back to objects
 */
export type DeserializeFunction<T> = (serialized: string) => T;

/**
 * Time function for getting current timestamp (allows mocking in tests)
 */
export type TimeFunction = () => number;

/**
 * Cache configuration options
 */
export interface CacheOptions<T> {
  /** Maximum number of entries in the cache */
  maxSize: number;
  
  /** Maximum size in bytes for JSON-compatible caches */
  maxSizeBytes?: number;
  
  /** Time-to-live for cache entries in milliseconds */
  ttl?: number;
  
  /** Eviction policy when cache is full */
  evictionPolicy: EvictionPolicy;
  
  /** Optional name for the cache for use with decorators */
  name?: string;
  
  /** Optional fetch function for automatic cache population */
  fetchFunction?: FetchFunction<T>;
  
  /** Prefetch threshold - fetch in background when entry is this old (must be < TTL) */
  prefetchAfter?: number;
  
  /** Optional next level cache for multi-level caching */
  nextLevelCache?: Cache<T>;
  
  /** Serialize function for multi-level caching */
  serialize?: SerializeFunction<T>;
  
  /** Deserialize function for multi-level caching */
  deserialize?: DeserializeFunction<T>;
  
  /** Time function (defaults to Date.now) */
  time?: TimeFunction;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  
  /** Total number of cache misses */
  misses: number;
  
  /** Current number of entries in cache */
  size: number;
  
  /** Current size in bytes (if applicable) */
  sizeBytes?: number;
  
  /** Number of evictions performed */
  evictions: number;
  
  /** Number of prefetch operations performed */
  prefetches: number;
  
  /** Hit ratio (hits / (hits + misses)) */
  hitRatio: number;
}

/**
 * Cache interface defining all cache operations
 */
export interface Cache<T> {
  /**
   * Get a value from the cache
   * @param key The cache key
   * @param context Optional context passed to fetch functions
   * @returns The cached value or undefined if not found
   */
  get(key: CacheKey, context?: any): Promise<T | undefined>;
  
  /**
   * Get a value from the cache without triggering fetch
   * @param key The cache key
   * @returns The cached value or undefined if not found
   */
  getIfAvailable(key: CacheKey): T | undefined;
  
  /**
   * Get a value from cache or set it using the provided callback
   * @param key The cache key
   * @param callback Function to generate the value if not in cache
   * @param context Optional context passed to the callback
   * @param ttl Optional TTL override for this entry
   * @returns The cached or newly generated value
   */
  getOrSet(key: CacheKey, callback: (key: CacheKey, context?: any) => Promise<T> | T, context?: any, ttl?: number): Promise<T>;
  
  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache (can be a Promise)
   * @param ttl Optional TTL override for this entry
   * @param forwardToNext Whether to forward to next level cache (default: true)
   */
  set(key: CacheKey, value: T | Promise<T>, ttl?: number, forwardToNext?: boolean): Promise<void>;
  
  /**
   * Invalidate a specific cache entry
   * @param key The cache key to invalidate
   * @param forwardToNext Whether to forward to next level cache (default: true)
   */
  invalidate(key: CacheKey, forwardToNext?: boolean): Promise<void>;
  
  /**
   * Invalidate all entries with keys starting with the given prefix
   * @param keyPrefix The key prefix to match
   * @param forwardToNext Whether to forward to next level cache (default: true)
   */
  invalidateByPrefix(keyPrefix: string[], forwardToNext?: boolean): Promise<void>;
  
  /**
   * Invalidate all cache entries
   * @param forwardToNext Whether to forward to next level cache (default: true)
   */
  invalidateAll(forwardToNext?: boolean): Promise<void>;
  
  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
}
