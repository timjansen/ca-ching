import { createCache, Cache, CacheOptions } from '../src/index';

describe('Cache TTL and Expiration', () => {
  let mockTime: jest.Mock;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1000;
    mockTime = jest.fn(() => currentTime);
  });

  test('should expire entries after TTL', async () => {
    const options: CacheOptions<string> = {
      maxSize: 100,
      evictionPolicy: 'lru',
      ttl: 1000, // 1 second
      time: mockTime,
    };
    
    const cache = createCache(options);
    
    cache.set('key1', 'value1');
    
    // Should be available immediately
    let result = await cache.get('key1');
    expect(result).toBe('value1');
    
    // Advance time beyond TTL
    currentTime += 1001;
    
    // Should be expired now
    result = await cache.get('key1');
    expect(result).toBeUndefined();
  });

  test('should use custom TTL for specific entries', async () => {
    const options: CacheOptions<string> = {
      maxSize: 100,
      evictionPolicy: 'lru',
      ttl: 1000,
      time: mockTime,
    };
    
    const cache = createCache(options);
    
    cache.set('short-lived', 'value1', 500); // 0.5 seconds
    cache.set('normal', 'value2'); // Use default TTL
    
    // Advance time to 600ms
    currentTime += 600;
    
    // Short-lived should be expired, normal should still be available
    let shortResult = await cache.get('short-lived');
    let normalResult = await cache.get('normal');
    
    expect(shortResult).toBeUndefined();
    expect(normalResult).toBe('value2');
  });

  test('should not expire entries without TTL', async () => {
    const options: CacheOptions<string> = {
      maxSize: 100,
      evictionPolicy: 'lru',
      time: mockTime,
    };
    
    const cache = createCache(options);
    
    cache.set('permanent', 'value1');
    
    // Advance time significantly
    currentTime += 1000000;
    
    // Should still be available
    const result = await cache.get('permanent');
    expect(result).toBe('value1');
  });
});
