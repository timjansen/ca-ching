import { Cache, CacheKey, CacheOptions } from './types';
import { CacheEntry, CacheStats } from './cache-stats';
import { keyToString, keyStartsWith, calculateSizeBytes, isPromise } from './utils';
import { createEvictionStrategy, EvictionStrategy } from './eviction';

/**
 * Internal cache options with resolved defaults
 */
interface ResolvedCacheOptions<T> {
  maxSize: number;
  maxSizeBytes?: number;
  ttl?: number;
  evictionPolicy: CacheOptions<T>['evictionPolicy'];
  fetchFunction?: CacheOptions<T>['fetchFunction'];
  prefetchAfter?: number;
  nextLevelCache?: Cache<T>;
  serialize?: CacheOptions<T>['serialize'];
  deserialize?: CacheOptions<T>['deserialize'];
  time: () => number;
}

/**
 * In-memory cache implementation
 */
export class InMemoryCache<T> implements Cache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly options: ResolvedCacheOptions<T>;
  private readonly evictionStrategy: EvictionStrategy<T>;
  private readonly stats: CacheStats;
  private readonly pendingFetches = new Map<string, Promise<T>>();
  
  constructor(options: CacheOptions<T>) {
    // Set defaults for optional options
    this.options = {
      maxSize: options.maxSize,
      maxSizeBytes: options.maxSizeBytes,
      ttl: options.ttl,
      evictionPolicy: options.evictionPolicy,
      fetchFunction: options.fetchFunction,
      prefetchAfter: options.prefetchAfter,
      nextLevelCache: options.nextLevelCache,
      serialize: options.serialize,
      deserialize: options.deserialize,
      time: options.time || (() => Date.now()),
    };
    
    // Validate prefetchAfter
    if (this.options.prefetchAfter && this.options.ttl && this.options.prefetchAfter >= this.options.ttl) {
      throw new Error('prefetchAfter must be less than ttl');
    }
    
    this.evictionStrategy = createEvictionStrategy<T>(this.options.evictionPolicy);
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      sizeBytes: 0,
      evictions: 0,
      prefetches: 0,
      hitRatio: 0,
    };
  }
  
  async get(key: CacheKey, context?: any): Promise<T | undefined> {
    const keyStr = keyToString(key);
    const entry = this.entries.get(keyStr);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRatio();
      
      return this.handleCacheMiss(key, keyStr, context);
    }
    
    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.entries.delete(keyStr);
      this.evictionStrategy.onRemove(keyStr);
      this.updateSize();
      this.stats.misses++;
      this.updateHitRatio();
      
      return this.handleCacheMiss(key, keyStr, context);
    }
    
    // Update access time
    entry.lastAccessedAt = this.options.time();
    this.evictionStrategy.onAccess(keyStr);
    
    // Check for prefetch
    if (this.shouldPrefetch(entry) && !entry.isPrefetching && this.options.fetchFunction) {
      entry.isPrefetching = true;
      this.stats.prefetches++;
      
      // Start prefetch in background
      const fetchPromise = this.options.fetchFunction(key, context);
      if (isPromise(fetchPromise)) {
        fetchPromise
          .then((value: T) => {
            this.set(key, value);
            entry.isPrefetching = false;
          })
          .catch(() => {
            entry.isPrefetching = false;
          });
      } else {
        this.set(key, fetchPromise);
        entry.isPrefetching = false;
      }
    }
    
    this.stats.hits++;
    this.updateHitRatio();
    
    // Handle Promise values
    if (isPromise(entry.value)) {
      return entry.value;
    }
    
    return entry.value;
  }
  
  getIfAvailable(key: CacheKey): T | undefined {
    const keyStr = keyToString(key);
    const entry = this.entries.get(keyStr);
    
    if (!entry || this.isExpired(entry)) {
      return undefined;
    }
    
    // Update access time
    entry.lastAccessedAt = this.options.time();
    this.evictionStrategy.onAccess(keyStr);
    
    // Handle Promise values - return undefined for promises in sync method
    if (isPromise(entry.value)) {
      return undefined;
    }
    
    return entry.value;
  }
  
  async getOrSet(
    key: CacheKey,
    callback: (key: CacheKey, context?: any) => Promise<T> | T,
    context?: any,
    ttl?: number
  ): Promise<T> {
    const existing = await this.get(key, context);
    if (existing !== undefined) {
      return existing;
    }
    
    const value = await callback(key, context);
    this.set(key, value, ttl);
    return value;
  }
  
  async set(key: CacheKey, value: T | Promise<T>, ttl?: number, forwardToNext: boolean = true): Promise<void> {
    const keyStr = keyToString(key);
    const now = this.options.time();
    
    // Calculate size for JSON-compatible values
    let sizeBytes: number | undefined;
    if (this.options.maxSizeBytes && !isPromise(value)) {
      sizeBytes = calculateSizeBytes(value);
    }
    
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      lastAccessedAt: now,
      ttl: ttl ?? this.options.ttl,
      sizeBytes,
    };
    
    // Remove existing entry if present
    if (this.entries.has(keyStr)) {
      this.evictionStrategy.onRemove(keyStr);
    }
    
    this.entries.set(keyStr, entry);
    this.evictionStrategy.onAdd(keyStr);
    
    // Update size tracking
    this.updateSize();
    
    // Evict if necessary
    this.evictIfNecessary();
    
    // Forward to next level cache
    if (forwardToNext && this.options.nextLevelCache) {
      await this.options.nextLevelCache.set(key, value, ttl, forwardToNext);
    }
  }
  
  async invalidate(key: CacheKey, forwardToNext: boolean = true): Promise<void> {
    const keyStr = keyToString(key);
    
    if (this.entries.has(keyStr)) {
      this.entries.delete(keyStr);
      this.evictionStrategy.onRemove(keyStr);
      this.updateSize();
    }
    
    // Forward to next level cache
    if (forwardToNext && this.options.nextLevelCache) {
      await this.options.nextLevelCache.invalidate(key, forwardToNext);
    }
  }
  
  async invalidateByPrefix(keyPrefix: string[], forwardToNext: boolean = true): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [keyStr] of this.entries) {
      // Convert string key back to array for comparison
      const keyArray = keyStr.split('::');
      if (keyStartsWith(keyArray, keyPrefix)) {
        keysToDelete.push(keyStr);
      }
    }
    
    for (const keyStr of keysToDelete) {
      this.entries.delete(keyStr);
      this.evictionStrategy.onRemove(keyStr);
    }
    
    this.updateSize();
    
    // Forward to next level cache
    if (forwardToNext && this.options.nextLevelCache) {
      await this.options.nextLevelCache.invalidateByPrefix(keyPrefix, forwardToNext);
    }
  }
  
  async invalidateAll(forwardToNext: boolean = true): Promise<void> {
    const keysToDelete = Array.from(this.entries.keys());
    
    this.entries.clear();
    
    for (const keyStr of keysToDelete) {
      this.evictionStrategy.onRemove(keyStr);
    }
    
    this.updateSize();
    
    // Forward to next level cache
    if (forwardToNext && this.options.nextLevelCache) {
      await this.options.nextLevelCache.invalidateAll(forwardToNext);
    }
  }
  
  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }
  
  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) {
      return false;
    }
    
    const now = this.options.time();
    return now - entry.createdAt > entry.ttl;
  }
  
  private shouldPrefetch(entry: CacheEntry<T>): boolean {
    if (!this.options.prefetchAfter || !entry.ttl) {
      return false;
    }
    
    const now = this.options.time();
    const age = now - entry.createdAt;
    return age >= this.options.prefetchAfter;
  }
  
  private updateSize(): void {
    this.stats.size = this.entries.size;
    
    if (this.options.maxSizeBytes) {
      let totalBytes = 0;
      for (const entry of this.entries.values()) {
        if (entry.sizeBytes) {
          totalBytes += entry.sizeBytes;
        }
      }
      this.stats.sizeBytes = totalBytes;
    }
  }
  
  private updateHitRatio(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = total > 0 ? this.stats.hits / total : 0;
  }
  
  private evictIfNecessary(): void {
    // Check size limit first
    if (this.entries.size > this.options.maxSize) {
      const targetEvictionCount = this.entries.size - this.options.maxSize;
      const keysToEvict = this.evictionStrategy.selectForEviction(this.entries, targetEvictionCount);
      
      for (const key of keysToEvict) {
        this.entries.delete(key);
        this.evictionStrategy.onRemove(key);
        this.stats.evictions++;
      }
      
      this.updateSize();
    }
    
    // Check byte size limit and evict until under limit
    if (this.options.maxSizeBytes) {
      this.updateSize();
      
      while (this.stats.sizeBytes && this.stats.sizeBytes > this.options.maxSizeBytes && this.entries.size > 0) {
        const keysToEvict = this.evictionStrategy.selectForEviction(this.entries, 1);
        
        if (keysToEvict.length === 0) {
          break; // No more entries to evict
        }
        
        for (const key of keysToEvict) {
          this.entries.delete(key);
          this.evictionStrategy.onRemove(key);
          this.stats.evictions++;
        }
        
        this.updateSize();
      }
    }
  }
  
  private async handleCacheMiss(key: CacheKey, keyStr: string, context?: any): Promise<T | undefined> {
    // Check if there's already a pending fetch for this key
    if (this.pendingFetches.has(keyStr)) {
      return this.pendingFetches.get(keyStr);
    }
    
    // Try next level cache
    if (this.options.nextLevelCache) {
      const nextLevelValue = await this.options.nextLevelCache.get(key, context);
      if (nextLevelValue !== undefined) {
        // Store in current level
        this.set(key, nextLevelValue, undefined, false);
        return nextLevelValue;
      }
    }
    
    // Try fetch function with Promise sharing
    if (this.options.fetchFunction) {
      const fetchPromise = Promise.resolve(this.options.fetchFunction(key, context));
      
      // Store the Promise to share between concurrent requests
      this.pendingFetches.set(keyStr, fetchPromise);
      
      try {
        const fetchedValue = await fetchPromise;
        this.set(key, fetchedValue);
        return fetchedValue;
      } finally {
        // Clean up the pending fetch
        this.pendingFetches.delete(keyStr);
      }
    }
    
    return undefined;
  }
}
