// Trace interfaces
export interface TraceSubmission {
  traceData: any; // The actual trace data
  metadata?: {
    submittedBy?: string;
    project?: string;
    environment?: string;
    tags?: string[];
  };
}

export interface TraceResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  results?: any;
  error?: string;
  submittedAt: string;
  completedAt?: string;
  metadata?: {
    submittedBy?: string;
    project?: string;
    environment?: string;
    tags?: string[];
  };
}

// Queue interfaces
export interface QueueStatus {
  queueName: string;
  messageCount: number;
  inFlightCount: number;
  lastProcessedAt?: string;
}

export interface QueueMetrics {
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  queues: QueueStatus[];
}

// System interfaces
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  components: {
    api: "up" | "down";
    queue: "up" | "down";
    database: "up" | "down";
  };
  uptime: number;
  version: string;
}

export interface SystemMetrics {
  requestsTotal: number;
  requestsPerMinute: number;
  responseTimeAverage: number;
  errorRate: number;
  queueLatency: number;
}
