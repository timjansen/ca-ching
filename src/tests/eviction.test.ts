import { createCache, Cache, CacheOptions } from '../index';

describe('Cache Eviction Policies', () => {
  describe('LRU Eviction', () => {
    test('should evict least recently used items', async () => {
      let mockTime = 1000;
      const timeFunction = () => mockTime++;
      
      const options: CacheOptions<string> = {
        maxSize: 3,
        evictionPolicy: 'lru',
        time: timeFunction,
      };
      
      const cache = createCache(options);
      
      // Fill cache
      await cache.set('key1', 'value1'); // time: 1000
      await cache.set('key2', 'value2'); // time: 1001
      await cache.set('key3', 'value3'); // time: 1002
      
      // Access key1 to make it recently used
      await cache.get('key1'); // lastAccessed: 1003
      
      // Add another item, should evict key2 (least recently used)
      await cache.set('key4', 'value4'); // time: 1004, should evict key2
      
      expect(await cache.get('key1')).toBe('value1'); // Should still exist
      expect(await cache.get('key2')).toBeUndefined(); // Should be evicted
      expect(await cache.get('key3')).toBe('value3'); // Should still exist
      expect(await cache.get('key4')).toBe('value4'); // Should exist
    });
  });

  describe('FILO Eviction', () => {
    test('should evict oldest items first', async () => {
      let mockTime = 1000;
      const timeFunction = () => mockTime++;
      
      const options: CacheOptions<string> = {
        maxSize: 3,
        evictionPolicy: 'filo',
        time: timeFunction,
      };
      
      const cache = createCache(options);
      
      // Fill cache
      await cache.set('key1', 'value1'); // time: 1000 (oldest)
      await cache.set('key2', 'value2'); // time: 1001
      await cache.set('key3', 'value3'); // time: 1002
      
      // Access key1 (this shouldn't matter for FILO)
      await cache.get('key1'); // lastAccessed: 1003
      
      // Add another item, should evict key1 (oldest)
      await cache.set('key4', 'value4'); // time: 1004, should evict key1
      
      expect(await cache.get('key1')).toBeUndefined(); // Should be evicted (oldest)
      expect(await cache.get('key2')).toBe('value2'); // Should still exist
      expect(await cache.get('key3')).toBe('value3'); // Should still exist
      expect(await cache.get('key4')).toBe('value4'); // Should exist
    });
  });

  describe('Random Eviction', () => {
    test('should evict random items', async () => {
      const options: CacheOptions<string> = {
        maxSize: 3,
        evictionPolicy: 'random',
      };
      
      const cache = createCache(options);
      
      // Fill cache
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // Add another item, should evict one random item
      await cache.set('key4', 'value4');
      
      // Should have exactly 3 items and one eviction
      const stats = await cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.evictions).toBe(1);
      
      // At least 3 of the 4 keys should exist (random eviction)
      const values = await Promise.all([
        cache.get('key1'),
        cache.get('key2'),
        cache.get('key3'),
        cache.get('key4'),
      ]);
      
      const existingKeys = values.filter(v => v !== undefined).length;
      expect(existingKeys).toBe(3);
    });
  });

  describe('Size-based eviction', () => {
    test('should respect maxSize limit', async () => {
      const options: CacheOptions<string> = {
        maxSize: 2,
        evictionPolicy: 'lru',
      };
      
      const cache = createCache(options);
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3'); // Should trigger eviction
      
      const stats = await cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.evictions).toBe(1);
    });
  });
});
