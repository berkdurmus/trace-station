# OpenTelemetry Tracing Implementation

## Overview

This document describes the OpenTelemetry tracing implementation in the trace-station API service. OpenTelemetry provides distributed tracing, which helps monitor and debug the application by tracking requests as they flow through different components.

## Features

- Automatic instrumentation of Node.js libraries (HTTP, Express, AWS SDK)
- Custom spans for business logic and critical operations
- Configurable trace exporter (OTLP HTTP)
- Mock mode for local development
- Graceful shutdown handling

## Configuration

The OpenTelemetry implementation requires the following environment variables:

```
# Tracing Configuration
TRACING_ENDPOINT=http://localhost:4318/v1/traces
```

For local development without a trace collector, you can enable mock mode:

```
MOCK_TRACING=true
```

## Implementation Details

### Core Components

1. **Tracing Setup** (`src/api/utils/tracing.ts`):
   - Initializes OpenTelemetry with appropriate configuration
   - Sets up auto-instrumentation for common libraries
   - Provides utility functions for custom tracing

2. **Custom Tracing Functions**:
   - `traced()`: General-purpose function to create traced operations
   - `traceSQSOperation()`: Specialized function for SQS operations with messaging attributes

3. **Server Integration** (`src/api/server.ts`):
   - Initializes tracing during server startup
   - Ensures clean shutdown of tracing when the server stops

### Tracing Key Operations

The following key operations are traced:

1. **API Requests**: Auto-instrumented through Express integration
2. **SQS Operations**:
   - Message sending
   - Message receiving
   - Message deletion
3. **Trace Processing**:
   - Message handling
   - Trace analysis

### Trace Attributes

Custom attributes are added to spans to provide context:

- **SQS Operations**:
  - `messaging.system`: Set to "aws.sqs"
  - `messaging.destination`: Queue name
  - `messaging.operation`: Operation name
  - `messaging.message_id`: Message ID
  - `messaging.message_payload_size_bytes`: Size of message

- **Trace Processing**:
  - `traceProcessor.traceId`: ID of the trace being processed
  - `traceProcessor.status`: Processing status
  - `traceProcessor.error`: Error details if processing failed

## Visualization and Analysis

The traces can be visualized and analyzed using:

1. **Jaeger**: An open-source distributed tracing system
2. **Grafana**: For visualization and dashboards
3. **OpenTelemetry Collector**: To receive, process, and export telemetry data

## Development and Testing

For local development, you can:

1. Run with mock mode:
   ```
   MOCK_TRACING=true
   ```

2. Run with a local collector:
   ```
   TRACING_ENDPOINT=http://localhost:4318/v1/traces
   ```

3. Use Docker Compose to run a local Jaeger instance:
   ```yaml
   services:
     jaeger:
       image: jaegertracing/all-in-one:latest
       ports:
         - "16686:16686"  # UI
         - "4317:4317"    # OTLP gRPC
         - "4318:4318"    # OTLP HTTP
   ```

## Best Practices

1. **Add Context to Spans**: Use attributes to provide meaningful context
2. **Create Spans at Appropriate Granularity**: Neither too coarse nor too fine
3. **Handle Errors Properly**: Set appropriate status codes and record exceptions
4. **Respect Parent-Child Relationships**: Maintain proper span hierarchy
5. **Ensure Clean Shutdown**: Properly flush and close trace providers

## Performance Considerations

Tracing adds some overhead, which can be minimized by:

1. Using sampling in production (not implemented yet)
2. Batching span exports
3. Being selective about which attributes to add 