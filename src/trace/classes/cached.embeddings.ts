import { OpenAIEmbeddings, OpenAIEmbeddingsParams } from "@langchain/openai";
import { createHash } from "crypto";

/**
 * Cache for embeddings to avoid repeated API calls for the same text
 */
export class CachedEmbeddings extends OpenAIEmbeddings {
  private cache: Map<string, number[]> = new Map();
  private enableCache: boolean = true;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(
    params: {
      apiKey?: string;
      enableCache?: boolean;
    } = {}
  ) {
    // Extract OpenAI params from our custom params
    const { enableCache, ...openAIParams } = params;
    super(openAIParams);

    if (params.enableCache !== undefined) {
      this.enableCache = params.enableCache;
    }
  }

  /**
   * Generate a cache key for text
   * @param text The text to generate a key for
   * @returns A hash of the text to use as cache key
   */
  private generateCacheKey(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  /**
   * Get cache statistics
   * @returns Object with cache hit and miss counts
   */
  public getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
    };
  }

  /**
   * Clear the embeddings cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get the size of the cache
   * @returns Number of items in the cache
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Override the embedQuery method to add caching
   * @param text The text to embed
   * @returns The embedding
   */
  override async embedQuery(text: string): Promise<number[]> {
    if (!this.enableCache) {
      return super.embedQuery(text);
    }

    const cacheKey = this.generateCacheKey(text);
    const cachedEmbedding = this.cache.get(cacheKey);

    if (cachedEmbedding) {
      this.cacheHits++;
      return cachedEmbedding;
    }

    this.cacheMisses++;
    const embedding = await super.embedQuery(text);
    this.cache.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * Override the embedDocuments method to add caching
   * @param documents The documents to embed
   * @returns The embeddings
   */
  override async embedDocuments(documents: string[]): Promise<number[][]> {
    if (!this.enableCache) {
      return super.embedDocuments(documents);
    }

    const embeddings: number[][] = [];
    const uncachedDocs: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each document
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const cacheKey = this.generateCacheKey(doc);
      const cachedEmbedding = this.cache.get(cacheKey);

      if (cachedEmbedding) {
        this.cacheHits++;
        embeddings[i] = cachedEmbedding;
      } else {
        uncachedDocs.push(doc);
        uncachedIndices.push(i);
      }
    }

    // If there are documents not in cache, embed them
    if (uncachedDocs.length > 0) {
      this.cacheMisses += uncachedDocs.length;
      const newEmbeddings = await super.embedDocuments(uncachedDocs);

      // Store new embeddings in cache and result array
      for (let i = 0; i < newEmbeddings.length; i++) {
        const doc = uncachedDocs[i];
        const embedding = newEmbeddings[i];
        const cacheKey = this.generateCacheKey(doc);

        this.cache.set(cacheKey, embedding);
        embeddings[uncachedIndices[i]] = embedding;
      }
    }

    return embeddings;
  }
}
