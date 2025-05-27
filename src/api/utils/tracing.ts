import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { ATTR_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions/incubating";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-base";
import {
  trace,
  Span,
  SpanStatusCode,
  context,
  Context,
} from "@opentelemetry/api";
import { config } from "dotenv";

// Load environment variables
config();

// Service name
const SERVICE_NAME = "trace-station-api";

// Determine if we should use mock mode
const MOCK_TRACING = process.env.MOCK_TRACING === "true";
const TRACING_ENDPOINT =
  process.env.TRACING_ENDPOINT || "http://localhost:4318/v1/traces";

// Tracer instance
let tracer: NodeSDK;

/**
 * Initialize OpenTelemetry
 */
export function initTracing(): NodeSDK | null {
  if (tracer) {
    return tracer;
  }

  try {
    console.log("Initializing OpenTelemetry tracing...");

    // Create exporter based on configuration
    const traceExporter = MOCK_TRACING
      ? new ConsoleSpanExporter()
      : new OTLPTraceExporter({
          url: TRACING_ENDPOINT,
        });

    // Create resource attributes
    const resourceAttributes = {
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
      [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
    };

    // Create SDK configuration
    tracer = new NodeSDK({
      resource: resourceFromAttributes(resourceAttributes),
      spanProcessor: new BatchSpanProcessor(traceExporter),
      // Auto-instrument Node.js libraries
      instrumentations: [
        getNodeAutoInstrumentations({
          // Enable specific instrumentations
          "@opentelemetry/instrumentation-fs": { enabled: true },
          "@opentelemetry/instrumentation-express": { enabled: true },
          "@opentelemetry/instrumentation-http": { enabled: true },
          "@opentelemetry/instrumentation-aws-sdk": { enabled: true },
        }),
      ],
    });

    // Start the tracer
    tracer.start();
    console.log("OpenTelemetry tracing initialized successfully");

    return tracer;
  } catch (error) {
    console.error("Failed to initialize OpenTelemetry:", error);
    return null;
  }
}

/**
 * Shutdown OpenTelemetry
 */
export async function shutdownTracing(): Promise<void> {
  if (tracer) {
    console.log("Shutting down OpenTelemetry tracing...");
    await tracer.shutdown();
    console.log("OpenTelemetry tracing shut down");
  }
}

/**
 * Create a traced function
 * @param name Name of the span
 * @param fn Function to trace
 * @param parentContext Optional parent context
 * @returns Result of the function
 */
export async function traced<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  parentContext?: Context
): Promise<T> {
  const tracer = trace.getTracer(SERVICE_NAME);

  return tracer.startActiveSpan(
    name,
    {
      links: parentContext
        ? [{ context: trace.getSpanContext(parentContext)! }]
        : undefined,
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          span.recordException(error);
        }

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Trace an SQS operation
 * @param operation Name of the operation
 * @param queueName Name of the queue
 * @param fn Function to trace
 * @returns Result of the function
 */
export async function traceSQSOperation<T>(
  operation: string,
  queueName: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return traced(`SQS.${operation}`, async (span) => {
    span.setAttribute("messaging.system", "aws.sqs");
    span.setAttribute("messaging.destination", queueName);
    span.setAttribute("messaging.operation", operation);
    return await fn(span);
  });
}

/**
 * Get current trace context
 * @returns Current trace context
 */
export function getCurrentContext(): Context {
  return context.active();
}
