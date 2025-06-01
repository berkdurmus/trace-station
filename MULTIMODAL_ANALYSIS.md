# Multi-Modal Test Analysis System

## Overview

The trace-station project now includes a powerful multi-modal analysis system that combines different data types (modalities) to provide comprehensive test failure analysis. This system goes beyond simple error messages to understand the root causes of test failures by analyzing:

1. **Visual Data**: Screenshots captured during test execution
2. **DOM Structure**: HTML snapshots of the page state
3. **Network Activity**: API calls, responses, and errors
4. **Console Output**: Error messages and logs
5. **Test Actions**: Interactions performed during the test

By integrating these different modalities, the system can provide much richer insights than any single modality could achieve alone.

## Key Features

- **Cross-modal Analysis**: Analyzes relationships between different data types
- **Synchronized Timeline**: Aligns events across modalities by timestamp
- **Root Cause Identification**: Determines the most likely cause of test failures
- **Confidence Scoring**: Provides certainty levels for analysis results
- **Suggested Fixes**: Offers potential solutions to resolve test failures
- **Persistent Storage**: Stores analysis results in ClickHouse for historical tracking

## Architecture

The multi-modal analysis system consists of several key components:

1. **Core Service**: `MultiModalAnalysisService` orchestrates the analysis process
2. **Modality Analyzers**: Specialized services for each data type
   - `VisualAnalyzerService`: Processes screenshots
   - `DOMAnalyzerService`: Analyzes HTML structure
   - `NetworkAnalyzerService`: Examines network requests
3. **Data Synchronization**: Aligns events from different modalities by timestamp
4. **Combined Analysis**: Integrates insights from all modalities
5. **ClickHouse Storage**: Persists analysis results for reporting and trending

## Implementation Details

### Data Model

The system introduces several new data structures:

- `DOMSnapshotData`: Captures the HTML state at specific points
- `SynchronizedDataPoint`: Combines data from all modalities at a specific timestamp
- `ModalityAnalysis`: Results from analyzing a specific modality
- `MultiModalAnalysisResult`: The combined analysis from all modalities

### Analysis Process

1. **Data Collection**: Gather data from all available modalities
2. **Synchronization**: Align data points by timestamp
3. **Modality Analysis**: Process each modality independently
4. **Integration**: Combine insights from all modalities
5. **Root Cause Determination**: Identify the most likely cause of failure
6. **Fix Generation**: Suggest potential solutions
7. **Storage**: Persist results for future reference

## Usage

### Basic Usage

```typescript
// Create an instance of the service
const multiModalAnalysis = new MultiModalAnalysisService();

// Initialize the service
await multiModalAnalysis.initialize();

// Analyze a trace
const analysisResult = await multiModalAnalysis.analyzeTrace(trace);

// Access the results
console.log(`Root Cause: ${analysisResult.rootCause}`);
console.log(`Explanation: ${analysisResult.explanation}`);
console.log(`Suggested Fix: ${analysisResult.suggestedFix}`);
```

### Configuration Options

The system can be configured with various options:

```typescript
const multiModalAnalysis = new MultiModalAnalysisService({
  enabledModalities: {
    visual: true,
    dom: true,
    network: true,
    console: true,
    action: true,
  },
  modalityWeights: {
    visual: 0.3,
    dom: 0.3,
    network: 0.2,
    console: 0.1,
    action: 0.1,
  },
  embeddingModel: "text-embedding-ada-002",
  visionModel: "gpt-4-vision-preview",
  textModel: "gpt-4-turbo",
  minConfidenceThreshold: 0.6,
});
```

### Running the Test Script

A test script is provided to demonstrate the system's capabilities:

```bash
npm run test-multimodal
```

## ClickHouse Integration

The system stores analysis results in ClickHouse tables:

1. **multimodal_data_points**: Raw data points from each modality
2. **multimodal_embeddings**: Vector embeddings of data points
3. **multimodal_analysis_results**: Final analysis results

## Future Enhancements

1. **Advanced Visual Analysis**: Implement computer vision to detect UI elements
2. **Neural Fusion**: Use neural networks for more sophisticated multi-modal fusion
3. **Self-Healing Tests**: Automatically update tests based on analysis results
4. **Interactive Visualization**: Create an interactive timeline of test execution
5. **Anomaly Detection**: Identify unusual patterns across test runs

## Technical Requirements

- Node.js 16+
- ClickHouse database
- OpenAI API access (for text and vision models)

## Environment Variables

Add the following to your `.env` file:

```
# OpenAI API key for embeddings and analysis
OPENAI_API_KEY=your-openai-api-key

# ClickHouse configuration
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DB=default
``` 