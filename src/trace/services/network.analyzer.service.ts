import { NetworkRequest } from "../interfaces/trace.interface";
import { ModalityAnalysis } from "../interfaces/multimodal.interface";
import * as dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

/**
 * NetworkAnalyzerService - Analyzes network requests to identify issues and patterns
 */
export class NetworkAnalyzerService {
  private apiKey: string;
  private verbose: boolean;

  constructor(apiKey?: string, verbose: boolean = false) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.verbose = verbose;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[NetworkAnalyzer] ${message}`);
    }
  }

  /**
   * Analyze network requests to identify potential issues
   */
  async analyzeNetworkRequests(
    requests: NetworkRequest[],
    errorContext?: string
  ): Promise<ModalityAnalysis> {
    this.log(`Analyzing ${requests.length} network requests`);

    try {
      // Find failed requests
      const failedRequests = requests.filter(
        (req) => (req.status !== undefined && req.status >= 400) || req.error
      );

      // Find slow requests (taking more than 1 second)
      const slowRequests = requests.filter((req) => {
        if (req.timing && req.timing.startTime && req.timing.endTime) {
          return req.timing.endTime - req.timing.startTime > 1000;
        }
        return false;
      });

      // Construct a basic modality analysis result
      const analysis: ModalityAnalysis = {
        modalityType: "network",
        confidence: failedRequests.length > 0 ? 0.9 : 0.7,
        result: this.generateAnalysis(
          requests,
          failedRequests,
          slowRequests,
          errorContext
        ),
        relevantDataPoints: requests.map((req) =>
          req.timestamp ? req.timestamp.toString() : "unknown"
        ),
        timestamp: Date.now(),
      };

      return analysis;
    } catch (error) {
      console.error("Error analyzing network requests:", error);

      // Return a low-confidence fallback analysis
      return {
        modalityType: "network",
        confidence: 0.1,
        result: "Could not analyze the network requests due to an error.",
        relevantDataPoints: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Generate analysis based on network requests
   */
  private generateAnalysis(
    allRequests: NetworkRequest[],
    failedRequests: NetworkRequest[],
    slowRequests: NetworkRequest[],
    errorContext?: string
  ): string {
    if (failedRequests.length > 0) {
      const failedUrls = failedRequests
        .map(
          (req) =>
            `${req.method} ${req.url} (${req.status || "unknown"} ${
              req.error || ""
            })`
        )
        .join(", ");

      return `Found ${failedRequests.length} failed network requests which likely caused the test failure: ${failedUrls}. This suggests API endpoints are returning errors or resources are unavailable.`;
    }

    if (slowRequests.length > 0) {
      return `Found ${slowRequests.length} slow network requests that may have contributed to timing issues in the test. Some resources took more than 1 second to load, potentially triggering timeout conditions.`;
    }

    if (allRequests.length === 0) {
      return "No network requests were recorded during this test execution. This might indicate that the test failed before any network requests were made, or there may be issues with the network recording.";
    }

    if (errorContext && errorContext.includes("timeout")) {
      return "While no failed requests were detected, the network activity pattern shows potential race conditions where test actions proceeded before responses were completely processed.";
    }

    return "Network analysis shows normal request patterns without obvious errors. The test failure is likely not related to network issues.";
  }

  /**
   * Find critical requests that may have caused test failures
   */
  async findCriticalRequests(
    requests: NetworkRequest[]
  ): Promise<NetworkRequest[]> {
    this.log(
      `Finding critical requests among ${requests.length} network requests`
    );

    // Find failed requests
    const failedRequests = requests.filter(
      (req) => (req.status !== undefined && req.status >= 400) || req.error
    );

    // If there are failed requests, they are the critical ones
    if (failedRequests.length > 0) {
      return failedRequests;
    }

    // Otherwise, look for slow requests
    const slowRequests = requests.filter((req) => {
      if (req.timing && req.timing.startTime && req.timing.endTime) {
        return req.timing.endTime - req.timing.startTime > 1000;
      }
      return false;
    });

    if (slowRequests.length > 0) {
      return slowRequests;
    }

    // If no obvious issues, return the last few requests as they might be relevant
    return requests.slice(-3);
  }

  /**
   * Detect API patterns in the network requests
   */
  async detectAPIPatterns(requests: NetworkRequest[]): Promise<{
    patterns: string[];
    apiEndpoints: string[];
    commonParams: Record<string, string[]>;
  }> {
    this.log(`Detecting API patterns in ${requests.length} network requests`);

    // Group requests by base URL
    const urlGroups: Record<string, NetworkRequest[]> = {};

    for (const req of requests) {
      try {
        const url = new URL(req.url);
        const baseUrl = `${url.protocol}//${url.hostname}${url.pathname
          .split("/")
          .slice(0, 2)
          .join("/")}`;

        if (!urlGroups[baseUrl]) {
          urlGroups[baseUrl] = [];
        }

        urlGroups[baseUrl].push(req);
      } catch (error) {
        // Skip invalid URLs
      }
    }

    // Extract patterns and endpoints
    const patterns: string[] = [];
    const apiEndpoints: string[] = [];
    const commonParams: Record<string, string[]> = {};

    for (const baseUrl of Object.keys(urlGroups)) {
      if (urlGroups[baseUrl].length > 1) {
        patterns.push(
          `Repeated requests to ${baseUrl} (${urlGroups[baseUrl].length} times)`
        );
      }

      apiEndpoints.push(baseUrl);
    }

    return { patterns, apiEndpoints, commonParams };
  }
}

export default NetworkAnalyzerService;
