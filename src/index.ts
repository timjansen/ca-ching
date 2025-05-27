import { InMemoryCache } from './cache';
import { Cache, CacheOptions } from './types';
import { registerCache } from './cache-registry';

/**
 * Create a new cache instance
 */
export function createCache<T>(options: CacheOptions<T>, overwriteName = false): Cache<T> {
  const cache = new InMemoryCache<T>(options);
  
  // Register the cache if it has a name
  if (options.name) {
    registerCache(options.name, cache, overwriteName);
  }
  
  return cache;
}

// Re-export all types and interfaces
export * from './types';
export { CacheEntry } from './cache-stats';
export { InMemoryCache } from './cache';
export { 
  registerCache, 
  getRegisteredCache, 
  hasRegisteredCache, 
  unregisterCache, 
  getRegisteredCacheNames 
} from './cache-registry';
export {
  CacheGet,
  CachePut,
  CachePutResult,
  CacheInvalidate
} from './decorators';
