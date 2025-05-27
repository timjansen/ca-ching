import { createCache, Cache, CacheOptions } from '../index';

describe('Debug LRU Eviction', () => {
  test('debug LRU behavior', async () => {
    const options: CacheOptions<string> = {
      maxSize: 3,
      evictionPolicy: 'lru',
    };
    
    const cache = createCache(options);
    
    // Fill cache
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    await cache.set('key3', 'value3');
    
    let stats = await cache.getStats();
    expect(stats.size).toBe(3);
    
    // Access key1 and key3 to make it recently used
    const key1Value = await cache.get('key1');
    expect(key1Value).toBe('value1');
    const key3Value = await cache.get('key3');
    expect(key3Value).toBe('value3');
    
    // Add another item, should evict key2 (least recently used)
    await cache.set('key4', 'value4');
    
    stats = await cache.getStats();
    expect(stats.size).toBe(3);
    expect(stats.evictions).toBe(1);
    
    // key1 should still exist (was accessed)
    // key2 should be evicted (least recently used)
    // key3 and key4 should exist
    expect(cache.getIfAvailable('key1')).toBe('value1');
    expect(cache.getIfAvailable('key2')).toBeUndefined();
    expect(cache.getIfAvailable('key3')).toBe('value3');
    expect(cache.getIfAvailable('key4')).toBe('value4');
  });
});
