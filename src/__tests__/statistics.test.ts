import { createCache, Cache, CacheOptions } from '../index';

describe('Cache Statistics', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    const options: CacheOptions<string> = {
      maxSize: 5,
      evictionPolicy: 'lru',
    };
    cache = createCache(options);
  });

  test('should track hits and misses', async () => {
    // Initial stats
    let stats = await cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRatio).toBe(0);

    // Cache miss
    await cache.get('missing');
    stats = await cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBe(0);

    // Cache hit
    await cache.set('key1', 'value1');
    await cache.get('key1');
    stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBe(0.5);

    // More hits
    await cache.get('key1');
    await cache.get('key1');
    stats = await cache.getStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBe(0.75);
  });

  test('should track cache size', async () => {
    let stats = await cache.getStats();
    expect(stats.size).toBe(0);

    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    stats = await cache.getStats();
    expect(stats.size).toBe(2);

    await cache.invalidate('key1');
    stats = await cache.getStats();
    expect(stats.size).toBe(1);

    await cache.invalidateAll();
    stats = await cache.getStats();
    expect(stats.size).toBe(0);
  });

  test('should track evictions', async () => {
    // Fill cache to capacity
    for (let i = 1; i <= 5; i++) {
      await cache.set(`key${i}`, `value${i}`);
    }

    let stats = await cache.getStats();
    expect(stats.evictions).toBe(0);

    // Add one more to trigger eviction
    await cache.set('key6', 'value6');
    stats = await cache.getStats();
    expect(stats.evictions).toBe(1);
    expect(stats.size).toBe(5); // Should maintain max size
  });

  test('should track byte size when maxSizeBytes is set', async () => {
    const options: CacheOptions<{ data: string }> = {
      maxSize: 100,
      maxSizeBytes: 1000,
      evictionPolicy: 'lru',
    };
    const byteCache = createCache(options);

    byteCache.set('small', { data: 'small' });
    byteCache.set('large', { data: 'a'.repeat(100) });

    const stats = await byteCache.getStats();
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.size).toBe(2);
  });

  test('should track prefetches when prefetch is enabled', async () => {
    let mockTime = 1000;
    const timeFunction = jest.fn(() => mockTime);
    
    const fetchFunction = jest.fn()
      .mockResolvedValueOnce('initial')
      .mockResolvedValueOnce('prefetched');

    const options: CacheOptions<string> = {
      maxSize: 100,
      evictionPolicy: 'lru',
      ttl: 1000,
      prefetchAfter: 500,
      fetchFunction,
      time: timeFunction,
    };
    
    const prefetchCache = createCache(options);

    // Initial fetch
    await prefetchCache.get('key1');
    let stats = await prefetchCache.getStats();
    expect(stats.prefetches).toBe(0);

    // Advance time to trigger prefetch
    mockTime += 600;
    await prefetchCache.get('key1');
    
    // Wait for prefetch to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    stats = await prefetchCache.getStats();
    expect(stats.prefetches).toBe(1);
  });

  test('should return immutable stats object', async () => {
    await cache.set('key1', 'value1');
    const stats1 = await cache.getStats();
    const stats2 = await cache.getStats();

    // Should be different objects
    expect(stats1).not.toBe(stats2);
    
    // But with same values
    expect(stats1).toEqual(stats2);

    // Modifying returned stats shouldn't affect internal state
    stats1.hits = 999;
    const stats3 = await cache.getStats();
    expect(stats3.hits).not.toBe(999);
  });

  test('should correctly calculate hit ratio edge cases', async () => {
    // No operations yet
    let stats = await cache.getStats();
    expect(stats.hitRatio).toBe(0);

    // Only misses
    await cache.get('missing1');
    await cache.get('missing2');
    stats = await cache.getStats();
    expect(stats.hitRatio).toBe(0);

    // First hit
    await cache.set('key1', 'value1');
    await cache.get('key1');
    stats = await cache.getStats();
    expect(stats.hitRatio).toBe(1/3); // 1 hit, 2 misses

    // More complex ratio
    await cache.get('key1'); // hit
    await cache.get('key1'); // hit
    await cache.get('missing3'); // miss
    stats = await cache.getStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(3);
    expect(stats.hitRatio).toBe(0.5);
  });
});
