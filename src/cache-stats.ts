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
 * Internal cache entry structure
 */
export interface CacheEntry<T> {
  /** The cached value or Promise */
  value: T | Promise<T>;
  
  /** Timestamp when the entry was created */
  createdAt: number;
  
  /** Timestamp when the entry was last accessed */
  lastAccessedAt: number;
  
  /** Time-to-live for this specific entry */
  ttl?: number;
  
  /** Size in bytes (for JSON-compatible entries) */
  sizeBytes?: number;
  
  /** Whether this entry is currently being prefetched */
  isPrefetching?: boolean;
}
