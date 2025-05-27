import { createCache, Cache, CacheOptions } from '../index';

describe('Multi-Level Caching', () => {
  let l1Cache: Cache<string>;
  let l2Cache: Cache<string>;

  beforeEach(() => {
    // Create L2 cache (next level)
    const l2Options: CacheOptions<string> = {
      maxSize: 50,
      evictionPolicy: 'lru',
    };
    l2Cache = createCache(l2Options);

    // Create L1 cache with L2 as next level
    const l1Options: CacheOptions<string> = {
      maxSize: 10,
      evictionPolicy: 'lru',
      nextLevelCache: l2Cache,
    };
    l1Cache = createCache(l1Options);
  });

  describe('cascading get operations', () => {
    test('should check next level cache when key not found in L1', async () => {
      // Set value only in L2
      await l2Cache.set('key1', 'l2 value');
      
      // Get from L1 should find it in L2 and cache it in L1
      const result = await l1Cache.get('key1');
      expect(result).toBe('l2 value');
      
      // Should now be available directly in L1
      const l1Direct = l1Cache.getIfAvailable('key1');
      expect(l1Direct).toBe('l2 value');
    });

    test('should prefer L1 cache over L2', async () => {
      await l1Cache.set('key1', 'l1 value');
      await l2Cache.set('key1', 'l2 value');
      
      const result = await l1Cache.get('key1');
      expect(result).toBe('l1 value');
    });

    test('should use fetch function when not found in any level', async () => {
      const fetchFunction = jest.fn().mockResolvedValue('fetched value');
      
      const l1Options: CacheOptions<string> = {
        maxSize: 10,
        evictionPolicy: 'lru',
        nextLevelCache: l2Cache,
        fetchFunction,
      };
      const cache = createCache(l1Options);
      
      const result = await cache.get('missing-key');
      expect(result).toBe('fetched value');
      expect(fetchFunction).toHaveBeenCalledWith('missing-key', undefined);
    });

    test('should populate both levels when fetching', async () => {
      const fetchFunction = jest.fn().mockResolvedValue('fetched value');
      
      const l1Options: CacheOptions<string> = {
        maxSize: 10,
        evictionPolicy: 'lru',
        nextLevelCache: l2Cache,
        fetchFunction,
      };
      const cache = createCache(l1Options);
      
      await cache.get('key1');
      
      // Should be in both caches now
      expect(cache.getIfAvailable('key1')).toBe('fetched value');
      expect(l2Cache.getIfAvailable('key1')).toBe('fetched value');
    });
  });

  describe('cascading set operations', () => {
    test('should forward set operations to next level by default', async () => {
      await l1Cache.set('key1', 'value1');
      
      expect(l1Cache.getIfAvailable('key1')).toBe('value1');
      expect(l2Cache.getIfAvailable('key1')).toBe('value1');
    });

    test('should not forward when forwardToNext is false', async () => {
      await l1Cache.set('key1', 'value1', undefined, false);
      
      expect(l1Cache.getIfAvailable('key1')).toBe('value1');
      expect(l2Cache.getIfAvailable('key1')).toBeUndefined();
    });
  });

  describe('cascading invalidation', () => {
    test('should forward invalidate operations to next level by default', async () => {
      await l1Cache.set('key1', 'value1');
      await l2Cache.set('key2', 'value2'); // Set directly in L2
      
      // Both caches should have their respective values
      expect(l1Cache.getIfAvailable('key1')).toBe('value1');
      expect(l2Cache.getIfAvailable('key1')).toBe('value1');
      expect(l2Cache.getIfAvailable('key2')).toBe('value2');
      
      l1Cache.invalidate('key1');
      
      // Should be invalidated in both levels
      expect(l1Cache.getIfAvailable('key1')).toBeUndefined();
      expect(l2Cache.getIfAvailable('key1')).toBeUndefined();
      expect(l2Cache.getIfAvailable('key2')).toBe('value2'); // Unaffected
    });

    test('should not forward when forwardToNext is false', async () => {
      await l1Cache.set('key1', 'value1');
      
      await l1Cache.invalidate('key1', false);
      
      expect(l1Cache.getIfAvailable('key1')).toBeUndefined();
      expect(l2Cache.getIfAvailable('key1')).toBe('value1'); // Should still exist
    });

    test('should forward prefix invalidation', async () => {
      await l1Cache.set(['user', '123', 'profile'], 'profile1');
      await l1Cache.set(['user', '456', 'profile'], 'profile2');
      await l2Cache.set(['user', '789', 'profile'], 'profile3'); // Only in L2
      
      await l1Cache.invalidateByPrefix(['user', '123']);
      
      expect(l1Cache.getIfAvailable(['user', '123', 'profile'])).toBeUndefined();
      expect(l2Cache.getIfAvailable(['user', '123', 'profile'])).toBeUndefined();
      expect(l1Cache.getIfAvailable(['user', '456', 'profile'])).toBe('profile2');
      expect(l2Cache.getIfAvailable(['user', '789', 'profile'])).toBe('profile3');
    });

    test('should forward invalidateAll', async () => {
      await l1Cache.set('key1', 'value1');
      await l2Cache.set('key2', 'value2');
      
      await l1Cache.invalidateAll();
      
      expect(l1Cache.getIfAvailable('key1')).toBeUndefined();
      expect(l2Cache.getIfAvailable('key1')).toBeUndefined();
      expect(l2Cache.getIfAvailable('key2')).toBeUndefined();
    });
  });

  describe('complex multi-level scenarios', () => {
    test('should handle three-level caching', async () => {
      // Create L3 cache
      const l3Options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
      };
      const l3Cache = createCache(l3Options);
      
      // Chain L2 -> L3
      const l2Options: CacheOptions<string> = {
        maxSize: 50,
        evictionPolicy: 'lru',
        nextLevelCache: l3Cache,
      };
      const l2CacheChained = createCache(l2Options);
      
      // Chain L1 -> L2 -> L3
      const l1Options: CacheOptions<string> = {
        maxSize: 10,
        evictionPolicy: 'lru',
        nextLevelCache: l2CacheChained,
      };
      const l1CacheChained = createCache(l1Options);
      
      // Set value only in L3
      await l3Cache.set('key1', 'l3 value');
      
      // Get from L1 should cascade through all levels
      const result = await l1CacheChained.get('key1');
      expect(result).toBe('l3 value');
      
      // Should now be cached in all levels
      expect(l1CacheChained.getIfAvailable('key1')).toBe('l3 value');
      expect(l2CacheChained.getIfAvailable('key1')).toBe('l3 value');
      expect(l3Cache.getIfAvailable('key1')).toBe('l3 value');
    });
  });
});
