import { Effect } from 'effect';
import { CachedResultSchema } from './schemas';
import { CacheError } from './errors';
import { z } from 'zod';

// Cache TTL: 7 days in milliseconds
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// Get cached result for domain
function getCached(domain: string): Effect.Effect<z.infer<typeof CachedResultSchema> | null, CacheError> {
  return Effect.tryPromise({
    try: async () => {
      const key = `eushield_${domain}`;
      const result = await chrome.storage.local.get(key);
      
      if (!result[key]) {
        return null;
      }
      
      // Validate with Zod schema
      const parsed = CachedResultSchema.safeParse(result[key]);
      
      if (!parsed.success) {
        // Remove corrupted entry
        await chrome.storage.local.remove(key);
        throw new CacheError({ reason: 'validation_failed', domain });
      }
      
      const cached = parsed.data;
      
      // Check if cache is expired
      if (Date.now() - cached.timestamp > CACHE_TTL) {
        await chrome.storage.local.remove(key);
        return null;
      }
      
      return cached;
    },
    catch: error => {
      if (error instanceof CacheError) {
        return error;
      }
      return new CacheError({ reason: 'read_failed', domain });
    }
  });
}

// Set cache for domain
function setCache(domain: string, result: z.infer<typeof CachedResultSchema>): Effect.Effect<void, CacheError> {
  return Effect.tryPromise({
    try: async () => {
      const key = `eushield_${domain}`;
      const cacheEntry = CachedResultSchema.parse({
        ...result,
        timestamp: Date.now()
      });
      
      await chrome.storage.local.set({ [key]: cacheEntry });
    },
    catch: error => {
      return new CacheError({ reason: 'write_failed', domain });
    }
  });
}

// Clear cache for domain
function clearCache(domain: string): Effect.Effect<void, CacheError> {
  return Effect.tryPromise({
    try: async () => {
      const key = `eushield_${domain}`;
      await chrome.storage.local.remove(key);
    },
    catch: error => {
      return new CacheError({ reason: 'write_failed', domain });
    }
  });
}

export { getCached, setCache, clearCache };