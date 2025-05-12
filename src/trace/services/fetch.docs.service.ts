#!/usr/bin/env node

/**
 * This script fetches Playwright documentation from the official repository
 * and saves it to the data/docs directory for use in the debug agent.
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { IncomingMessage } from "http";

// GitHub API URL for Playwright docs
const PLAYWRIGHT_DOCS_API =
  "https://api.github.com/repos/microsoft/playwright/contents/docs";
const PLAYWRIGHT_RAW_CONTENT =
  "https://raw.githubusercontent.com/microsoft/playwright/main/docs/";
const OUTPUT_DIR = path.join(__dirname, "../../../data/docs");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

/**
 * Make a GET request to the specified URL
 * @param {string} url - The URL to fetch
 * @param {boolean} isJson - Whether to parse the response as JSON
 * @returns {Promise<any>} - The response data
 */
function fetchUrl(url: string, isJson = true): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "trace-station",
        // Add a GitHub token in .env file if you hit rate limits
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }),
      },
    };

    https
      .get(url, options, (res: IncomingMessage) => {
        let data = "";

        res.on("data", (chunk): void => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `Request failed with status code ${res.statusCode}: ${data}`
              )
            );
            return;
          }

          try {
            resolve(isJson ? JSON.parse(data) : data);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Process a Markdown file by downloading and saving it
 * @param {string} filename - The filename of the doc
 * @param {boolean} forceProcess - Whether to force process the file
 */
async function processMarkdownFile(filename: string, forceProcess = false) {
  try {
    // Skip internal docs and API docs that are not specifically requested
    if (
      !forceProcess &&
      (filename.startsWith("_") || filename.includes("/api/"))
    ) {
      return;
    }

    // Check if file already exists and skip if it does
    const outputFilename = filename.replace(/\//g, "-");
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    if (fs.existsSync(outputPath) && !process.env.FORCE_DOC_UPDATE) {
      return;
    }

    const fileUrl = `${PLAYWRIGHT_RAW_CONTENT}${filename}`;
    console.log(`Fetching: ${filename}`);

    const content = await fetchUrl(fileUrl, false);

    // Create a normalized filename
    fs.writeFileSync(outputPath, content);
    console.log(`Saved: ${outputPath}`);
  } catch (error: any) {
    console.error(`Error processing ${filename}:`, error.message);
  }
}

/**
 * Recursively fetch all Markdown files from a directory
 * @param {string} dirPath - The directory path to fetch
 */
async function fetchDocsFromDirectory(dirPath = "") {
  try {
    const url = `${PLAYWRIGHT_DOCS_API}${dirPath ? "/" + dirPath : ""}`;
    const contents = (await fetchUrl(url)) as any[];

    for (const item of contents) {
      if (item.type === "file" && item.name.endsWith(".md")) {
        const filePath = dirPath ? `${dirPath}/${item.name}` : item.name;
        await processMarkdownFile(filePath);
      } else if (
        item.type === "dir" &&
        !item.name.startsWith(".") &&
        item.name !== "api"
      ) {
        // Skip API directory as it's typically very large and structured differently
        const subDirPath = dirPath ? `${dirPath}/${item.name}` : item.name;
        await fetchDocsFromDirectory(subDirPath);
      }
    }
  } catch (error: any) {
    console.error(`Error fetching directory ${dirPath}:`, error.message);
  }
}

/**
 * Main function to fetch Playwright documentation
 */
export async function fetchPlaywrightDocs(forceUpdate = false) {
  try {
    // Set environment flag for forcing doc updates
    if (forceUpdate) {
      process.env.FORCE_DOC_UPDATE = "true";
    }

    console.log("Starting to fetch Playwright documentation...");

    // Fetch main documentation files
    await fetchDocsFromDirectory();

    // Fetch some essential API documentation
    const essentialApiDocs = [
      "api/class-playwright.md",
      "api/class-browser.md",
      "api/class-page.md",
      "api/class-locator.md",
      "api/class-test.md",
      "api/class-expect.md",
      "api/class-request.md",
      "api/class-response.md",
    ];

    for (const apiDoc of essentialApiDocs) {
      await processMarkdownFile(apiDoc, true);
    }

    console.log("Documentation fetching complete!");
    console.log(`Documentation saved to: ${OUTPUT_DIR}`);

    // Clean up the environment variable
    delete process.env.FORCE_DOC_UPDATE;

    return true;
  } catch (error: any) {
    console.error("Error fetching documentation:", error.message);
    return false;
  }
}

// Execute the main function when this file is run directly
if (require.main === module) {
  fetchPlaywrightDocs().catch((error) => {
    console.error("Failed to fetch docs:", error);
    process.exit(1);
  });
}
