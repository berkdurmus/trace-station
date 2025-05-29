import { createClient } from "@clickhouse/client";
import * as dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

/**
 * AnalyticsService for tracking and analyzing RAG and trace interactions
 * using ClickHouse as the analytics database
 */
export class AnalyticsService {
  private client;
  private isInitialized = false;
  private verbose: boolean = false;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;

    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
      username: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD || "",
      database: process.env.CLICKHOUSE_DB || "default",
    });

    this.log("ClickHouse analytics service created");
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[AnalyticsService] ${message}`);
    }
  }

  /**
   * Initialize the ClickHouse tables needed for analytics
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.log("Initializing ClickHouse analytics tables...");

      // Create query analytics table
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS query_analytics (
            timestamp DateTime DEFAULT now(),
            query String,
            num_results UInt8,
            latency_ms UInt32,
            user_id String DEFAULT '',
            session_id String DEFAULT '',
            trace_id String DEFAULT ''
          ) ENGINE = MergeTree()
          ORDER BY (timestamp, query)
        `,
      });

      // Create document retrieval analytics table
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS doc_retrievals (
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
        `,
      });

      // Create trace analytics table
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS trace_analytics (
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
        `,
      });

      this.isInitialized = true;
      this.log("ClickHouse analytics tables initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ClickHouse analytics tables:", error);
    }
  }

  /**
   * Track a query to the vector store
   */
  async trackQuery(data: {
    query: string;
    numResults: number;
    latencyMs: number;
    userId?: string;
    sessionId?: string;
    traceId?: string;
  }): Promise<void> {
    try {
      await this.initialize();

      this.log(`Tracking query: ${data.query.substring(0, 50)}...`);

      await this.client.insert({
        table: "query_analytics",
        values: [
          {
            query: data.query,
            num_results: data.numResults,
            latency_ms: data.latencyMs,
            user_id: data.userId || "",
            session_id: data.sessionId || "",
            trace_id: data.traceId || "",
          },
        ],
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Error tracking query:", error);
      // Don't let analytics failures impact the main functionality
    }
  }

  /**
   * Track document retrieval from the vector store
   */
  async trackDocRetrieval(data: {
    docId: string;
    docTitle: string;
    query: string;
    relevanceScore: number;
    userId?: string;
    sessionId?: string;
    traceId?: string;
  }): Promise<void> {
    try {
      await this.initialize();

      this.log(`Tracking doc retrieval: ${data.docTitle}`);

      await this.client.insert({
        table: "doc_retrievals",
        values: [
          {
            doc_id: data.docId,
            doc_title: data.docTitle,
            query: data.query,
            relevance_score: data.relevanceScore,
            user_id: data.userId || "",
            session_id: data.sessionId || "",
            trace_id: data.traceId || "",
          },
        ],
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Error tracking document retrieval:", error);
      // Don't let analytics failures impact the main functionality
    }
  }

  /**
   * Track a trace analysis
   */
  async trackTrace(data: {
    traceId: string;
    testFile: string;
    testTitle: string;
    durationMs: number;
    status: string;
    errorMessage?: string;
    actionCount: number;
    errorCount: number;
  }): Promise<void> {
    try {
      await this.initialize();

      this.log(`Tracking trace analysis: ${data.traceId}`);

      await this.client.insert({
        table: "trace_analytics",
        values: [
          {
            trace_id: data.traceId,
            test_file: data.testFile,
            test_title: data.testTitle,
            duration_ms: data.durationMs,
            status: data.status,
            error_message: data.errorMessage || "",
            action_count: data.actionCount,
            error_count: data.errorCount,
          },
        ],
        format: "JSONEachRow",
      });
    } catch (error) {
      console.error("Error tracking trace:", error);
      // Don't let analytics failures impact the main functionality
    }
  }

  /**
   * Get top queries by frequency
   */
  async getTopQueries(limit = 10): Promise<any> {
    try {
      await this.initialize();

      const result = await this.client.query({
        query: `
          SELECT 
            query, 
            count() as count,
            avg(num_results) as avg_results,
            avg(latency_ms) as avg_latency
          FROM query_analytics
          GROUP BY query
          ORDER BY count DESC
          LIMIT ${limit}
        `,
        format: "JSONEachRow",
      });

      return result.json();
    } catch (error) {
      console.error("Error getting top queries:", error);
      return [];
    }
  }

  /**
   * Get query latency over time
   */
  async getQueryLatencyOverTime(period = "1 day"): Promise<any> {
    try {
      await this.initialize();

      const result = await this.client.query({
        query: `
          SELECT 
            toStartOfHour(timestamp) as hour,
            avg(latency_ms) as avg_latency
          FROM query_analytics
          WHERE timestamp >= now() - INTERVAL ${period}
          GROUP BY hour
          ORDER BY hour
        `,
        format: "JSONEachRow",
      });

      return result.json();
    } catch (error) {
      console.error("Error getting query latency over time:", error);
      return [];
    }
  }

  /**
   * Get most retrieved documents
   */
  async getMostRetrievedDocs(limit = 10): Promise<any> {
    try {
      await this.initialize();

      const result = await this.client.query({
        query: `
          SELECT 
            doc_title,
            count() as retrieval_count,
            avg(relevance_score) as avg_relevance
          FROM doc_retrievals
          GROUP BY doc_title
          ORDER BY retrieval_count DESC
          LIMIT ${limit}
        `,
        format: "JSONEachRow",
      });

      return result.json();
    } catch (error) {
      console.error("Error getting most retrieved docs:", error);
      return [];
    }
  }

  /**
   * Get test failure statistics
   */
  async getTestFailureStats(period = "7 days"): Promise<any> {
    try {
      await this.initialize();

      const result = await this.client.query({
        query: `
          SELECT 
            test_file,
            countIf(status = 'failed') as failure_count,
            count() as total_runs,
            round(countIf(status = 'failed') / count() * 100, 2) as failure_rate
          FROM trace_analytics
          WHERE timestamp >= now() - INTERVAL ${period}
          GROUP BY test_file
          ORDER BY failure_rate DESC
        `,
        format: "JSONEachRow",
      });

      return result.json();
    } catch (error) {
      console.error("Error getting test failure stats:", error);
      return [];
    }
  }
}

export default AnalyticsService;
