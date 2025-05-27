import { InMemoryCache } from './cache';
import { Cache, CacheOptions } from './types';

/**
 * Create a new cache instance
 */
export function createCache<T>(options: CacheOptions<T>): Cache<T> {
  return new InMemoryCache<T>(options);
}

// Re-export all types and interfaces
export * from './types';
export { CacheEntry } from './cache-stats';
export { InMemoryCache } from './cache';
