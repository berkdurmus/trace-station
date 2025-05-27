# Dead Letter Queue Implementation

## Overview

This document describes the Dead Letter Queue (DLQ) implementation in the trace-station API service. DLQs are used to handle failed message processing by capturing messages that cannot be processed successfully after multiple attempts.

## Features

- Automatic configuration of DLQ for the main SQS queue
- Configurable maximum retry count (default: 3 attempts)
- API endpoints to monitor and manage failed messages
- Ability to redrive messages from DLQ back to the main queue

## Configuration

The DLQ implementation requires the following environment variables:

```
# AWS Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Queue Configuration
SQS_QUEUE_URL=sqs_que_url
SQS_DLQ_URL=sqs_dlq_url
```

For local development, you can enable mock mode:

```
MOCK_SQS=true
```

## API Endpoints

The following API endpoints are available for DLQ management:

1. **Get Queue Status (including DLQ)**: `GET /api/queue/status`
   - Returns status of both main queue and DLQ
   - Includes message counts and failure statistics

2. **List Failed Messages**: `GET /api/queue/failed`
   - Returns messages that have failed processing and landed in DLQ
   - Optional query parameter `count` to limit results (default: 10)

3. **Redrive a Failed Message**: `POST /api/queue/redrive/:receiptHandle`
   - Moves a specific message from DLQ back to the main queue for reprocessing
   - Requires the message's receipt handle as a path parameter

## Implementation Details

### SQS Service

The `SQSService` class has been enhanced to:

1. Automatically detect and configure DLQ during initialization
2. Set up redrive policies with configurable maximum retry count
3. Provide methods to interact with the DLQ

### Dead Letter Queue Flow

1. When a message fails processing:
   - It remains in the main queue initially
   - SQS automatically retries the message up to the configured maximum attempts
   - After exceeding retry attempts, SQS moves the message to the DLQ

2. Messages in the DLQ:
   - Will not be processed automatically
   - Can be viewed via the API
   - Can be manually redriven back to the main queue if the issue has been fixed

## Best Practices

1. **Monitor DLQ Size**: A growing DLQ indicates underlying issues that need attention
2. **Regularly Check DLQ Contents**: Analyze failed messages to understand common failure patterns
3. **Fix Root Causes Before Redriving**: Ensure the underlying issue is fixed before redriving messages
4. **Consider Message Age**: Messages that have been in the DLQ for a long time may no longer be relevant

## Development and Testing

For local development without actual AWS resources, the mock mode simulates DLQ behavior:

```
MOCK_SQS=true
```

This will log DLQ operations to the console and simulate the behavior without making actual SQS calls. 