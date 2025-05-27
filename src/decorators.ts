import { CacheKey } from './types';
import { getRegisteredCache } from './cache-registry';
import { keyToString } from './utils';

/**
 * Decorator type definition 
 */
type MethodDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T>;

/**
 * Builds a cache key from function arguments
 * 
 * Note: For decorator use, indexes are 1-based ('this' at index 0 is excluded)
 * But when slicing the args array, we need to convert to 0-based indexing
 */
function buildCacheKey(
  args: any[],
  firstArg: number,
  lastArg?: number,
  cacheKeyBuilder?: (args: any[]) => CacheKey
): CacheKey {
  // Validate firstArg is at least 1
  if (firstArg < 1) {
    throw new Error('firstArg must be at least 1. The first argument (index 0) is reserved for the class instance.');
  }
  
  // Convert from decorator's 1-based indexing to JS 0-based indexing
  const firstArgIndex = firstArg - 1;
  
  // If lastArg is not specified, use all remaining arguments
  const effectiveLastArg = lastArg !== undefined ? lastArg - 1 : args.length - 1;
  
  // Extract the relevant arguments
  const relevantArgs = args.slice(firstArgIndex, effectiveLastArg + 1);
  
  // Use custom key builder if provided
  if (cacheKeyBuilder) {
    return cacheKeyBuilder(relevantArgs);
  }
  
  // Default key building: if single arg, use it directly; otherwise create string array
  if (relevantArgs.length === 1) {
    return relevantArgs[0];
  } else {
    return relevantArgs.map(arg => String(arg));
  }
}

/**
 * Decorator for caching method results
 * 
 * @param name The name of the cache to use
 * @param firstArg Index of the first argument to use in the cache key (1-based)
 * @param lastArg Optional index of the last argument to use (1-based)
 * @param cacheKeyBuilder Optional custom function to build the cache key
 */
export function CacheGet(
  name: string,
  firstArg: number = 1,
  lastArg?: number,
  cacheKeyBuilder?: (args: any[]) => CacheKey
): MethodDecorator {
  return function(target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): TypedPropertyDescriptor<any> {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      throw new Error(`Cannot apply @CacheGet to ${String(propertyKey)} as it is not a method`);
    }
    
    descriptor.value = async function(...args: any[]) {
      const cache = getRegisteredCache(name);
      
      if (!cache) {
        console.warn(`Cache '${name}' not found. The method will be called without caching.`);
        return originalMethod.apply(this, args);
      }
      
      try {
        const key = buildCacheKey(args, firstArg, lastArg, cacheKeyBuilder);
        
        // Try to get from cache first
        const cachedValue = await cache.get(key);
        if (cachedValue !== undefined) {
          return cachedValue;
        }
        
        // If not in cache, call the method and cache the result
        const result = await originalMethod.apply(this, args);
        await cache.set(key, result);
        return result;
      } catch (error) {
        console.error(`Error in @CacheGet for ${String(propertyKey)}:`, error);
        return originalMethod.apply(this, args);
      }
    };
    
    return descriptor;
  };
}

/**
 * Decorator for putting method parameter into cache
 * 
 * @param name The name of the cache to use
 * @param objectArg Index of the argument to store in the cache (1-based)
 * @param firstArg Index of the first argument to use in the cache key (1-based)
 * @param lastArg Optional index of the last argument to use (1-based)
 * @param cacheKeyBuilder Optional custom function to build the cache key
 */
export function CachePut(
  name: string,
  objectArg: number,
  firstArg: number,
  lastArg?: number,
  cacheKeyBuilder?: (args: any[]) => CacheKey
): MethodDecorator {
  return function(target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): TypedPropertyDescriptor<any> {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      throw new Error(`Cannot apply @CachePut to ${String(propertyKey)} as it is not a method`);
    }
    
    // Validate objectArg is at least 1
    if (objectArg < 1) {
      throw new Error('objectArg must be at least 1. The first argument (index 0) is reserved for the class instance.');
    }
    
    descriptor.value = async function(...args: any[]) {
      const cache = getRegisteredCache(name);
      const result = await originalMethod.apply(this, args);
      
      if (!cache) {
        console.warn(`Cache '${name}' not found. The method was called but no caching occurred.`);
        return result;
      }
      
      try {
        // Object to cache must be specified in objectArg, which is 1-indexed to match the requirement
        const objectToCache = args[objectArg - 1];
        
        // The key is created using the specified key arguments
        const key = buildCacheKey(args, firstArg, lastArg, cacheKeyBuilder);
        
        // Store the object in the cache
        await cache.set(key, objectToCache);
      } catch (error) {
        console.error(`Error in @CachePut for ${String(propertyKey)}:`, error);
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Decorator for putting method result into cache
 * 
 * @param name The name of the cache to use
 * @param firstArg Index of the first argument to use in the cache key (1-based)
 * @param lastArg Optional index of the last argument to use (1-based)
 * @param cacheKeyBuilder Optional custom function to build the cache key
 */
export function CachePutResult(
  name: string,
  firstArg: number = 1,
  lastArg?: number,
  cacheKeyBuilder?: (args: any[]) => CacheKey
): MethodDecorator {
  return function(target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): TypedPropertyDescriptor<any> {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      throw new Error(`Cannot apply @CachePutResult to ${String(propertyKey)} as it is not a method`);
    }
    
    descriptor.value = async function(...args: any[]) {
      const cache = getRegisteredCache(name);
      
      if (!cache) {
        console.warn(`Cache '${name}' not found. The method will be called without caching.`);
        return originalMethod.apply(this, args);
      }
      
      try {
        const key = buildCacheKey(args, firstArg, lastArg, cacheKeyBuilder);
        
        // Try to get from cache first - this makes CachePutResult behave like CacheGet
        const cachedValue = await cache.get(key);
        if (cachedValue !== undefined) {
          return cachedValue;
        }
        
        // If not in cache, call the method and cache the result
        const result = await originalMethod.apply(this, args);
        await cache.set(key, result);
        return result;
      } catch (error) {
        console.error(`Error in @CachePutResult for ${String(propertyKey)}:`, error);
        return originalMethod.apply(this, args);
      }
    };
    
    return descriptor;
  };
}

/**
 * Decorator for invalidating cache entries
 * 
 * @param name The name of the cache to use
 * @param firstArg Index of the first argument to use in the cache key (1-based)
 * @param lastArg Optional index of the last argument to use (1-based)
 * @param cacheKeyBuilder Optional custom function to build the cache key
 */
export function CacheInvalidate(
  name: string,
  firstArg: number = 1,
  lastArg?: number,
  cacheKeyBuilder?: (args: any[]) => CacheKey
): MethodDecorator {
  return function(target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): TypedPropertyDescriptor<any> {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      throw new Error(`Cannot apply @CacheInvalidate to ${String(propertyKey)} as it is not a method`);
    }
    
    descriptor.value = async function(...args: any[]) {
      const cache = getRegisteredCache(name);
      const result = await originalMethod.apply(this, args);
      
      if (!cache) {
        console.warn(`Cache '${name}' not found. The method was called but no invalidation occurred.`);
        return result;
      }
      
      try {
        const key = buildCacheKey(args, firstArg, lastArg, cacheKeyBuilder);
        await cache.invalidate(key);
      } catch (error) {
        console.error(`Error in @CacheInvalidate for ${String(propertyKey)}:`, error);
      }
      
      return result;
    };
    
    return descriptor;
  };
}
