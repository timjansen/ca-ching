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

async function getStats(name: string): Promise<any> {
  const cache = cacheRegistry.get(name);
  if (!cache) return undefined;
  const stats = await cache.getStats();
  return { name, ...stats };
}

/**
 * Get stats for all registered caches
 * @returns Object mapping cache names to their stats
 */
export async function getAllStats(): Promise<any> {
  const names = getRegisteredCacheNames();
  const statsArr = await Promise.all(names.map(getStats));
  const result: Record<string, any> = {};
  for (const stat of statsArr) {
    if (stat && stat.name) result[stat.name] = stat;
  }
  return result;
}

// happy-server extension support
if (typeof globalThis !== 'undefined' && (globalThis as any).happyServerExtension) {
  (globalThis as any).happyServerExtension['ca-ching'] = async () => ({
    status: 'ok',
    caches: await getAllStats()
  });
}
