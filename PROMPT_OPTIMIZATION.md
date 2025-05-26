# Prompt Optimization Implementation

## Overview

This document describes the prompt optimization techniques implemented in the trace-station project to reduce token usage and improve LLM response times. The implementation provides intelligent prompt compression and prioritization while maintaining the quality of responses.

## Key Benefits

- **Reduced Token Usage**: Up to 77% reduction in prompt size for large traces
- **Lower API Costs**: Fewer tokens means lower costs for API calls
- **Faster Response Times**: Smaller prompts lead to quicker processing
- **Prioritized Information**: Critical information is preserved while less important data is summarized or truncated
- **Improved Focus**: LLMs can focus on the most relevant information

## Test Results

Tests comparing traditional prompts with optimized prompts show significant improvements:

- **Regular Traces**: ~2-5% reduction in prompt size
- **Large Traces**: ~75-80% reduction in prompt size
- **System Prompts**: ~5-6% reduction in size

## Implementation Details

### Core Components

1. **Prompt Utilities** (`src/utils/prompt.utils.ts`):
   - Basic text compression functions
   - Truncation utilities for long text sections
   - System prompt optimization

2. **Base Prompt Optimizer** (`src/utils/prompt.optimizer.ts`):
   - Implements trace formatting with intelligent prioritization
   - Handles different content types appropriately (errors, actions, network requests)
   - Maintains a common interface for all agent types

3. **Agent-Specific Optimizers**:
   - `DiagnosisPromptOptimizer`
   - `RecommendationPromptOptimizer`
   - More can be added for other agent types

### Key Techniques

#### 1. Smart Section Prioritization

Different sections are optimized based on their content type:

- **Error Messages**: Preserved intact as they're critical for diagnosis
- **Stack Traces**: First few and last few lines kept, middle summarized
- **Action Timelines**: Failed actions always included, successful actions sampled
- **Network Requests**: Failed requests (4xx/5xx) prioritized over successful ones
- **Console Messages**: Errors and warnings prioritized over informational logs

#### 2. Content-Aware Compression

- **URLs**: Long URLs are shortened to their domain and first path segment
- **Repeated Patterns**: Similar messages are deduplicated or summarized
- **Whitespace**: Excessive whitespace and formatting is normalized

#### 3. System Prompt Optimization

- **Concise Language**: Verbose phrases replaced with shorter equivalents
- **Unnecessary Words**: Filler words and redundant phrases removed
- **Formatting**: Consistent, compact formatting applied

## Usage

Each agent now uses its specialized prompt optimizer:

```typescript
// DiagnosisAgent example
async formatInput(input: AgentInput): Promise<string> {
  // Use the prompt optimizer to generate an optimized prompt
  return this.promptOptimizer.generatePrompt(
    input,
    this.systemPrompt,
    this.outputParser.getFormatInstructions()
  );
}
```

## Future Improvements

Potential enhancements include:

- **Adaptive Optimization**: Adjust compression based on token limits
- **Dynamic Section Sizing**: Allocate tokens to sections based on importance
- **Semantic Compression**: Use embeddings to detect and merge similar content
- **Token-Aware Trimming**: Optimize specifically for token boundaries
- **Multi-modal Support**: Handle and optimize images and other media types

## Best Practices

When working with the prompt optimization system:

1. **Use Specialized Optimizers**: Create agent-specific optimizers for best results
2. **Test on Extreme Cases**: Verify optimization works on very large traces
3. **Balance Compression vs. Context**: Ensure critical context is preserved
4. **Monitor Token Usage**: Track before/after token counts to validate savings 