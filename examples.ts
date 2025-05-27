import { CacheKey, createCache } from './src/index';

// Example 1: Basic caching
console.log('=== Basic Caching Example ===');
const basicCache = createCache<string>({
  maxSize: 100,
  evictionPolicy: 'lru',
  ttl: 5000, // 5 seconds
});

basicCache.set('greeting', 'Hello, World!');
console.log('Cached value:', await basicCache.get('greeting'));

// Example 2: API caching with fetch function
console.log('\n=== API Caching Example ===');

interface User {
  id: string;
  name: string;
  email: string;
}

// Simulate API call
const fetchUser = async (cacheKey: CacheKey, userId: string): Promise<User> => {
  console.log(`Fetching user ${userId} from API...`);
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
  return {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`
  };
};

const userCache = createCache<User>({
  maxSize: 1000,
  evictionPolicy: 'lru',
  ttl: 10000, // 10 seconds
  fetchFunction: fetchUser,
});

// First call fetches from API
console.log('First call:', await userCache.get('123'));
// Second call uses cache
console.log('Second call:', await userCache.get('123'));

// Example 3: Multi-level caching
console.log('\n=== Multi-level Caching Example ===');

const l2Cache = createCache<string>({
  maxSize: 10000,
  evictionPolicy: 'lru',
  ttl: 60000, // 1 minute
});

const l1Cache = createCache<string>({
  maxSize: 100,
  evictionPolicy: 'lru',
  ttl: 10000, // 10 seconds
  nextLevelCache: l2Cache,
  fetchFunction: async (cacheKey: CacheKey, key: string) => {
    console.log(`Fetching ${key} from source...`);
    return `Fresh data for ${key}`;
  },
});

console.log('Multi-level get:', await l1Cache.get('data123'));

// Example 4: Cache statistics
console.log('\n=== Cache Statistics Example ===');

const statsCache = createCache<number>({
  maxSize: 3,
  evictionPolicy: 'lru',
});

// Add some data
await statsCache.set('a', 1);
await statsCache.set('b', 2);
await statsCache.set('c', 3);
await statsCache.set('d', 4); // This will evict 'a'

// Check stats
const stats = await statsCache.getStats();
console.log('Cache stats:', {
  size: stats.size,
  evictions: stats.evictions,
  hitRatio: stats.hitRatio,
});

// Test hits and misses
await statsCache.get('b'); // hit
await statsCache.get('x'); // miss

const finalStats = await statsCache.getStats();
console.log('Final stats:', {
  hits: finalStats.hits,
  misses: finalStats.misses,
  hitRatio: finalStats.hitRatio,
});

console.log('\n=== Examples Complete ===');
