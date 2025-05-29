import { PlaywrightDocs } from "./trace/classes/playwright.docs.class";
import AnalyticsService from "./trace/services/analytics.service";
import dotenv from "dotenv";
import {
  ParsedTrace,
  ConsoleMessage,
} from "./trace/interfaces/trace.interface";

// Load environment variables
dotenv.config();

/**
 * Test script for ClickHouse analytics integration
 */
async function testAnalytics() {
  console.log("Testing ClickHouse Analytics integration...");

  // Create an instance of the AnalyticsService with verbose logging
  const analytics = new AnalyticsService(true);

  // Initialize analytics tables
  console.log("Initializing ClickHouse tables...");
  await analytics.initialize();

  // Create a new PlaywrightDocs instance with verbose logging
  console.log("Creating PlaywrightDocs instance...");
  const playwrightDocs = new PlaywrightDocs(undefined, true);

  // Initialize PlaywrightDocs
  console.log("Initializing PlaywrightDocs...");
  await playwrightDocs.initialize();

  // Create a mock trace for testing
  const mockTrace: ParsedTrace = {
    testTitle: "Test Example",
    testFile: "example.spec.ts",
    browser: {
      name: "chromium",
      version: "latest",
      platform: "darwin",
    },
    actions: [
      {
        type: "click",
        selector: "button[name='Submit']",
        timestamp: Date.now() - 5000,
      },
      {
        type: "fill",
        selector: "input[name='username']",
        value: "testuser",
        timestamp: Date.now() - 3000,
      },
    ],
    networkRequests: [
      {
        url: "https://example.com/api/data",
        method: "GET",
        status: 200,
        timestamp: Date.now() - 2000,
      },
      {
        url: "https://example.com/api/login",
        method: "POST",
        status: 401,
        error: "Unauthorized",
        timestamp: Date.now() - 1000,
      },
    ],
    consoleMessages: [
      {
        type: "error",
        text: "Failed to authenticate user",
        timestamp: Date.now() - 500,
      } as ConsoleMessage,
    ],
    screenshots: [],
    errors: [
      {
        message: "Error: Failed to authenticate",
        timestamp: Date.now() - 300,
      },
    ],
    duration: {
      start: Date.now() - 10000,
      end: Date.now(),
      total: 10000,
    },
    testResult: {
      status: "failed",
      error: {
        message: "Authentication error: Invalid credentials",
      },
    },
  };

  // Test retrieving docs with the mock trace
  console.log("Retrieving relevant docs with analytics tracking...");
  const relevantDocs = await playwrightDocs.retrieveRelevantDocs(mockTrace, {
    failureReason: "Authentication failure",
    failurePoint: "Login form submission",
  });

  console.log(`Found ${relevantDocs.length} relevant docs.`);

  // Test direct analytics API
  console.log("Testing direct analytics API...");

  // Track a test query
  await analytics.trackQuery({
    query: "Direct test query",
    numResults: 3,
    latencyMs: 150,
    userId: "test-user",
    sessionId: "test-session",
    traceId: "direct-test",
  });

  // Track a test document retrieval
  await analytics.trackDocRetrieval({
    docId: "test-doc-1",
    docTitle: "Test Document",
    query: "Direct test query",
    relevanceScore: 0.95,
    userId: "test-user",
    sessionId: "test-session",
    traceId: "direct-test",
  });

  // Track a test trace
  await analytics.trackTrace({
    traceId: "direct-test-trace",
    testFile: "direct-test.spec.ts",
    testTitle: "Direct Test",
    durationMs: 5000,
    status: "failed",
    errorMessage: "Direct test error",
    actionCount: 10,
    errorCount: 2,
  });

  // Test analytics queries
  console.log("Retrieving analytics data...");

  // Get top queries
  const topQueries = await analytics.getTopQueries(5);
  console.log("Top queries:", topQueries);

  // Get query latency over time
  const latencyData = await analytics.getQueryLatencyOverTime("1 hour");
  console.log("Query latency:", latencyData);

  // Get most retrieved docs
  const topDocs = await analytics.getMostRetrievedDocs(5);
  console.log("Most retrieved docs:", topDocs);

  // Get test failure stats
  const failureStats = await analytics.getTestFailureStats("1 hour");
  console.log("Test failure stats:", failureStats);

  console.log("ClickHouse Analytics test completed!");
}

// Run the test
testAnalytics()
  .then(() => console.log("Test completed successfully!"))
  .catch((error) => console.error("Test failed:", error));
