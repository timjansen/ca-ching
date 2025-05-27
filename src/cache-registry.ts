import { Cache } from './types';

/**
 * Global cache registry to store named caches
 */
const cacheRegistry = new Map<string, Cache<any>>();

/**
 * Register a named cache in the global registry
 * @param name The name of the cache
 * @param cache The cache instance
 */
export function registerCache(name: string, cache: Cache<any>, overwriteName = false): void {
  if (cacheRegistry.has(name) && !overwriteName) {
    console.warn(`Cache with name '${name}' already exists. It will be overwritten.`);
  }
  cacheRegistry.set(name, cache);
}

/**
 * Get a registered cache by name
 * @param name The name of the cache
 * @returns The cache instance or undefined if not found
 */
export function getRegisteredCache(name: string): Cache<any> | undefined {
  return cacheRegistry.get(name);
}

/**
 * Check if a cache with the given name is registered
 * @param name The name of the cache
 * @returns True if the cache exists, false otherwise
 */
export function hasRegisteredCache(name: string): boolean {
  return cacheRegistry.has(name);
}

/**
 * Unregister a cache from the registry
 * @param name The name of the cache
 * @returns True if the cache was found and removed, false otherwise
 */
export function unregisterCache(name: string): boolean {
  return cacheRegistry.delete(name);
}

/**
 * Get all registered cache names
 * @returns Array of registered cache names
 */
export function getRegisteredCacheNames(): string[] {
  return Array.from(cacheRegistry.keys());
}
