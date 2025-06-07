import { createCache, Cache, CacheOptions } from '../src/index';

describe('Cache Byte Size Management',  () => {
  test('should respect maxSizeBytes limit', async () => {
    const options: CacheOptions<{ data: string }> = {
      maxSize: 100, // High entry limit
      maxSizeBytes: 200, // Low byte limit
      evictionPolicy: 'lru',
    };
    
    const cache = createCache(options);
    
    // Add small entries first
    await cache.set('small1', { data: 'a' });
    await cache.set('small2', { data: 'b' });
    
    let stats = await cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.sizeBytes).toBeLessThanOrEqual(200);
    
    // Add a large entry that should trigger byte-based eviction
    const largeData = { data: 'x'.repeat(200) }; // Make it larger to exceed limit
    await cache.set('large', largeData);
    
    stats = await cache.getStats();
    expect(stats.sizeBytes).toBeLessThanOrEqual(200);
    expect(stats.evictions).toBeGreaterThan(0);
  });

  test('should calculate byte size for JSON-compatible objects', async () => {
    const options: CacheOptions<any> = {
      maxSize: 100,
      maxSizeBytes: 1000,
      evictionPolicy: 'lru',
    };
    
    const cache = createCache(options);
    
    await cache.set('string', 'hello');
    await cache.set('number', 42);
    await cache.set('object', { name: 'test', value: 123 });
    await cache.set('array', [1, 2, 3, 'four']);
    
    const stats = await cache.getStats();
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.size).toBe(4);
  });

  test('should handle non-JSON-serializable values gracefully', async () => {
    const options: CacheOptions<any> = {
      maxSize: 100,
      maxSizeBytes: 1000,
      evictionPolicy: 'lru',
    };
    
    const cache = createCache(options);
    
    // Add values that can't be JSON-serialized
    const circular: any = { name: 'circular' };
    circular.self = circular;
    
    const withFunction = {
      name: 'test',
      fn: () => 'hello'
    };
    
    // Should not throw errors
    await cache.set('circular', circular);
    await cache.set('function', withFunction);
    
    const stats = await cache.getStats();
    expect(stats.size).toBe(2);
    // sizeBytes might be 0 or undefined for non-serializable values
  });
});

describe('Cache Promise Handling', () => {
  test('should cache Promise values and resolve them', async () => {
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    const promise = new Promise<string>(resolve => {
      setTimeout(() => resolve('resolved value'), 10);
    });
    
    await cache.set('async-key', promise);
    
    const result1 = await cache.get('async-key');
    const result2 = await cache.get('async-key');
    
    expect(result1).toBe('resolved value');
    expect(result2).toBe('resolved value');
  });

  test('should share Promise between concurrent gets', async () => {
    let resolveCount = 0;
    const fetchFunction = jest.fn().mockImplementation(() => {
      return new Promise<string>(resolve => {
        setTimeout(() => {
          resolveCount++;
          resolve(`resolved ${resolveCount}`);
        }, 20);
      });
    });
    
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
      fetchFunction,
    });
    
    // Start multiple concurrent gets
    const promises = [
      cache.get('key1'),
      cache.get('key1'),
      cache.get('key1'),
    ];
    
    const results = await Promise.all(promises);
    
    // All should get the same result from the shared Promise
    expect(results).toEqual(['resolved 1', 'resolved 1', 'resolved 1']);
    expect(fetchFunction).toHaveBeenCalledTimes(1);
    expect(resolveCount).toBe(1);
  });

  test('should handle Promise rejection', async () => {
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    const rejectedPromise = Promise.reject(new Error('Promise failed'));
    await cache.set('failing-key', rejectedPromise);
    
    await expect(cache.get('failing-key')).rejects.toThrow('Promise failed');
  });
});

describe('Cache Edge Cases', () => {
  test('should handle empty string keys', async () => {
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    await cache.set('', 'empty key value');
    const result = await cache.get('');
    expect(result).toBe('empty key value');
  });

  test('should handle empty array keys', async () => {
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    await cache.set([], 'empty array key value');
    const result = await cache.get([]);
    expect(result).toBe('empty array key value');
  });

  test('should handle special characters in keys', async () => {
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    await cache.set(specialKey, 'special value');
    const result = await cache.get(specialKey);
    expect(result).toBe('special value');
  });

  test('should handle Unicode in keys', async () => {
    const cache = createCache<string>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    const unicodeKey = '测试🚀💯';
    await cache.set(unicodeKey, 'unicode value');
    const result = await cache.get(unicodeKey);
    expect(result).toBe('unicode value');
  });

  test('should handle very large values', async () => {
    const cache = createCache<string>({
      maxSize: 10,
      evictionPolicy: 'lru',
    });
    
    const largeValue = 'x'.repeat(1000000); // 1MB string
    
    // Should not throw
    await cache.set('large', largeValue);
    const result = cache.getIfAvailable('large');
    expect(result).toBe(largeValue);
  });

  test('should handle rapid cache operations', async () => {
    const cache = createCache<number>({
      maxSize: 100,
      evictionPolicy: 'lru',
    });
    
    // Perform many operations rapidly
    const operations: Promise<unknown>[] = [];
    for (let i = 0; i < 1000; i++) {
      operations.push(
        new Promise((resolve)=>{cache.set(`key${i}`, i); resolve(true);}),
        cache.get(`key${i}`),
        new Promise((resolve)=>{cache.invalidate(`key${i - 10}`); resolve(true);}),
      );
    }
    
    // Should not throw or deadlock
    await Promise.all(operations);
    
    const stats = await cache.getStats();
    expect(stats.size).toBeLessThanOrEqual(100);
  });
});
