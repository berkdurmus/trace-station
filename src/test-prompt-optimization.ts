import * as dotenv from "dotenv";
import { DiagnosisAgent } from "./agents/agent/diagnosis.agent";
import { ParsedTrace } from "./trace";
import { compressText, optimizeSystemPrompt } from "./utils/prompt.utils";
import { DiagnosisPromptOptimizer } from "./utils/diagnosis.prompt.optimizer";

// Load environment variables
dotenv.config();

/**
 * Mock trace data for testing
 */
const mockTrace: ParsedTrace = {
  testTitle: "Login Test",
  testFile: "tests/login.spec.ts",
  browser: { name: "chromium" },
  duration: {
    total: 30000,
    start: Date.now() - 30000,
    end: Date.now(),
  },
  actions: [
    { type: "navigate", timestamp: Date.now() - 25000 },
    {
      type: "fill",
      selector: "input[name='username']",
      value: "testuser",
      timestamp: Date.now() - 20000,
    },
    {
      type: "fill",
      selector: "input[name='password']",
      value: "password123",
      timestamp: Date.now() - 15000,
    },
    {
      type: "click",
      selector: "button[type='submit']",
      timestamp: Date.now() - 10000,
      error: "Element not visible",
    },
  ],
  errors: [
    {
      message: "Element not visible: button[type='submit']",
      timestamp: Date.now() - 10000,
      stack:
        "Error: Element not visible\n    at click (/path/to/file.js:123:45)\n    at Object.run (/path/to/file.js:678:90)\n    at Runner.runTest (/path/to/file.js:123:45)\n    at async Context.run (/path/to/file.js:123:45)",
    },
  ],
  networkRequests: [
    {
      method: "GET",
      url: "https://example.com/login",
      status: 200,
      timing: { startTime: Date.now() - 25000, duration: 300 },
    },
    {
      method: "GET",
      url: "https://example.com/styles.css",
      status: 200,
      timing: { startTime: Date.now() - 24800, duration: 150 },
    },
    {
      method: "GET",
      url: "https://example.com/script.js",
      status: 200,
      timing: { startTime: Date.now() - 24700, duration: 200 },
    },
    {
      method: "POST",
      url: "https://example.com/api/login",
      status: 401,
      timing: { startTime: Date.now() - 10000, duration: 500 },
    },
  ],
  consoleMessages: [
    { type: "log", text: "Page loaded", timestamp: Date.now() - 24500 },
    {
      type: "error",
      text: "Failed to authenticate user",
      timestamp: Date.now() - 9500,
    },
  ],
  screenshots: [],
  testResult: {
    status: "failed",
    error: { message: "Element not visible: button[type='submit']" },
  },
};

/**
 * Add a bunch of extra network requests and console messages to increase prompt size
 */
function addExtraData(trace: ParsedTrace): ParsedTrace {
  const clone = JSON.parse(JSON.stringify(trace)) as ParsedTrace;

  // Add 50 extra network requests
  for (let i = 0; i < 50; i++) {
    clone.networkRequests.push({
      method: "GET",
      url: `https://example.com/resource${i}.jpg`,
      status: 200,
      timing: { startTime: Date.now() - 20000 + i * 100, duration: 50 },
    });
  }

  // Add 50 extra console messages
  for (let i = 0; i < 50; i++) {
    clone.consoleMessages.push({
      type: "log",
      text: `Debug message ${i}: Processing data...`,
      timestamp: Date.now() - 20000 + i * 100,
    });
  }

  return clone;
}

/**
 * Original format method for comparison
 */
function formatTraditionalPrompt(trace: ParsedTrace): string {
  // Format trace data for agent input
  const traceSummary = `
Title: ${trace.testTitle || "Unknown Test"}
File: ${trace.testFile || "Unknown File"}
Browser: ${trace.browser.name}
Duration: ${Math.round(trace.duration.total / 1000)}s
Status: ${trace.testResult.status.toUpperCase()}
${trace.testResult.error ? `Error: ${trace.testResult.error.message}` : ""}
  `.trim();

  const actionsSummary = trace.actions
    .map((action) => {
      const time = new Date(action.timestamp)
        .toISOString()
        .split("T")[1]
        .split("Z")[0];
      const status = action.error ? "FAILED" : "PASSED";
      return `[${time}] ${status} - ${action.type}${
        action.selector ? ` "${action.selector}"` : ""
      }${action.value ? ` with value "${action.value}"` : ""}${
        action.error ? ` - Error: ${action.error}` : ""
      }`;
    })
    .join("\n");

  const errorsSummary = trace.errors
    .map((error) => {
      const time = new Date(error.timestamp)
        .toISOString()
        .split("T")[1]
        .split("Z")[0];
      return `[${time}] ${error.message}${
        error.stack ? `\nStack: ${error.stack}` : ""
      }`;
    })
    .join("\n\n");

  const networkSummary = trace.networkRequests
    .map((req) => {
      const time = req.timing
        ? new Date(req.timing.startTime)
            .toISOString()
            .split("T")[1]
            .split("Z")[0]
        : "N/A";
      const status = req.status
        ? `${req.status} ${req.statusText || ""}`
        : "No response";
      const duration =
        req.timing && req.timing.duration
          ? `${Math.round(req.timing.duration)}ms`
          : "N/A";
      return `[${time}] ${req.method} ${req.url} - ${status} (${duration})${
        req.error ? ` - Error: ${req.error}` : ""
      }`;
    })
    .join("\n");

  const consoleSummary = trace.consoleMessages
    .map((msg) => {
      const time = new Date(msg.timestamp)
        .toISOString()
        .split("T")[1]
        .split("Z")[0];
      return `[${time}] ${msg.type.toUpperCase()}: ${msg.text}`;
    })
    .join("\n");

  const systemPrompt = `
You are an expert at diagnosing Playwright test failures and identifying root causes. Your task is to 
analyze test failures in detail and provide a clear diagnosis of what went wrong.

Focus on:
1. Determining the root cause of the failure
2. Explaining why the test failed in technical detail
3. Providing confidence level in your diagnosis
4. Identifying any related issues that might be contributing to the failure

Your diagnosis should be precise, technically accurate, and helpful for developers to understand
exactly what went wrong and why.
  `;

  return `
${systemPrompt}

Test Information:
${traceSummary}

Actions Timeline:
${actionsSummary}

Errors:
${errorsSummary}

Network Requests:
${networkSummary}

Console Messages:
${consoleSummary}

Based on the provided trace information, provide a detailed diagnosis of the root cause of this test failure.
  `;
}

/**
 * Test function to compare prompt sizes
 */
async function testPromptOptimization() {
  console.log("Testing prompt optimization...");

  // Create a regular trace
  console.log("\n=== Regular Trace ===");
  const regularTrace = mockTrace;

  // Create a trace with lots of extra data
  console.log("\n=== Large Trace ===");
  const largeTrace = addExtraData(mockTrace);

  // Generate prompts using traditional approach
  const traditionalRegularPrompt = formatTraditionalPrompt(regularTrace);
  const traditionalLargePrompt = formatTraditionalPrompt(largeTrace);

  // Generate prompts using optimizer
  const promptOptimizer = new DiagnosisPromptOptimizer();
  const optimizedRegularPrompt = promptOptimizer.generatePrompt(
    { trace: regularTrace },
    `You are an expert at diagnosing Playwright test failures and identifying root causes. Your task is to 
analyze test failures in detail and provide a clear diagnosis of what went wrong.

Focus on:
1. Determining the root cause of the failure
2. Explaining why the test failed in technical detail
3. Providing confidence level in your diagnosis
4. Identifying any related issues that might be contributing to the failure

Your diagnosis should be precise, technically accurate, and helpful for developers to understand
exactly what went wrong and why.`,
    "Output instructions would go here"
  );

  const optimizedLargePrompt = promptOptimizer.generatePrompt(
    { trace: largeTrace },
    `You are an expert at diagnosing Playwright test failures and identifying root causes. Your task is to 
analyze test failures in detail and provide a clear diagnosis of what went wrong.

Focus on:
1. Determining the root cause of the failure
2. Explaining why the test failed in technical detail
3. Providing confidence level in your diagnosis
4. Identifying any related issues that might be contributing to the failure

Your diagnosis should be precise, technically accurate, and helpful for developers to understand
exactly what went wrong and why.`,
    "Output instructions would go here"
  );

  // Print token counts and sizes
  console.log("\n=== Results ===");
  console.log(
    "Regular Trace Traditional Prompt: ",
    traditionalRegularPrompt.length,
    "characters"
  );
  console.log(
    "Regular Trace Optimized Prompt:   ",
    optimizedRegularPrompt.length,
    "characters"
  );
  console.log(
    `Reduction: ${(
      ((traditionalRegularPrompt.length - optimizedRegularPrompt.length) /
        traditionalRegularPrompt.length) *
      100
    ).toFixed(2)}%`
  );

  console.log(
    "\nLarge Trace Traditional Prompt:  ",
    traditionalLargePrompt.length,
    "characters"
  );
  console.log(
    "Large Trace Optimized Prompt:    ",
    optimizedLargePrompt.length,
    "characters"
  );
  console.log(
    `Reduction: ${(
      ((traditionalLargePrompt.length - optimizedLargePrompt.length) /
        traditionalLargePrompt.length) *
      100
    ).toFixed(2)}%`
  );

  console.log("\n=== Sample Optimized System Prompt ===");
  const originalSystemPrompt = `You are an expert at diagnosing Playwright test failures and identifying root causes. Your task is to 
analyze test failures in detail and provide a clear diagnosis of what went wrong.

Focus on:
1. Determining the root cause of the failure
2. Explaining why the test failed in technical detail
3. Providing confidence level in your diagnosis
4. Identifying any related issues that might be contributing to the failure

Your diagnosis should be precise, technically accurate, and helpful for developers to understand
exactly what went wrong and why.`;

  const optimizedSystemPrompt = optimizeSystemPrompt(originalSystemPrompt);
  console.log("Original: ", originalSystemPrompt.length, "characters");
  console.log("Optimized:", optimizedSystemPrompt.length, "characters");
  console.log(
    `Reduction: ${(
      ((originalSystemPrompt.length - optimizedSystemPrompt.length) /
        originalSystemPrompt.length) *
      100
    ).toFixed(2)}%`
  );

  console.log("\nOriginal System Prompt:");
  console.log(originalSystemPrompt);
  console.log("\nOptimized System Prompt:");
  console.log(optimizedSystemPrompt);
}

// Run the test
testPromptOptimization()
  .then(() => console.log("\nTest completed successfully"))
  .catch((error) => console.error("Error during test:", error));
