import { createCache, Cache, CacheOptions } from '../src/index';

describe('Cache Basic Operations', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    const options: CacheOptions<string> = {
      maxSize: 100,
      evictionPolicy: 'lru',
    };
    cache = createCache(options);
  });

  describe('get and set operations', () => {
    test('should set and get a value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    test('should return undefined for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    test('should handle array keys', async () => {
      await cache.set(['user', '123', 'profile'], 'user profile data');
      const result = await cache.get(['user', '123', 'profile']);
      expect(result).toBe('user profile data');
    });

    test('should set and resolve Promise values', async () => {
      const promise = Promise.resolve('async value');
      await cache.set('async-key', promise);
      const result = await cache.get('async-key');
      expect(result).toBe('async value');
    });
  });

  describe('getIfAvailable', () => {
    test('should return value if available',async () => {
      await cache.set('key1', 'value1');
      const result = cache.getIfAvailable('key1');
      expect(result).toBe('value1');
    });

    test('should return undefined for non-existent key', () => {
      const result = cache.getIfAvailable('nonexistent');
      expect(result).toBeUndefined();
    });

    test('should return undefined for Promise values', async () => {
      await cache.set('async-key', Promise.resolve('async value'));
      const result = cache.getIfAvailable('async-key');
      expect(result).toBeUndefined();
    });
  });

  describe('getOrSet', () => {
    test('should return existing value', async () => {
      await cache.set('existing', 'existing value');
      
      const result = await cache.getOrSet('existing', () => 'new value');
      expect(result).toBe('existing value');
    });

    test('should set and return new value', async () => {
      const result = await cache.getOrSet('new-key', () => 'new value');
      expect(result).toBe('new value');
      
      const retrieved = await cache.get('new-key');
      expect(retrieved).toBe('new value');
    });

    test('should handle async callbacks', async () => {
      const result = await cache.getOrSet('async-new', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async new value';
      });
      
      expect(result).toBe('async new value');
    });
  });
});
