import { PlaywrightDocs } from "./trace/classes/playwright.docs.class";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testVectorStore() {
  console.log("Testing FAISS vector store implementation...");

  // Create a new PlaywrightDocs instance with verbose logging
  const playwrightDocs = new PlaywrightDocs(undefined, true);

  // Initialize the vector store (this will either load or create a new one)
  await playwrightDocs.initialize();

  console.log("Vector store test complete!");
}

// Run the test
testVectorStore()
  .then(() => console.log("Test completed successfully"))
  .catch((error) => console.error("Error during test:", error));
