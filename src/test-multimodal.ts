import MultiModalAnalysisService from "./trace/services/multimodal.analysis.service";
import dotenv from "dotenv";
import { ParsedTrace, DOMSnapshotData } from "./trace/interfaces";

// Load environment variables
dotenv.config();

/**
 * Test script for multi-modal analysis system
 */
async function testMultiModalAnalysis() {
  console.log("Testing Multi-Modal Analysis System...");

  // Create an instance of the MultiModalAnalysisService with verbose logging
  const multiModalAnalysis = new MultiModalAnalysisService(
    {
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
    },
    true
  );

  // Initialize the service
  console.log("Initializing multi-modal analysis service...");
  await multiModalAnalysis.initialize();

  // Create a mock DOM snapshot
  const mockDOMSnapshot: DOMSnapshotData = {
    timestamp: Date.now() - 1000,
    html: `<html>
  <head>
    <title>Login Page</title>
  </head>
  <body>
    <div id="app">
      <h1>Login</h1>
      <form id="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" />
        </div>
        <div class="error-message">Invalid username or password</div>
        <button type="submit" class="btn-login">Login</button>
      </form>
    </div>
  </body>
</html>`,
    cssSelector: "#login-form",
    xpath: "/html/body/div/form",
    title: "Login Page",
    url: "https://example.com/login",
  };

  // Create a mock trace for testing
  const mockTrace: ParsedTrace = {
    testTitle: "Login Test",
    testFile: "login.spec.ts",
    browser: {
      name: "chromium",
      version: "latest",
      platform: "darwin",
    },
    actions: [
      {
        type: "navigate",
        timestamp: Date.now() - 5000,
      },
      {
        type: "fill",
        selector: "input[name='username']",
        value: "testuser",
        timestamp: Date.now() - 3000,
      },
      {
        type: "fill",
        selector: "input[name='password']",
        value: "password123",
        timestamp: Date.now() - 2000,
      },
      {
        type: "click",
        selector: "button.btn-submit", // Note: this doesn't match the actual button class
        timestamp: Date.now() - 1000,
      },
    ],
    networkRequests: [
      {
        url: "https://example.com/login",
        method: "GET",
        status: 200,
        timestamp: Date.now() - 4500,
      },
      {
        url: "https://example.com/api/login",
        method: "POST",
        status: 401, // Authentication failure
        error: "Unauthorized",
        timestamp: Date.now() - 800,
      },
    ],
    consoleMessages: [
      {
        type: "error",
        text: "Error: Failed to find element: button.btn-submit",
        timestamp: Date.now() - 900,
      },
    ],
    screenshots: [
      {
        timestamp: Date.now() - 4000,
        data: "base64encodedimagedataplaceholder", // In a real test, this would be actual image data
        title: "Login Page",
      },
      {
        timestamp: Date.now() - 500,
        data: "base64encodedimagedataplaceholder", // In a real test, this would be actual image data
        title: "Login Error",
      },
    ],
    domSnapshots: [mockDOMSnapshot],
    errors: [
      {
        message: "Error: Failed to find element: button.btn-submit",
        timestamp: Date.now() - 900,
      },
    ],
    duration: {
      start: Date.now() - 5000,
      end: Date.now(),
      total: 5000,
    },
    testResult: {
      status: "failed",
      error: {
        message: "Error: Failed to find element: button.btn-submit",
      },
    },
  };

  // Analyze the mock trace
  console.log("Analyzing mock trace...");
  const analysisResult = await multiModalAnalysis.analyzeTrace(mockTrace);

  if (analysisResult) {
    console.log("\n=== MULTI-MODAL ANALYSIS RESULT ===");
    console.log(`Root Cause: ${analysisResult.rootCause}`);
    console.log(
      `Confidence: ${Math.round(analysisResult.confidenceScore * 100)}%`
    );
    console.log("\nExplanation:");
    console.log(analysisResult.explanation);
    console.log("\nSuggested Fix:");
    console.log(analysisResult.suggestedFix);

    console.log("\nIndividual Modality Analyses:");
    for (const analysis of analysisResult.modalityAnalyses) {
      console.log(
        `- ${analysis.modalityType.toUpperCase()} (${Math.round(
          analysis.confidence * 100
        )}% confidence): ${analysis.result.substring(0, 100)}...`
      );
    }
  } else {
    console.log("Analysis failed to complete.");
  }
}

// Run the test
testMultiModalAnalysis()
  .then(() => console.log("Test completed successfully!"))
  .catch((error) => console.error("Test failed:", error));
