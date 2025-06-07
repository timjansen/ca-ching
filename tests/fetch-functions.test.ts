import { createCache, Cache, CacheOptions } from '../src/index';

describe('Cache Fetch Functions', () => {
  let mockTime: jest.Mock;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1000;
    mockTime = jest.fn(() => currentTime);
  });

  describe('basic fetch functionality', () => {
    test('should call fetch function when key not found', async () => {
      const fetchFunction = jest.fn().mockResolvedValue('fetched value');
      
      const options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
        fetchFunction,
      };
      
      const cache = createCache(options);
      
      const result = await cache.get('missing-key', { context: 'test' });
      
      expect(fetchFunction).toHaveBeenCalledWith('missing-key', { context: 'test' });
      expect(result).toBe('fetched value');
      
      // Should be cached now
      const cachedResult = await cache.get('missing-key');
      expect(cachedResult).toBe('fetched value');
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Should not fetch again
    });

    test('should handle fetch function errors gracefully', async () => {
      const fetchFunction = jest.fn().mockRejectedValue(new Error('Fetch failed'));
      
      const options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
        fetchFunction,
      };
      
      const cache = createCache(options);
      
      await expect(cache.get('missing-key')).rejects.toThrow('Fetch failed');
    });

    test('should handle sync fetch functions', async () => {
      const fetchFunction = jest.fn().mockReturnValue('sync fetched value');
      
      const options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
        fetchFunction,
      };
      
      const cache = createCache(options);
      
      const result = await cache.get('missing-key');
      
      expect(fetchFunction).toHaveBeenCalledWith('missing-key', undefined);
      expect(result).toBe('sync fetched value');
    });
  });

  describe('prefetch functionality', () => {
    test('should prefetch entries in background', async () => {
      const fetchFunction = jest.fn()
        .mockResolvedValueOnce('initial value')
        .mockResolvedValueOnce('prefetched value');
      
      const options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
        ttl: 1000,
        prefetchAfter: 500,
        fetchFunction,
        time: mockTime,
      };
      
      const cache = createCache(options);
      
      // Initial fetch
      let result = await cache.get('key1');
      expect(result).toBe('initial value');
      expect(fetchFunction).toHaveBeenCalledTimes(1);
      
      // Advance time to trigger prefetch threshold
      currentTime += 600;
      
      // This should trigger prefetch in background but return current value
      result = await cache.get('key1');
      expect(result).toBe('initial value'); // Still returns old value immediately
      
      // Wait a bit for prefetch to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(fetchFunction).toHaveBeenCalledTimes(2); // Prefetch should have been called
      
      // Next get should return the prefetched value
      result = await cache.get('key1');
      expect(result).toBe('prefetched value');
    });

    test('should not prefetch multiple times simultaneously', async () => {
      const fetchFunction = jest.fn()
        .mockResolvedValueOnce('initial value')
        .mockImplementation(() => new Promise(resolve => 
          setTimeout(() => resolve('prefetched value'), 50)
        ));
      
      const options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
        ttl: 1000,
        prefetchAfter: 500,
        fetchFunction,
        time: mockTime,
      };
      
      const cache = createCache(options);
      
      // Initial fetch
      await cache.get('key1');
      
      // Advance time to trigger prefetch
      currentTime += 600;
      
      // Multiple gets should only trigger one prefetch
      const promises = [
        cache.get('key1'),
        cache.get('key1'),
        cache.get('key1'),
      ];
      
      await Promise.all(promises);
      
      // Wait for prefetch to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchFunction).toHaveBeenCalledTimes(2); // Initial + one prefetch
    });

    test('should validate prefetchAfter is less than ttl', () => {
      expect(() => {
        createCache({
          maxSize: 100,
          evictionPolicy: 'lru',
          ttl: 1000,
          prefetchAfter: 1000, // Equal to TTL
        });
      }).toThrow('prefetchAfter must be less than ttl');
      
      expect(() => {
        createCache({
          maxSize: 100,
          evictionPolicy: 'lru',
          ttl: 1000,
          prefetchAfter: 1500, // Greater than TTL
        });
      }).toThrow('prefetchAfter must be less than ttl');
    });
  });

  describe('cache stampede prevention', () => {
    test('should share Promise values to prevent cache stampede', async () => {
      let fetchCount = 0;
      const fetchFunction = jest.fn().mockImplementation(() => {
        fetchCount++;
        return new Promise(resolve => 
          setTimeout(() => resolve(`value ${fetchCount}`), 50)
        );
      });
      
      const options: CacheOptions<string> = {
        maxSize: 100,
        evictionPolicy: 'lru',
        fetchFunction,
      };
      
      const cache = createCache(options);
      
      // Multiple concurrent gets should share the same Promise
      const promises = [
        cache.get('key1'),
        cache.get('key1'),
        cache.get('key1'),
      ];
      
      const results = await Promise.all(promises);
      
      // All should get the same value
      expect(results).toEqual(['value 1', 'value 1', 'value 1']);
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });
  });
});
