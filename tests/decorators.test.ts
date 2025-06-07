import { 
  createCache, 
  CacheGet, 
  CachePut, 
  CachePutResult, 
  CacheInvalidate,
  CacheKey 
} from '../src/index';

describe('Cache Decorators', () => {
  
  // Test class with cached methods
  class UserService {
    private apiCallCount = 0;
    
    constructor() {
      // Create and register the caches used by the decorators
      createCache({ name: 'userCache', maxSize: 100, evictionPolicy: 'lru' });
      createCache({ name: 'profileCache', maxSize: 100, evictionPolicy: 'lru' });
    }
    
    @CacheGet('userCache')
    async getUser(id: string): Promise<any> {
      this.apiCallCount++;
      return { id, name: `User ${id}`, timestamp: Date.now() };
    }
    
    @CacheGet('userCache', 1, 2)
    async getUserWithRole(id: string, role: string): Promise<any> {
      this.apiCallCount++;
      return { id, role, name: `User ${id}`, timestamp: Date.now() };
    }
    
    @CacheGet('userCache', 1, undefined, (args) => ['custom', ...args])
    async getUserWithCustomKey(id: string): Promise<any> {
      this.apiCallCount++;
      return { id, name: `Custom User ${id}`, timestamp: Date.now() };
    }
    
    @CachePut('userCache', 1, 2)
    async updateUser(user: any, id: string): Promise<void> {
      this.apiCallCount++;
      // Simulate API update - in real code this would update the backend
    }
    
    @CachePutResult('profileCache')
    async getUserProfile(id: string): Promise<any> {
      this.apiCallCount++;
      return { id, profile: `Profile for ${id}`, timestamp: Date.now() };
    }
    
    @CacheInvalidate('userCache')
    async deleteUser(id: string): Promise<void> {
      this.apiCallCount++;
      // Simulate API delete - in real code this would delete from backend
    }
    
    @CacheInvalidate('userCache', 1, undefined, (args) => ['custom', ...args])
    async deleteUserWithCustomKey(id: string): Promise<void> {
      this.apiCallCount++;
      // Simulate API delete - in real code this would delete from backend
    }
    
    getApiCallCount(): number {
      return this.apiCallCount;
    }
    
    resetApiCallCount(): void {
      this.apiCallCount = 0;
    }
  }
  
  let userService: UserService;
  
  // Add a function to clear the cache registry
  beforeEach(() => {
    // Clear any existing caches to avoid test interference
    const unregisterAllCaches = () => {
      // Import dynamically to avoid circular dependency
      const { getRegisteredCacheNames, unregisterCache } = require('../cache-registry');
      const cacheNames = getRegisteredCacheNames();
      cacheNames.forEach((name: string) => unregisterCache(name));
    };
    
    unregisterAllCaches();
    userService = new UserService();
    userService.resetApiCallCount();
  });
  
  describe('@CacheGet', () => {
    it('should cache and return values', async () => {
      // First call should miss the cache and call the method
      const user1 = await userService.getUser('123');
      expect(user1.id).toBe('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Second call should hit the cache and not call the method again
      const user2 = await userService.getUser('123');
      expect(user2.id).toBe('123');
      expect(userService.getApiCallCount()).toBe(1);
      expect(user1).toEqual(user2);
      
      // Different ID should miss and call the method again
      const user3 = await userService.getUser('456');
      expect(user3.id).toBe('456');
      expect(userService.getApiCallCount()).toBe(2);
    });
    
    it('should use multiple arguments to construct the key', async () => {
      // First call with id and role should miss
      const user1 = await userService.getUserWithRole('123', 'admin');
      expect(user1.id).toBe('123');
      expect(user1.role).toBe('admin');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Same id and role should hit cache
      const user2 = await userService.getUserWithRole('123', 'admin');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Same id but different role should miss
      const user3 = await userService.getUserWithRole('123', 'user');
      expect(userService.getApiCallCount()).toBe(2);
    });
    
    it('should use custom key builder if provided', async () => {
      // First call should miss
      const user1 = await userService.getUserWithCustomKey('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Same key should hit
      const user2 = await userService.getUserWithCustomKey('123');
      expect(userService.getApiCallCount()).toBe(1);
    });
  });
  
  describe('@CachePut', () => {
    it('should put objects in the cache', async () => {
      const user = { id: '123', name: 'Updated User', timestamp: Date.now() };
      
      // Put the user in cache
      await userService.updateUser(user, '123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Get should hit cache and return our manually cached object
      const cachedUser = await userService.getUser('123');
      expect(cachedUser).toEqual(user);
      expect(userService.getApiCallCount()).toBe(1); // No additional API call
    });
  });
  
  describe('@CachePutResult', () => {
    it('should put method result in the cache', async () => {
      // First call should call the method and cache result
      const profile1 = await userService.getUserProfile('123');
      expect(profile1.id).toBe('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Second call should hit cache
      const profile2 = await userService.getUserProfile('123');
      expect(profile2).toEqual(profile1);
      expect(userService.getApiCallCount()).toBe(1);
    });
  });
  
  describe('@CacheInvalidate', () => {
    it('should invalidate cached entries', async () => {
      // Prime the cache
      const user = await userService.getUser('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Verify it's cached
      await userService.getUser('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Invalidate
      await userService.deleteUser('123');
      expect(userService.getApiCallCount()).toBe(2);
      
      // Should miss now
      await userService.getUser('123');
      expect(userService.getApiCallCount()).toBe(3);
    });
    
    it('should invalidate with custom key builder', async () => {
      // Prime the cache
      const user = await userService.getUserWithCustomKey('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Verify it's cached
      await userService.getUserWithCustomKey('123');
      expect(userService.getApiCallCount()).toBe(1);
      
      // Invalidate
      await userService.deleteUserWithCustomKey('123');
      expect(userService.getApiCallCount()).toBe(2);
      
      // Should miss now
      await userService.getUserWithCustomKey('123');
      expect(userService.getApiCallCount()).toBe(3);
    });
  });
});
