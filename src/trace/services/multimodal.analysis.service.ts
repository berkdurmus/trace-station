import { ClickHouseClient } from "@clickhouse/client";
import { createClient } from "@clickhouse/client";
import * as dotenv from "dotenv";
import {
  MultiModalAnalysisConfig,
  MultiModalAnalysisResult,
  ModalityAnalysis,
  SynchronizedDataPoint,
  ModalityEmbedding,
} from "../interfaces/multimodal.interface";
import { ParsedTrace, DOMSnapshotData } from "../interfaces/trace.interface";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { PlaywrightDocs } from "../classes/playwright.docs.class";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// Ensure environment variables are loaded
dotenv.config();

/**
 * MultiModalAnalysisService - Provides advanced analysis of test traces by combining
 * multiple data modalities (visual, DOM, network, console, actions)
 */
export class MultiModalAnalysisService {
  private client: ClickHouseClient;
  private isInitialized = false;
  private verbose: boolean = false;
  private config: MultiModalAnalysisConfig;
  private openAIEmbeddings?: OpenAIEmbeddings;
  private playwrightDocs?: PlaywrightDocs;

  constructor(
    config?: Partial<MultiModalAnalysisConfig>,
    verbose: boolean = false
  ) {
    this.verbose = verbose;

    // Default configuration
    this.config = {
      enabledModalities: {
        visual: true,
        dom: true,
        network: true,
        console: true,
        action: true,
      },
      modalityWeights: {
        visual: 0.3,
        dom: 0.2,
        network: 0.2,
        console: 0.1,
        action: 0.2,
      },
      embeddingModel: "text-embedding-ada-002",
      visionModel: "gpt-4-vision-preview",
      textModel: "gpt-4-turbo",
      minConfidenceThreshold: 0.6,
      ...config,
    };

    // Initialize ClickHouse client
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
      username: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD || "",
      database: process.env.CLICKHOUSE_DB || "default",
    });

    // Initialize OpenAI embeddings if API key is available
    if (process.env.OPENAI_API_KEY || this.config.openAIApiKey) {
      this.openAIEmbeddings = new OpenAIEmbeddings({
        openAIApiKey: this.config.openAIApiKey || process.env.OPENAI_API_KEY,
      });
    }

    this.log("MultiModal Analysis Service created");
  }

  /**
   * Log messages when verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[MultiModalAnalysis] ${message}`);
    }
  }

  /**
   * Initialize the necessary tables in ClickHouse
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.log("Initializing MultiModal Analysis tables...");

      // Create table for storing synchronized data points
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS multimodal_data_points (
            id String,
            trace_id String,
            timestamp DateTime64(3),
            modality_type Enum('visual' = 1, 'dom' = 2, 'network' = 3, 'console' = 4, 'action' = 5),
            data String, -- JSON string of the data
            metadata String -- JSON string of metadata
          ) ENGINE = MergeTree()
          ORDER BY (trace_id, timestamp, modality_type)
        `,
      });

      // Create table for storing embeddings
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS multimodal_embeddings (
            id String,
            data_point_id String,
            trace_id String,
            timestamp DateTime64(3),
            modality_type Enum('visual' = 1, 'dom' = 2, 'network' = 3, 'console' = 4, 'action' = 5),
            embedding Array(Float32),
            embedding_model String
          ) ENGINE = MergeTree()
          ORDER BY (trace_id, modality_type, timestamp)
        `,
      });

      // Create table for storing analysis results
      await this.client.exec({
        query: `
          CREATE TABLE IF NOT EXISTS multimodal_analysis_results (
            id String,
            trace_id String,
            timestamp DateTime64(3),
            root_cause String,
            explanation String,
            suggested_fix String,
            confidence_score Float32,
            modality_analyses String, -- JSON array of modality analyses
            related_documentation String, -- JSON array of related docs
            visualization_data String -- JSON string of visualization data
          ) ENGINE = MergeTree()
          ORDER BY (trace_id, timestamp)
        `,
      });

      this.isInitialized = true;
      this.log("MultiModal Analysis tables initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MultiModal Analysis tables:", error);
    }
  }

  /**
   * Analyze a trace using multi-modal techniques
   */
  async analyzeTrace(
    trace: ParsedTrace
  ): Promise<MultiModalAnalysisResult | null> {
    await this.initialize();

    this.log(`Starting multi-modal analysis for trace: ${trace.testFile}`);

    // Generate a traceId if not present
    const traceId =
      trace.id || `${trace.testFile}-${trace.testTitle}-${Date.now()}`;

    try {
      // 1. Synchronize the data points
      const synchronizedDataPoints = await this.synchronizeDataPoints(trace);
      this.log(`Synchronized ${synchronizedDataPoints.length} data points`);

      // 2. Initialize analysis result
      const analysisResult: MultiModalAnalysisResult = {
        traceId,
        timestamp: Date.now(),
        explanation: "",
        confidenceScore: 0,
        modalityAnalyses: [],
      };

      // 3. Load analyzers
      const visualAnalyzer = new (
        await import("./visual.analyzer.service")
      ).default(this.config.openAIApiKey, this.verbose);

      const domAnalyzer = new (await import("./dom.analyzer.service")).default(
        this.config.openAIApiKey,
        this.verbose
      );

      const networkAnalyzer = new (
        await import("./network.analyzer.service")
      ).default(this.config.openAIApiKey, this.verbose);

      // 4. Analyze each modality
      const modalityAnalyses: ModalityAnalysis[] = [];

      // Find error context from test result
      const errorContext = trace.testResult.error?.message || "";

      // 4.1 Visual analysis (if enabled and screenshots available)
      if (
        this.config.enabledModalities.visual &&
        trace.screenshots.length > 0
      ) {
        // Find the screenshot closest to the error (last screenshot by default)
        const screenshot = trace.screenshots[trace.screenshots.length - 1];

        const visualAnalysis = await visualAnalyzer.analyzeScreenshot(
          screenshot,
          errorContext
        );

        modalityAnalyses.push(visualAnalysis);
      }

      // 4.2 DOM analysis (if enabled and DOM snapshots available)
      if (
        this.config.enabledModalities.dom &&
        trace.domSnapshots &&
        trace.domSnapshots.length > 0
      ) {
        // Find the DOM snapshot closest to the error
        const domSnapshot = trace.domSnapshots[trace.domSnapshots.length - 1];

        // Extract selector from the last action if available
        const lastAction =
          trace.actions.length > 0
            ? trace.actions[trace.actions.length - 1]
            : null;
        const selector = lastAction?.selector;

        const domAnalysis = await domAnalyzer.analyzeDOMSnapshot(
          domSnapshot,
          selector,
          errorContext
        );

        modalityAnalyses.push(domAnalysis);
      }

      // 4.3 Network analysis (if enabled and network requests available)
      if (
        this.config.enabledModalities.network &&
        trace.networkRequests.length > 0
      ) {
        const networkAnalysis = await networkAnalyzer.analyzeNetworkRequests(
          trace.networkRequests,
          errorContext
        );

        modalityAnalyses.push(networkAnalysis);
      }

      // 5. Store the modality analyses
      analysisResult.modalityAnalyses = modalityAnalyses;

      // 6. Combine the analyses to determine root cause
      const { rootCause, explanation, confidenceScore, failurePoint } =
        await this.combineAnalyses(
          modalityAnalyses,
          synchronizedDataPoints,
          trace
        );

      analysisResult.rootCause = rootCause;
      analysisResult.explanation = explanation;
      analysisResult.confidenceScore = confidenceScore;
      analysisResult.failurePoint = failurePoint;

      // 7. Generate suggested fix
      analysisResult.suggestedFix = await this.generateSuggestedFix(
        rootCause,
        explanation,
        trace
      );

      // 8. Store the analysis result in ClickHouse
      await this.storeAnalysisResult(analysisResult);

      // 9. Update trace with analysis summary
      if (trace.multiModalAnalysis) {
        trace.multiModalAnalysis.isAnalyzed = true;
        trace.multiModalAnalysis.rootCause = rootCause;
        trace.multiModalAnalysis.explanation = explanation;
      } else {
        trace.multiModalAnalysis = {
          isAnalyzed: true,
          rootCause,
          explanation,
        };
      }

      return analysisResult;
    } catch (error) {
      console.error(`Error analyzing trace: ${error}`);
      return null;
    }
  }

  /**
   * Combine analyses from different modalities to determine the root cause
   */
  private async combineAnalyses(
    modalityAnalyses: ModalityAnalysis[],
    synchronizedDataPoints: SynchronizedDataPoint[],
    trace: ParsedTrace
  ): Promise<{
    rootCause: string;
    explanation: string;
    confidenceScore: number;
    failurePoint?: SynchronizedDataPoint;
  }> {
    this.log(`Combining ${modalityAnalyses.length} modality analyses`);

    if (modalityAnalyses.length === 0) {
      return {
        rootCause: "Unknown - insufficient data for analysis",
        explanation:
          "There was not enough data available to perform a comprehensive analysis.",
        confidenceScore: 0.1,
      };
    }

    // Sort analyses by confidence
    const sortedAnalyses = [...modalityAnalyses].sort(
      (a, b) => b.confidence - a.confidence
    );

    // Get the highest confidence analysis
    const highestConfidenceAnalysis = sortedAnalyses[0];

    // If we only have one modality or the highest confidence is very high, use it directly
    if (
      sortedAnalyses.length === 1 ||
      highestConfidenceAnalysis.confidence > 0.9
    ) {
      // Find the timestamp of the analysis
      const timestamp = parseInt(
        highestConfidenceAnalysis.relevantDataPoints[0] || "0"
      );

      // Find the synchronized data point closest to this timestamp
      const failurePoint = this.findClosestSynchronizedPoint(
        synchronizedDataPoints,
        timestamp
      );

      return {
        rootCause: `${highestConfidenceAnalysis.modalityType.toUpperCase()} ISSUE: ${
          highestConfidenceAnalysis.result.split(".")[0]
        }`,
        explanation: highestConfidenceAnalysis.result,
        confidenceScore: highestConfidenceAnalysis.confidence,
        failurePoint,
      };
    }

    // Otherwise, combine the top analyses
    // In a real implementation, this would use an LLM to integrate the analyses
    // For now, we'll use a simple weighted combination
    let rootCause = "";
    let explanation = "Multi-modal analysis indicates:\n\n";
    let totalWeight = 0;
    let weightedConfidence = 0;

    // Find the most common timestamp among analyses
    const timestampCounts: Record<string, number> = {};
    for (const analysis of sortedAnalyses) {
      for (const dataPoint of analysis.relevantDataPoints) {
        timestampCounts[dataPoint] = (timestampCounts[dataPoint] || 0) + 1;
      }
    }

    // Get the most common timestamp
    let mostCommonTimestamp = 0;
    let highestCount = 0;
    for (const [timestamp, count] of Object.entries(timestampCounts)) {
      if (count > highestCount) {
        highestCount = count;
        mostCommonTimestamp = parseInt(timestamp);
      }
    }

    // Find the synchronized data point for the most common timestamp
    const failurePoint = this.findClosestSynchronizedPoint(
      synchronizedDataPoints,
      mostCommonTimestamp
    );

    // Combine the analyses
    for (const analysis of sortedAnalyses.slice(0, 3)) {
      // Consider top 3 analyses
      const modalityWeight =
        this.config.modalityWeights[analysis.modalityType] || 0.2;
      const weight = modalityWeight * analysis.confidence;

      if (rootCause === "") {
        // Use the highest confidence analysis for the root cause
        rootCause = `${analysis.modalityType.toUpperCase()} ISSUE: ${
          analysis.result.split(".")[0]
        }`;
      }

      explanation += `- ${analysis.modalityType.toUpperCase()} ANALYSIS (${Math.round(
        analysis.confidence * 100
      )}% confidence): ${analysis.result}\n\n`;

      totalWeight += weight;
      weightedConfidence += weight * analysis.confidence;
    }

    // Normalize the confidence score
    const confidenceScore =
      totalWeight > 0 ? weightedConfidence / totalWeight : 0.5;

    return {
      rootCause,
      explanation,
      confidenceScore,
      failurePoint,
    };
  }

  /**
   * Find the synchronized data point closest to a given timestamp
   */
  private findClosestSynchronizedPoint(
    points: SynchronizedDataPoint[],
    timestamp: number
  ): SynchronizedDataPoint | undefined {
    if (!points.length) return undefined;

    return points.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - timestamp) <
        Math.abs(prev.timestamp - timestamp)
        ? curr
        : prev;
    });
  }

  /**
   * Generate a suggested fix based on the analysis
   */
  private async generateSuggestedFix(
    rootCause: string,
    explanation: string,
    trace: ParsedTrace
  ): Promise<string> {
    // In a real implementation, this would use an LLM to generate a fix
    // For now, we'll provide a placeholder implementation

    if (rootCause.includes("SELECTOR") || rootCause.includes("DOM")) {
      return "Update the selector in your test to match the current page structure. Consider using more resilient selectors that are less likely to change.";
    } else if (rootCause.includes("NETWORK")) {
      return "Add proper waiting for network requests to complete before proceeding with test actions. Consider using waitForResponse() or similar methods.";
    } else if (rootCause.includes("TIMEOUT")) {
      return "Increase the timeout value for this test or add explicit waiting for the specific elements that are slow to appear.";
    } else if (rootCause.includes("VISUAL")) {
      return "The UI has changed from what the test expects. Update your test to match the new UI structure or appearance.";
    } else {
      return "Review the test logic and ensure it matches the current application behavior. The application may have changed since the test was written.";
    }
  }

  /**
   * Store the analysis result in ClickHouse
   */
  private async storeAnalysisResult(
    result: MultiModalAnalysisResult
  ): Promise<void> {
    try {
      this.log(`Storing analysis result for trace: ${result.traceId}`);

      await this.client.insert({
        table: "multimodal_analysis_results",
        values: [
          {
            id: uuidv4(),
            trace_id: result.traceId,
            timestamp: new Date(result.timestamp),
            root_cause: result.rootCause || "",
            explanation: result.explanation,
            suggested_fix: result.suggestedFix || "",
            confidence_score: result.confidenceScore,
            modality_analyses: JSON.stringify(result.modalityAnalyses),
            related_documentation: JSON.stringify(
              result.relatedDocumentation || []
            ),
            visualization_data: JSON.stringify(result.visualizationData || {}),
          },
        ],
        format: "JSONEachRow",
      });

      this.log("Analysis result stored successfully");
    } catch (error) {
      console.error("Error storing analysis result:", error);
    }
  }

  /**
   * Synchronize data points from different modalities based on timestamps
   */
  private async synchronizeDataPoints(
    trace: ParsedTrace
  ): Promise<SynchronizedDataPoint[]> {
    // Collect all timestamps from different modalities
    const timestamps = new Set<number>();

    // Add timestamps from screenshots
    trace.screenshots.forEach((screenshot) =>
      timestamps.add(screenshot.timestamp)
    );

    // Add timestamps from actions
    trace.actions.forEach((action) => timestamps.add(action.timestamp));

    // Add timestamps from network requests
    trace.networkRequests.forEach((request) => {
      if (request.timestamp) timestamps.add(request.timestamp);
      if (request.responseTimestamp) timestamps.add(request.responseTimestamp);
    });

    // Add timestamps from console messages
    trace.consoleMessages.forEach((msg) => timestamps.add(msg.timestamp));

    // Add timestamps from errors
    trace.errors.forEach((error) => timestamps.add(error.timestamp));

    // Add timestamps from DOM snapshots if available
    if (trace.domSnapshots) {
      trace.domSnapshots.forEach((snapshot) =>
        timestamps.add(snapshot.timestamp)
      );
    }

    // Sort timestamps
    const sortedTimestamps = Array.from(timestamps).sort();

    // Create synchronized data points
    const synchronizedPoints: SynchronizedDataPoint[] = sortedTimestamps.map(
      (timestamp) => {
        const point: SynchronizedDataPoint = { timestamp };

        // Find the screenshot closest to this timestamp
        const screenshot = this.findClosestByTimestamp(
          trace.screenshots,
          timestamp
        );
        if (screenshot) point.screenshot = screenshot;

        // Find the DOM snapshot closest to this timestamp
        if (trace.domSnapshots) {
          const domSnapshot = this.findClosestByTimestamp(
            trace.domSnapshots,
            timestamp
          );
          if (domSnapshot) {
            point.domSnapshot = {
              timestamp: domSnapshot.timestamp,
              html: domSnapshot.html,
              cssSelector: domSnapshot.cssSelector,
              xpath: domSnapshot.xpath,
              title: domSnapshot.title,
              url: domSnapshot.url,
            };
          }
        }

        // Find actions at this timestamp
        point.actions = trace.actions.filter(
          (action) => Math.abs(action.timestamp - timestamp) < 100 // Within 100ms
        );

        // Find network requests at this timestamp
        point.networkRequests = trace.networkRequests.filter(
          (req) =>
            (req.timestamp && Math.abs(req.timestamp - timestamp) < 100) ||
            (req.responseTimestamp &&
              Math.abs(req.responseTimestamp - timestamp) < 100)
        );

        // Find console messages at this timestamp
        point.consoleMessages = trace.consoleMessages.filter(
          (msg) => Math.abs(msg.timestamp - timestamp) < 100
        );

        // Find errors at this timestamp
        point.errors = trace.errors.filter(
          (err) => Math.abs(err.timestamp - timestamp) < 100
        );

        return point;
      }
    );

    return synchronizedPoints;
  }

  /**
   * Find the closest item to a given timestamp
   */
  private findClosestByTimestamp<T extends { timestamp: number }>(
    items: T[],
    targetTimestamp: number
  ): T | undefined {
    if (!items.length) return undefined;

    return items.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - targetTimestamp) <
        Math.abs(prev.timestamp - targetTimestamp)
        ? curr
        : prev;
    });
  }
}

export default MultiModalAnalysisService;
