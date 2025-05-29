# ClickHouse Analytics Implementation

## Overview

The trace-station project has been extended with analytics capabilities using ClickHouse, a high-performance column-oriented database. This implementation allows for tracking and analyzing:

1. **Vector store queries**: Performance and usage of the RAG system
2. **Document retrievals**: Which documentation is most frequently retrieved and most relevant
3. **Trace analysis**: Test execution metrics and failure statistics

The analytics system is designed to work alongside the existing FAISS vector database, providing complementary functionality without disrupting the core retrieval capabilities.

## Implementation Details

### Key Components

- **AnalyticsService**: A dedicated service for interacting with ClickHouse
- **PlaywrightDocs Integration**: The existing PlaywrightDocs class now tracks analytics data during document retrieval
- **ClickHouse Tables**: Three main tables for storing different types of analytics data

### ClickHouse Tables

The implementation creates three main tables in ClickHouse:

1. **query_analytics**: Stores information about vector queries
   ```sql
   CREATE TABLE query_analytics (
     timestamp DateTime DEFAULT now(),
     query String,
     num_results UInt8,
     latency_ms UInt32,
     user_id String DEFAULT '',
     session_id String DEFAULT '',
     trace_id String DEFAULT ''
   ) ENGINE = MergeTree()
   ORDER BY (timestamp, query)
   ```

2. **doc_retrievals**: Tracks which documents are retrieved
   ```sql
   CREATE TABLE doc_retrievals (
     timestamp DateTime DEFAULT now(),
     doc_id String,
     doc_title String,
     query String,
     relevance_score Float32,
     user_id String DEFAULT '',
     session_id String DEFAULT '',
     trace_id String DEFAULT ''
   ) ENGINE = MergeTree()
   ORDER BY (timestamp, doc_id)
   ```

3. **trace_analytics**: Records information about test traces
   ```sql
   CREATE TABLE trace_analytics (
     timestamp DateTime DEFAULT now(),
     trace_id String,
     test_file String,
     test_title String,
     duration_ms UInt32,
     status String,
     error_message String DEFAULT '',
     action_count UInt16,
     error_count UInt16
   ) ENGINE = MergeTree()
   ORDER BY (timestamp, trace_id)
   ```

## Configuration

To use ClickHouse analytics, add the following to your `.env` file:

```
# ClickHouse configuration
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DB=default
```

## Usage

### Testing the Analytics System

A test script is provided to verify the ClickHouse integration:

```bash
npm run test-analytics
```

This script:
1. Initializes the ClickHouse tables
2. Creates a mock trace
3. Retrieves documents using the PlaywrightDocs class (which now tracks analytics)
4. Makes direct calls to the analytics API
5. Retrieves and displays analytics data

### Analytics Queries

The `AnalyticsService` provides several methods for querying analytics data:

#### Top Queries
```typescript
const topQueries = await analytics.getTopQueries(5);
```

#### Query Latency Over Time
```typescript
const latencyData = await analytics.getQueryLatencyOverTime("1 day");
```

#### Most Retrieved Docs
```typescript
const topDocs = await analytics.getMostRetrievedDocs(5);
```

#### Test Failure Statistics
```typescript
const failureStats = await analytics.getTestFailureStats("7 days");
```

## Visualization

While the current implementation focuses on data collection and basic querying, the data in ClickHouse can be visualized using:

1. ClickHouse's built-in HTTP interface
2. Grafana with the ClickHouse data source
3. Metabase or other BI tools that support ClickHouse

## Future Improvements

Potential enhancements to the analytics system:

1. **Real-time dashboards**: Implement a dashboard UI for viewing analytics in real-time
2. **Advanced metrics**: Add more complex metrics like document relevance distribution
3. **User session tracking**: Enhanced tracking of user interaction patterns
4. **Anomaly detection**: Identify unusual patterns in test failures or document retrievals
5. **Performance optimization**: Index refinement based on query patterns 