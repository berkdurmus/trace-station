import { ParsedTrace } from "@/trace";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import * as fs from "fs";
import * as path from "path";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { DocumentationChunk } from "../interfaces";

export class PlaywrightDocs {
  private vectorStore: MemoryVectorStore;
  private isInitialized: boolean = false;
  private apiKey?: string;
  private verbose: boolean = false;

  constructor(apiKey?: string, verbose: boolean = false) {
    this.apiKey = apiKey;
    this.verbose = verbose;

    // Use OpenAIEmbeddings with API key from constructor or environment variable
    this.vectorStore = new MemoryVectorStore(
      new OpenAIEmbeddings({
        openAIApiKey: this.apiKey || process.env.OPENAI_API_KEY,
      })
    );
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[PlaywrightDocs] ${message}`);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.log("Initializing Playwright documentation...");
    // Load documentation from local files
    await this.loadLocalDocumentation();

    this.isInitialized = true;
    this.log("Documentation initialization complete.");
  }

  async loadLocalDocumentation(): Promise<void> {
    // Path to local documentation directory
    const docsDir = path.join(__dirname, "../../../data/docs");
    this.log(`Looking for documentation in: ${docsDir}`);

    // Check if directory exists
    if (!fs.existsSync(docsDir)) {
      console.warn(`Documentation directory not found: ${docsDir}`);
      // Create placeholder documentation
      await this.createPlaceholderDocs();
      return;
    }

    // Read files from directory
    const files = fs.readdirSync(docsDir);
    this.log(`Processing ${files.length} documentation files...`);
    const documents: Document[] = [];

    let mdFiles = 0;
    for (const file of files) {
      if (file.endsWith(".md") || file.endsWith(".txt")) {
        mdFiles++;
        const filePath = path.join(docsDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        // Split content into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });

        const docs = await textSplitter.createDocuments(
          [content],
          [
            {
              source: filePath,
              title: file.replace(/\.(md|txt)$/, ""),
              url: `https://playwright.dev/docs/${file.replace(
                /\.(md|txt)$/,
                ""
              )}`,
            },
          ]
        );

        documents.push(...docs);
      }
    }

    // Add documents to vector store
    if (documents.length > 0) {
      this.log(`Adding ${documents.length} document chunks to vector store...`);
      await this.vectorStore.addDocuments(documents);
      this.log("Documents added to vector store successfully.");
    } else {
      console.warn("No documentation files found, creating placeholder docs");
      await this.createPlaceholderDocs();
    }
  }

  async createPlaceholderDocs(): Promise<void> {
    // Create some placeholder documentation for common Playwright issues
    const placeholderDocs = [
      {
        title: "Selector Not Found",
        content: `
# Selector Not Found Error

When Playwright can't find a selector, it typically means one of the following:

1. The selector doesn't exist in the DOM
2. The selector exists but is not visible
3. The selector is in an iframe or shadow DOM
4. There's a timing issue and the element hasn't loaded yet

## Potential Solutions

- Use waitForSelector to wait for the element to appear
- Check if the selector is correct
- Use a more robust selector (CSS, XPath, or text)
- Increase timeout values
- Check if the element is inside an iframe or shadow DOM
`,
        url: "https://playwright.dev/docs/selectors",
      },
      {
        title: "Timeouts",
        content: `
# Handling Timeouts in Playwright

Timeouts occur when an operation takes longer than the allowed time. Common causes include:

1. Slow network connections
2. Long-running scripts
3. Page not loading completely
4. Resource loading issues

## Timeout Settings

You can configure timeouts in several ways:
- Global timeouts in playwright.config.js
- Test-specific timeouts using test.setTimeout()
- Action-specific timeouts, e.g., page.click('selector', { timeout: 30000 })

## Best Practices

- Start with longer timeouts during development
- Use waitForSelector, waitForLoadState, and waitForResponse effectively
- Consider network throttling for testing under poor network conditions
`,
        url: "https://playwright.dev/docs/test-timeouts",
      },
      {
        title: "Network Issues",
        content: `
# Debugging Network Issues

Network-related failures can include:

1. Failed requests (404, 500 errors)
2. Network timeouts
3. CORS issues
4. Resource loading failures

## Debugging Tips

- Use page.route() to intercept and mock network requests
- Check page.on('request') and page.on('response') events
- Examine network timings for slow requests
- Use console.log to debug request/response data

## Best Practices

- Mock external dependencies when possible
- Add retry logic for flaky external services
- Use waitForResponse to ensure critical requests complete
`,
        url: "https://playwright.dev/docs/network",
      },
      {
        title: "Test Flakiness",
        content: `
# Dealing with Flaky Tests

Flaky tests pass sometimes and fail other times, often due to:

1. Race conditions
2. Timeouts
3. Environment differences
4. External dependencies

## Strategies to Reduce Flakiness

- Use proper waiting mechanisms (waitForSelector, waitForEvent)
- Add retry logic for flaky operations
- Isolate tests by avoiding shared state
- Mock external dependencies
- Use video recording and traces to debug failures

## Best Practices

- Run tests in isolation
- Design tests to be idempotent
- Add test retries for potentially flaky tests
`,
        url: "https://playwright.dev/docs/test-retry",
      },
    ];

    // Process placeholder docs
    const documents: Document[] = [];

    for (const doc of placeholderDocs) {
      // Split content into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const docs = await textSplitter.createDocuments(
        [doc.content],
        [
          {
            source: "placeholder",
            title: doc.title,
            url: doc.url,
          },
        ]
      );

      documents.push(...docs);
    }

    // Add documents to vector store
    await this.vectorStore.addDocuments(documents);
  }

  async retrieveRelevantDocs(
    trace: ParsedTrace,
    analysis?: any
  ): Promise<DocumentationChunk[]> {
    await this.initialize();

    // Enhanced query construction for better semantic matching
    let query = `Playwright test error analysis: `;

    // Add most significant error details
    if (trace.testResult.error?.message) {
      query += `${trace.testResult.error.message}. `;
    }

    // Add key actions that might be relevant
    const lastActions = trace.actions.slice(-3); // Last 3 actions
    if (lastActions && lastActions.length > 0) {
      query += `Last actions performed: ${lastActions
        .map((a) => `${a.type} ${a.selector || ""}`)
        .join(", ")}. `;
    }

    // Add error information focusing on most recent
    if (trace.errors && trace.errors.length > 0) {
      const lastError = trace.errors[trace.errors.length - 1];
      query += `Error: ${lastError.message}. `;
    }

    // Add analysis context if available
    if (analysis?.failureReason) {
      query += `Analysis indicates: ${analysis.failureReason}. `;
    }

    if (analysis?.failurePoint) {
      query += `Problem at: ${analysis.failurePoint}. `;
    }

    // Add network error information if available
    if (trace.networkRequests && trace.networkRequests.length > 0) {
      const failedNetworkRequests = trace.networkRequests.filter(
        (req) => (req.status !== undefined && req.status >= 400) || req.error
      );

      if (failedNetworkRequests.length > 0) {
        query += `Network failures: ${failedNetworkRequests.length} requests failed. `;
        // Add details of the first failed request
        if (failedNetworkRequests[0]) {
          const req = failedNetworkRequests[0];
          query += `Example: ${req.method} ${req.url} - Status: ${
            req.status || "unknown"
          } ${req.error ? `Error: ${req.error}` : ""}. `;
        }
      }
    }

    this.log(`Searching documentation for relevant information...`);
    this.log(`Query: ${query}`);

    // Search for relevant docs
    const results = await this.vectorStore.similaritySearch(query, 5);

    // Filter results to focus on the most relevant
    const filteredResults = results
      // Limit to top 3
      .slice(0, 3);

    this.log(`Found ${filteredResults.length} relevant documentation matches.`);

    // Format results
    return filteredResults.map((doc) => {
      const metadata = doc.metadata as any;
      const source = this.formatDocumentSource(metadata.source, metadata.url);

      return {
        title: metadata.title || "Unknown",
        content: doc.pageContent,
        url: metadata.url || "https://playwright.dev/docs",
        documentSource: source,
        excerpt:
          doc.pageContent.length > 200
            ? doc.pageContent.substring(0, 200) + "..."
            : doc.pageContent,
      };
    });
  }

  // Helper to format a readable document source from file path and URL
  private formatDocumentSource(source?: string, url?: string): string {
    // Extract filename from source path if available
    let sourceName = "Unknown";
    if (source) {
      const fileName = source
        .split("/")
        .pop()
        ?.replace(/\.(md|txt)$/, "");
      if (fileName) {
        sourceName = fileName.replace(/-/g, " ");
        // Convert to title case
        sourceName = sourceName
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }

    // Use sourceName and URL together
    if (url) {
      return `${sourceName} (${url})`;
    }

    return sourceName;
  }
}
