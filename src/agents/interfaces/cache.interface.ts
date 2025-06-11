/**
 * Interface for LLM response caching
 */
export interface ILLMCache {
  /**
   * Get cached response for a prompt if available
   * @param key The cache key
   * @returns The cached response or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Store a response in the cache
   * @param key The cache key
   * @param value The response to cache
   * @param ttl Time to live in seconds
   */
  set(key: string, value: string, ttl?: number): Promise<void>;

  /**
   * Check if a key exists in the cache
   * @param key The cache key
   * @returns Whether the key exists in the cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear the entire cache or specific keys
   * @param keys Optional keys to clear. If not provided, clears entire cache.
   */
  clear(keys?: string[]): Promise<void>;
}

/**
 * In-memory implementation of ILLMCache
 */
export class InMemoryLLMCache implements ILLMCache {
  private cache: Map<string, { value: string; expiry: number | null }> =
    new Map();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);

    if (!item) return null;

    // Check if the item has expired
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + ttl * 1000 : null;
    this.cache.set(key, { value, expiry });
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async clear(keys?: string[]): Promise<void> {
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Factory for creating LLM caches
 */
export class LLMCacheFactory {
  private static instance: ILLMCache | null = null;

  /**
   * Get a singleton cache instance
   */
  static getCache(): ILLMCache {
    if (!this.instance) {
      this.instance = new InMemoryLLMCache();
    }
    return this.instance;
  }
}
