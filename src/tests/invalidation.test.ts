import { createCache, Cache, CacheOptions } from '../index';

describe('Cache Invalidation', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    const options: CacheOptions<string> = {
      maxSize: 100,
      evictionPolicy: 'lru',
    };
    cache = createCache(options);
  });

  describe('invalidate by key', () => {
    test('should invalidate specific key', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      cache.invalidate('key1');
      
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBe('value2');
    });

    test('should handle array keys', async () => {
      await cache.set(['user', '123'], 'user data');
      await cache.set(['user', '456'], 'other user data');
      
      cache.invalidate(['user', '123']);
      
      expect(await cache.get(['user', '123'])).toBeUndefined();
      expect(await cache.get(['user', '456'])).toBe('other user data');
    });
  });

  describe('invalidateByPrefix', () => {
    test('should invalidate entries with matching prefix', async () => {
      await cache.set(['user', '123', 'profile'], 'profile data');
      await cache.set(['user', '123', 'settings'], 'settings data');
      await cache.set(['user', '456', 'profile'], 'other profile');
      await cache.set(['product', '789'], 'product data');
      
      cache.invalidateByPrefix(['user', '123']);
      
      expect(await cache.get(['user', '123', 'profile'])).toBeUndefined();
      expect(await cache.get(['user', '123', 'settings'])).toBeUndefined();
      expect(await cache.get(['user', '456', 'profile'])).toBe('other profile');
      expect(await cache.get(['product', '789'])).toBe('product data');
    });

    test('should handle string keys with prefix matching', async () => {
      // Note: string keys are treated as single-element arrays for prefix matching
      await cache.set('user', 'user data');
      await cache.set('user_profile', 'profile data');
      await cache.set('product', 'product data');
      
      cache.invalidateByPrefix(['user']);
      
      expect(await cache.get('user')).toBeUndefined();
      expect(await cache.get('user_profile')).toBe('profile data'); // Different key
      expect(await cache.get('product')).toBe('product data');
    });
  });

  describe('invalidateAll', () => {
    test('should invalidate all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set(['complex', 'key'], 'complex value');
      
      cache.invalidateAll();
      
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
      expect(await cache.get(['complex', 'key'])).toBeUndefined();
      
      const stats = await cache.getStats();
      expect(stats.size).toBe(0);
    });
  });
});
