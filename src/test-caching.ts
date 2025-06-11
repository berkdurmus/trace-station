import { ModelProviderFactory } from "./agents/interfaces";
import { PromptTemplate } from "@langchain/core/prompts";
import * as dotenv from "dotenv";
import { PlaywrightDocs } from "./trace/classes/playwright.docs.class";
import { DiagnosisAgent } from "./agents/agent/diagnosis.agent";

// Load environment variables
dotenv.config();

async function testLLMCaching() {
  console.log("Testing LLM and embedding caching...");

  // Test embedding cache
  console.log("\n=== Testing Embedding Cache ===");
  const playwrightDocs = new PlaywrightDocs(undefined, true);

  // Initialize the vector store (this will create/load embeddings)
  await playwrightDocs.initialize();

  // Get initial cache statistics
  console.log(
    "Initial embedding cache stats:",
    playwrightDocs.getEmbeddingCacheStats()
  );

  // Run a query to see cache in action
  const query = "How to handle selector not found errors in Playwright?";
  console.log(`Running query: "${query}"`);

  const results1 = await playwrightDocs.retrieveRelevantDocs({
    testTitle: "Test Query",
    testFile: "test.spec.ts",
    actions: [],
    errors: [],
    networkRequests: [],
    testResult: { status: "failed", error: { message: "Selector not found" } },
    browser: { name: "chromium" },
    duration: { total: 1000 },
  } as any);

  console.log(`Found ${results1.length} results`);
  console.log(
    "Embedding cache stats after first query:",
    playwrightDocs.getEmbeddingCacheStats()
  );

  // Run the same query again to show cache hits
  console.log("\nRunning the same query again to show cache hits");
  const results2 = await playwrightDocs.retrieveRelevantDocs({
    testTitle: "Test Query",
    testFile: "test.spec.ts",
    actions: [],
    errors: [],
    networkRequests: [],
    testResult: { status: "failed", error: { message: "Selector not found" } },
    browser: { name: "chromium" },
    duration: { total: 1000 },
  } as any);

  console.log(`Found ${results2.length} results`);
  console.log(
    "Embedding cache stats after second query:",
    playwrightDocs.getEmbeddingCacheStats()
  );

  // Test LLM cache
  console.log("\n=== Testing LLM Response Cache ===");

  // Create a diagnosis agent with caching enabled
  const diagnosisAgent = new DiagnosisAgent(undefined, undefined, {
    enableCache: true,
    cacheTTL: 3600,
  });

  // Create a simple input for testing with all required fields
  const input = {
    trace: {
      testTitle: "Test Login",
      testFile: "login.spec.ts",
      actions: [
        {
          type: "click",
          selector: "button[type='submit']",
          timestamp: Date.now() - 3000,
        },
      ],
      errors: [
        { message: "Timeout 30000ms exceeded", timestamp: Date.now() - 1000 },
      ],
      networkRequests: [],
      testResult: {
        status: "failed" as "failed" | "passed" | "timedOut" | "skipped",
        error: { message: "Timeout 30000ms exceeded" },
      },
      browser: { name: "chromium" },
      duration: {
        total: 35000,
        start: Date.now() - 35000,
        end: Date.now(),
      },
      // Add missing properties
      consoleMessages: [],
      screenshots: [],
    },
    context: {
      type: "diagnosis",
    },
  };

  console.log("Running first diagnosis (cache miss)...");
  console.time("First diagnosis");
  const result1 = await diagnosisAgent.process(input);
  console.timeEnd("First diagnosis");
  console.log("Diagnosis result:", result1.result.rootCause);

  console.log(
    "\nRunning second diagnosis with same input (should be cache hit)..."
  );
  console.time("Second diagnosis");
  const result2 = await diagnosisAgent.process(input);
  console.timeEnd("Second diagnosis");
  console.log("Diagnosis result:", result2.result.rootCause);

  console.log("\nCaching test complete!");
}

// Run the test
testLLMCaching()
  .then(() => console.log("Test completed successfully"))
  .catch((error) => console.error("Error during test:", error));
