# Ca-ching 💰

A powerful, feature-rich TypeScript caching library for backend services with functional-style API and comprehensive caching capabilities.

## Features

- 🚀 **High Performance**: In-memory cache with efficient data structures
- 🔄 **Multi-level Caching**: Cascading cache support with automatic forwarding
- ⏰ **TTL Support**: Time-to-live with automatic expiration
- 🎯 **Eviction Policies**: LRU, FILO, and Random eviction strategies
- 📊 **Size Management**: Both entry count and byte size limits
- 🔄 **Fetch Functions**: Automatic cache population with prefetching
- 🛡️ **Cache Stampede Prevention**: Promise sharing for concurrent requests
- 📈 **Statistics**: Comprehensive hit/miss/eviction tracking
- 🏷️ **Flexible Keys**: String or array-based keys with prefix operations
- 🔧 **TypeScript**: Full type safety and IntelliSense support
- 🎭 **Decorators**: Method-level cache annotations for clean code

## Installation

```bash
npm install ca-ching
```

## Quick Start

```typescript
import { createCache } from 'ca-ching';

// Create a simple cache
const cache = createCache<string>({
  maxSize: 1000,
  evictionPolicy: 'lru',
  ttl: 5 * 60 * 1000, // 5 minutes
});

// Basic operations
cache.set('key1', 'value1');
const value = await cache.get('key1'); // 'value1'

// With automatic fetch function
const apiCache = createCache<User>({
  maxSize: 500,
  evictionPolicy: 'lru',
  fetchFunction: async (userId: string) => {
    return await fetchUserFromAPI(userId);
  },
});

// Automatically fetches and caches if not present
const user = await apiCache.get('user123');
```

## Core API

### Cache Creation

```typescript
import { createCache, CacheOptions } from 'ca-ching';

const cache = createCache<T>(options: CacheOptions<T>);
```

#### CacheOptions

```typescript
interface CacheOptions<T> {
  // Required
  maxSize: number;                    // Maximum number of entries
  evictionPolicy: 'lru' | 'filo' | 'random';

  // Optional
  maxSizeBytes?: number;              // Maximum size in bytes
  ttl?: number;                       // Time-to-live in milliseconds
  fetchFunction?: FetchFunction<T>;   // Auto-fetch missing values
  prefetchAfter?: number;             // Prefetch before expiration (ms)
  nextLevelCache?: Cache<T>;          // Multi-level caching
  serialize?: (value: T) => string;   // Custom serialization
  deserialize?: (data: string) => T;  // Custom deserialization
  time?: () => number;                // Custom time function
}
```

### Basic Operations

```typescript
// Set a value
cache.set(key: CacheKey, value: T, ttl?: number): void

// Get a value (with auto-fetch if configured)
cache.get(key: CacheKey, context?: any): Promise<T | undefined>

// Get only if available (no fetch, no promises)
cache.getIfAvailable(key: CacheKey): T | undefined

// Get or set with callback
cache.getOrSet(
  key: CacheKey,
  callback: (key: CacheKey, context?: any) => Promise<T> | T,
  context?: any,
  ttl?: number
): Promise<T>
```

### Cache Invalidation

```typescript
// Invalidate single key
cache.invalidate(key: CacheKey): void

// Invalidate by prefix (for array keys)
cache.invalidateByPrefix(prefix: string[]): void

// Clear entire cache
cache.invalidateAll(): void
```

### Statistics

```typescript
const stats = await cache.getStats();
// Returns: { hits, misses, size, sizeBytes, evictions, prefetches, hitRatio }
```

## Advanced Usage

### Multi-level Caching

```typescript
const l2Cache = createCache<string>({
  maxSize: 10000,
  evictionPolicy: 'lru',
  ttl: 60 * 60 * 1000, // 1 hour
});

const l1Cache = createCache<string>({
  maxSize: 1000,
  evictionPolicy: 'lru',
  ttl: 5 * 60 * 1000,  // 5 minutes
  nextLevelCache: l2Cache,
});

// Automatically checks L1 → L2 → fetch function
const value = await l1Cache.get('key');
```

### Fetch Functions with Context

```typescript
const userCache = createCache<User>({
  maxSize: 1000,
  evictionPolicy: 'lru',
  fetchFunction: async (userId: string, context: { includeProfile?: boolean }) => {
    return await fetchUser(userId, context?.includeProfile);
  },
});

// Pass context to fetch function
const user = await userCache.get('user123', { includeProfile: true });
```

### Prefetching

```typescript
const cache = createCache<string>({
  maxSize: 1000,
  evictionPolicy: 'lru',
  ttl: 10 * 60 * 1000,     // 10 minutes
  prefetchAfter: 8 * 60 * 1000, // Prefetch after 8 minutes
  fetchFunction: fetchData,
});

// Values are automatically refreshed in background before expiration
```

### Array Keys and Prefix Operations

```typescript
// Use array keys for hierarchical data
cache.set(['user', '123', 'profile'], userProfile);
cache.set(['user', '123', 'settings'], userSettings);
cache.set(['user', '456', 'profile'], otherProfile);

// Invalidate all data for a user
cache.invalidateByPrefix(['user', '123']);
```

### Promise Handling and Cache Stampede Prevention

```typescript
const cache = createCache<ExpensiveData>({
  maxSize: 100,
  evictionPolicy: 'lru',
  fetchFunction: async (key: string) => {
    // Expensive computation
    return await computeExpensiveData(key);
  },
});

// Multiple concurrent requests for the same key share the same Promise
const [result1, result2, result3] = await Promise.all([
  cache.get('expensive-key'),
  cache.get('expensive-key'),
  cache.get('expensive-key'),
]);
// fetchFunction called only once, all get the same result
```

### Size-based Eviction

```typescript
const cache = createCache<LargeObject>({
  maxSize: 1000,              // Max 1000 entries
  maxSizeBytes: 50 * 1024 * 1024, // Max 50MB total
  evictionPolicy: 'lru',
});

// Automatically evicts entries when either limit is exceeded
```

## Eviction Policies

### LRU (Least Recently Used)
Evicts the least recently accessed items first. Best for general-purpose caching.

### FILO (First In, Last Out)
Evicts the oldest items first. Good for time-sensitive data.

### Random
Evicts random items. Fastest eviction, good for high-throughput scenarios.

## TypeScript Support

Ca-ching is built with TypeScript and provides full type safety:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

const userCache = createCache<User>({
  maxSize: 1000,
  evictionPolicy: 'lru',
});

// Fully typed - TypeScript knows this returns User | undefined
const user: User | undefined = await userCache.get('user123');
```

## Decorators

Ca-ching provides TypeScript decorators for clean, declarative caching in your classes:

```typescript
import { createCache, CacheGet, CachePut, CachePutResult, CacheInvalidate } from 'ca-ching';

// Create and register a named cache
createCache({ name: 'userCache', maxSize: 1000, evictionPolicy: 'lru' });

class UserService {
  // Cache method results automatically
  @CacheGet('userCache')
  async getUser(id: string): Promise<User> {
    return this.fetchUserFromApi(id);
  }
  
  // Cache with multiple-argument keys
  @CacheGet('userCache', 1, 2)
  async getUserWithRole(id: string, role: string): Promise<User> {
    return this.fetchUserFromApi(id, role);
  }
  
  // Store an object in the cache
  @CachePut('userCache', 1, 2)
  async updateUser(user: User, id: string): Promise<void> {
    await this.updateUserInApi(user);
  }
  
  // Store the method result in the cache
  @CachePutResult('userCache')
  async createUser(userData: UserData): Promise<User> {
    const user = await this.createUserInApi(userData);
    return user;
  }
  
  // Invalidate cache entries
  @CacheInvalidate('userCache')
  async deleteUser(id: string): Promise<void> {
    await this.deleteUserFromApi(id);
  }
}
```

### Available Decorators

- **@CacheGet(name, firstArg?, lastArg?, cacheKeyBuilder?)** - Gets from cache or calls method and caches result
- **@CachePut(name, objectArg, firstArg, lastArg?, cacheKeyBuilder?)** - Puts a method parameter into the cache
- **@CachePutResult(name, firstArg?, lastArg?, cacheKeyBuilder?)** - Puts the method result into the cache
- **@CacheInvalidate(name, firstArg?, lastArg?, cacheKeyBuilder?)** - Invalidates cache entry

### Custom Cache Key Building

All decorators support custom key building:

```typescript
@CacheGet('userCache', 1, undefined, (args) => ['users', args[0], 'permissions'])
async getUserPermissions(id: string): Promise<string[]> {
  // Method will be cached with key ['users', id, 'permissions']
  return this.fetchUserPermissions(id);
}
```

## Performance Considerations

- **Memory Usage**: Monitor cache stats and adjust `maxSize`/`maxSizeBytes` accordingly
- **TTL Strategy**: Set appropriate TTL values based on data freshness requirements  
- **Eviction Policy**: Choose based on access patterns (LRU for general use, FILO for time-sensitive)
- **Prefetching**: Use to reduce latency for frequently accessed data
- **Multi-level**: Use L1/L2 pattern for optimal memory usage vs hit rate

## Testing

Ca-ching includes comprehensive tests covering all features:

```bash
npm test
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Changelog

### 0.0.1
- Initial release
- Full feature set implementation
- Comprehensive test coverage
- TypeScript support
- Documentation
