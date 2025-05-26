# LLM Caching Implementation

## Overview

This document describes the LLM caching implementation added to the trace-station project to make LLM requests faster and more efficient. The implementation provides two main types of caching:

1. **LLM Response Caching**: Caches responses from LLM models to avoid redundant API calls for identical prompts
2. **Embedding Caching**: Caches OpenAI embeddings to reduce API calls when embedding the same text multiple times

## Benefits

- **Reduced API costs**: Fewer API calls to OpenAI and Anthropic
- **Faster response times**: Cached responses are returned immediately
- **Improved user experience**: More consistent performance, especially for repeated queries
- **Reduced rate limiting issues**: Less risk of hitting API rate limits

## Implementation Details

### LLM Response Caching

The implementation adds a caching layer to the `BaseAgent` class, which all agent classes inherit from. The cache uses a SHA-256 hash of the formatted input as the cache key.

Key files:
- `src/agents/interfaces/cache.interface.ts`: Defines the caching interface and in-memory implementation
- `src/agents/agent/base.agent.ts`: Updated to include caching functionality

Features:
- In-memory cache with configurable TTL (time-to-live)
- Support for enabling/disabling cache per agent
- Cache statistics tracking (planned future addition)

### Embedding Caching

A new `CachedEmbeddings` class extends the `OpenAIEmbeddings` class to add caching for embedding operations. This significantly reduces API calls when retrieving similar documents from the vector store.

Key files:
- `src/trace/classes/cached.embeddings.ts`: Implements caching for embeddings
- `src/trace/classes/playwright.docs.class.ts`: Updated to use CachedEmbeddings

Features:
- In-memory cache for both single embeddings and document batches
- Cache hit/miss statistics
- Methods to clear cache and get cache statistics

## Usage

### Configuring LLM Response Caching

When creating an agent, you can configure caching:

```typescript
const agent = new DiagnosisAgent(apiKey, modelProvider, {
  enableCache: true,  // Enable/disable caching
  cacheTTL: 3600      // Cache TTL in seconds (1 hour)
});
```

### Configuring Embedding Caching

The `CachedEmbeddings` class is used automatically in the `PlaywrightDocs` class. You can access cache statistics:

```typescript
const docs = new PlaywrightDocs();
const stats = docs.getEmbeddingCacheStats();
console.log(`Cache hit rate: ${stats.hitRate * 100}%`);
```

## Testing

A test script has been created to verify the caching implementation:

```
npx ts-node -r tsconfig-paths/register src/test-caching.ts
```

This script demonstrates:
1. Embedding cache hits when running the same query twice
2. LLM response cache hits when running the same agent with identical input

## Future Improvements

Potential future enhancements include:
- Persistent caching across application restarts
- Distributed caching for multi-instance deployments
- More sophisticated cache invalidation strategies
- Cache warming for common queries
- Better cache statistics and monitoring
- Redis or other external cache backends 