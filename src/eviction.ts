import { CacheEntry } from './cache-stats';
import { EvictionPolicy } from './types';

/**
 * Eviction strategy interface
 */
export interface EvictionStrategy<T> {
  /**
   * Select entries to evict
   * @param entries Map of all cache entries
   * @param targetCount Number of entries to evict
   * @returns Array of keys to evict
   */
  selectForEviction(entries: Map<string, CacheEntry<T>>, targetCount: number): string[];
  
  /**
   * Update strategy state when an entry is accessed
   * @param key The key that was accessed
   */
  onAccess(key: string): void;
  
  /**
   * Update strategy state when an entry is added
   * @param key The key that was added
   */
  onAdd(key: string): void;
  
  /**
   * Update strategy state when an entry is removed
   * @param key The key that was removed
   */
  onRemove(key: string): void;
}

/**
 * Least Recently Used eviction strategy
 */
export class LRUEvictionStrategy<T> implements EvictionStrategy<T> {
  selectForEviction(entries: Map<string, CacheEntry<T>>, targetCount: number): string[] {
    const sortedEntries = Array.from(entries.entries())
      .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);
    
    return sortedEntries.slice(0, targetCount).map(([key]) => key);
  }
  
  onAccess(key: string): void {
    // LRU updates are handled by updating lastAccessedAt in the main cache
  }
  
  onAdd(key: string): void {
    // No additional state needed for LRU
  }
  
  onRemove(key: string): void {
    // No additional state needed for LRU
  }
}

/**
 * First In, Last Out (oldest first) eviction strategy
 */
export class FILOEvictionStrategy<T> implements EvictionStrategy<T> {
  selectForEviction(entries: Map<string, CacheEntry<T>>, targetCount: number): string[] {
    const sortedEntries = Array.from(entries.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);
    
    return sortedEntries.slice(0, targetCount).map(([key]) => key);
  }
  
  onAccess(key: string): void {
    // FILO doesn't care about access patterns
  }
  
  onAdd(key: string): void {
    // No additional state needed for FILO
  }
  
  onRemove(key: string): void {
    // No additional state needed for FILO
  }
}

/**
 * Random eviction strategy
 */
export class RandomEvictionStrategy<T> implements EvictionStrategy<T> {
  selectForEviction(entries: Map<string, CacheEntry<T>>, targetCount: number): string[] {
    const keys = Array.from(entries.keys());
    const result: string[] = [];
    
    for (let i = 0; i < targetCount && keys.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      result.push(keys.splice(randomIndex, 1)[0]);
    }
    
    return result;
  }
  
  onAccess(key: string): void {
    // Random doesn't care about access patterns
  }
  
  onAdd(key: string): void {
    // No additional state needed for random
  }
  
  onRemove(key: string): void {
    // No additional state needed for random
  }
}

/**
 * Factory function to create eviction strategies
 */
export function createEvictionStrategy<T>(policy: EvictionPolicy): EvictionStrategy<T> {
  switch (policy) {
    case 'lru':
      return new LRUEvictionStrategy<T>();
    case 'filo':
      return new FILOEvictionStrategy<T>();
    case 'random':
      return new RandomEvictionStrategy<T>();
    default:
      throw new Error(`Unsupported eviction policy: ${policy}`);
  }
}
