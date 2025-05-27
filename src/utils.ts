import { CacheKey } from './types';

/**
 * Convert cache key to string representation
 */
export function keyToString(key: CacheKey): string {
  if (typeof key === 'string') {
    return key;
  }
  return key.join('::');
}

/**
 * Check if a key starts with the given prefix
 */
export function keyStartsWith(key: CacheKey, prefix: string[]): boolean {
  const keyArray = typeof key === 'string' ? [key] : key;
  
  if (keyArray.length < prefix.length) {
    return false;
  }
  
  for (let i = 0; i < prefix.length; i++) {
    if (keyArray[i] !== prefix[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate the size in bytes of a JSON-serializable value
 */
export function calculateSizeBytes(value: any): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    // If value is not JSON-serializable, return 0
    return 0;
  }
}

/**
 * Check if a value is a Promise
 */
export function isPromise<T>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function';
}
