import {
  TraceFile,
  ParsedTrace,
  NetworkRequest,
  ConsoleMessage,
  ActionEvent,
} from "@/trace";

/**
 * Parses raw trace file data into a structured format
 */
export async function parseTraceFile(
  traceFile: TraceFile,
  networkFile?: TraceFile,
  stacksFile?: TraceFile
): Promise<ParsedTrace> {
  let traceData: any = {};
  let networkData: any = {};
  let stacksData: any = {};

  try {
    // Parse the main trace file
    const contentStr = traceFile.content.toString("utf-8");

    // Try to parse as NDJSON (Newline Delimited JSON) - common for Playwright traces
    // Each line is a separate JSON object
    console.log(`Attempting to parse ${traceFile.filename} as NDJSON format`);

    try {
      const lines = contentStr.split(/\r?\n/).filter((line) => line.trim());
      const parsedData: any[] = [];

      for (const line of lines) {
        try {
          if (line.trim()) {
            const obj = JSON.parse(line);
            parsedData.push(obj);
          }
        } catch (lineError) {
          console.warn(
            `Warning: Could not parse line as JSON: ${line.substring(0, 50)}...`
          );
        }
      }

      if (parsedData.length > 0) {
        console.log(
          `Successfully parsed ${parsedData.length} events from trace file`
        );
        traceData = {
          events: parsedData,
          format: "ndjson",
        };
      } else {
        throw new Error("No valid JSON lines found in trace file");
      }
    } catch (ndjsonError) {
      // If NDJSON parsing fails, try regular JSON as fallback
      console.log("NDJSON parsing failed, attempting regular JSON parsing");
      try {
        traceData = JSON.parse(contentStr);
        console.log("Successfully parsed trace file as regular JSON");
      } catch (jsonError) {
        // If both parsing methods fail, try to read the file as binary
        console.error("JSON parsing failed:", jsonError);
        console.log("Treating file as binary Playwright trace format");

        // Just store basic information
        traceData = {
          format: "binary",
          isBinaryTrace: true,
          filename: traceFile.filename,
          size: traceFile.content.length,
          // Add default values for required fields
          events: [],
          calls: [],
        };
      }
    }

    // Parse network file if provided
    if (networkFile) {
      console.log(`Parsing network file: ${networkFile.filename}`);
      try {
        const networkContentStr = networkFile.content.toString("utf-8");

        // Try to parse as NDJSON first (Newline Delimited JSON)
        try {
          console.log("Attempting to parse network file as NDJSON format");
          const lines = networkContentStr
            .split(/\r?\n/)
            .filter((line) => line.trim());
          const parsedNetworkData: any[] = [];

          for (const line of lines) {
            try {
              if (line.trim()) {
                const obj = JSON.parse(line);
                parsedNetworkData.push(obj);
              }
            } catch (lineError) {
              console.warn(
                `Warning: Could not parse network line as JSON: ${line.substring(
                  0,
                  50
                )}...`
              );
            }
          }

          if (parsedNetworkData.length > 0) {
            console.log(
              `Successfully parsed ${parsedNetworkData.length} network events from trace file`
            );
            networkData = {
              events: parsedNetworkData,
              format: "ndjson",
            };
          } else {
            throw new Error("No valid JSON lines found in network file");
          }
        } catch (ndjsonError) {
          // If NDJSON parsing fails, try regular JSON as fallback
          console.log(
            "Network NDJSON parsing failed, attempting regular JSON parsing"
          );
          try {
            networkData = JSON.parse(networkContentStr);
            console.log("Successfully parsed network file as regular JSON");
          } catch (jsonError) {
            console.error("Network file JSON parsing failed:", jsonError);

            // Try to extract partial data if possible
            console.log("Attempting to recover partial network data...");

            // Try to parse the file with a more lenient approach by removing problematic characters
            const cleanedContent = networkContentStr
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
              .replace(/,(\s*[\]}])/g, "$1"); // Remove trailing commas

            try {
              networkData = JSON.parse(cleanedContent);
              console.log("Successfully parsed cleaned network file");
            } catch (cleanError) {
              console.error("Failed to recover network data:", cleanError);

              // Create an empty network data object to avoid failures down the line
              console.log("Using empty network data structure");
              networkData = { events: [] };
            }
          }
        }

        console.log("Network data processing complete");
      } catch (error) {
        console.error("Error parsing network data:", error);
        // Create an empty network data object to avoid failures
        networkData = { events: [] };
      }
    }

    // Parse stacks file if provided
    if (stacksFile) {
      console.log(`Parsing stacks file: ${stacksFile.filename}`);
      try {
        const stacksContentStr = stacksFile.content.toString("utf-8");

        // Try to parse as NDJSON first
        try {
          console.log("Attempting to parse stacks file as NDJSON format");
          const lines = stacksContentStr
            .split(/\r?\n/)
            .filter((line) => line.trim());
          const parsedStacksData: any[] = [];

          for (const line of lines) {
            try {
              if (line.trim()) {
                const obj = JSON.parse(line);
                parsedStacksData.push(obj);
              }
            } catch (lineError) {
              console.warn(
                `Warning: Could not parse stacks line as JSON: ${line.substring(
                  0,
                  50
                )}...`
              );
            }
          }

          if (parsedStacksData.length > 0) {
            console.log(
              `Successfully parsed ${parsedStacksData.length} stack entries from trace file`
            );
            stacksData = {
              events: parsedStacksData,
              format: "ndjson",
            };
          } else {
            throw new Error("No valid JSON lines found in stacks file");
          }
        } catch (ndjsonError) {
          // If NDJSON parsing fails, try regular JSON
          console.log(
            "Stacks NDJSON parsing failed, attempting regular JSON parsing"
          );
          try {
            stacksData = JSON.parse(stacksContentStr);
            console.log("Successfully parsed stacks file as regular JSON");
          } catch (jsonError) {
            console.error("Stacks file JSON parsing failed:", jsonError);
            // Create an empty stacks data object
            stacksData = { events: [] };
          }
        }
      } catch (error) {
        console.error("Error parsing stacks data:", error);
        stacksData = { events: [] };
      }
    }
  } catch (error) {
    console.error("Error parsing trace data:", error);
    throw new Error(`Failed to parse trace file: ${traceFile.filename}`);
  }

  // Merge data from all files
  console.log(
    `Primary trace data contains ${
      Array.isArray(traceData.events) ? traceData.events.length : 0
    } events`
  );

  if (networkData && networkData.events) {
    console.log(`Network data contains ${networkData.events.length} events`);
  } else if (networkData && Array.isArray(networkData)) {
    console.log(`Network data contains ${networkData.length} items`);
  } else {
    console.log("Network data format unknown or empty");
  }

  if (stacksData && stacksData.events) {
    console.log(`Stacks data contains ${stacksData.events.length} events`);
  } else if (stacksData && Array.isArray(stacksData)) {
    console.log(`Stacks data contains ${stacksData.length} items`);
  } else {
    console.log("Stacks data format unknown or empty");
  }

  const mergedData = {
    ...traceData,
    network: networkData.network || networkData,
    stacks: stacksData.stacks || stacksData,
  };

  // Initialize the parsed trace with default values
  const parsedTrace: ParsedTrace = {
    testTitle: extractTestTitle(mergedData, traceFile.filename),
    testFile: extractTestFile(mergedData),
    browser: extractBrowserInfo(mergedData),
    actions: extractActions(mergedData),
    networkRequests: extractNetworkRequests(mergedData),
    consoleMessages: extractConsoleMessages(mergedData),
    screenshots: extractScreenshots(mergedData),
    errors: extractErrors(mergedData),
    duration: extractDuration(mergedData),
    testResult: extractTestResult(mergedData),
  };

  // Print summary of extracted data
  console.log("Extracted data summary:");
  console.log(`- Actions: ${parsedTrace.actions.length}`);
  console.log(`- Network requests: ${parsedTrace.networkRequests.length}`);
  console.log(`- Console messages: ${parsedTrace.consoleMessages.length}`);
  console.log(`- Errors: ${parsedTrace.errors.length}`);
  console.log(`- Screenshots: ${parsedTrace.screenshots.length}`);

  return parsedTrace;
}

// Helper functions to extract different parts of the trace data
function extractTestTitle(traceData: any, filename: string): string {
  // Try to find test title in trace data
  if (traceData.title) return traceData.title;
  if (traceData.metadata?.title) return traceData.metadata.title;

  // Fall back to filename if no title found
  return filename.replace(".trace", "").replace(".json", "");
}

function extractTestFile(traceData: any): string | undefined {
  if (traceData.file) return traceData.file;
  if (traceData.metadata?.file) return traceData.metadata.file;

  // Look for file path in calls or events
  const calls = traceData.calls || [];
  for (const call of calls) {
    if (call.stack && typeof call.stack === "string") {
      const match = call.stack.match(/at\s+.+\((.+\.js)/);
      if (match && match[1]) return match[1];
    }
  }

  return undefined;
}

function extractBrowserInfo(traceData: any): {
  name: string;
  version?: string;
  platform?: string;
} {
  // Default value
  const browserInfo = { name: "unknown" };

  // Check for browser info in various places
  if (traceData.browser) return traceData.browser;
  if (traceData.metadata?.browser) return traceData.metadata.browser;

  // Try to extract from context options or user agent
  if (traceData.options?.userAgent) {
    const uaMatch = traceData.options.userAgent.match(
      /(Chrome|Firefox|WebKit)\/(\d+\.\d+)/i
    );
    if (uaMatch) {
      return {
        name: uaMatch[1].toLowerCase(),
        version: uaMatch[2],
        platform: traceData.options.platform || undefined,
      };
    }
  }

  return browserInfo;
}

function extractActions(traceData: any): ActionEvent[] {
  const actions: ActionEvent[] = [];

  try {
    // Look for actions in different places depending on trace format
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    const calls = Array.isArray(traceData.calls) ? traceData.calls : [];

    // Process API calls as actions
    for (const call of calls) {
      if (!call || typeof call !== "object") continue;

      if (call.method && call.params) {
        actions.push({
          type: call.method,
          selector: call.params.selector,
          value: call.params.value,
          timestamp: call.startTime || 0,
          duration: call.endTime ? call.endTime - call.startTime : undefined,
          error: call.error?.message,
        });
      }
    }

    // Process events as actions
    for (const event of events) {
      if (!event || typeof event !== "object") continue;

      if (event.method) {
        actions.push({
          type: event.method,
          timestamp: event.time || 0,
          error: event.error?.message,
        });
      }
    }
  } catch (error) {
    console.error("Error processing actions:", error);
    // Continue with what we have so far
  }

  return actions.sort((a, b) => a.timestamp - b.timestamp);
}

function extractNetworkRequests(traceData: any): NetworkRequest[] {
  const requests: NetworkRequest[] = [];

  try {
    // Process events from the primary trace file first
    console.log("Processing network events from primary trace...");
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    console.log(`Found ${events.length} network events in primary trace`);

    // Extract network events from the primary trace
    for (const event of events) {
      if (!event || typeof event !== "object") continue;

      // Check if this is a network event
      if (
        event.method &&
        typeof event.method === "string" &&
        event.method.startsWith("Network.")
      ) {
        processNetworkEvent(event, requests);
      }
    }

    console.log(
      `Extracted ${requests.length} network requests from primary trace`
    );

    // Then process the supplementary network trace file data
    console.log("Processing supplemental network data...");

    // Make sure networkEvents is always an array
    let networkEvents: any[] = [];
    if (traceData.network) {
      if (Array.isArray(traceData.network)) {
        console.log(
          `Found ${traceData.network.length} network items in array format`
        );
        networkEvents = traceData.network;
      } else if (typeof traceData.network === "object") {
        // Some formats might have network data in a different structure
        console.log(
          "Network data is not an array, checking for alternative formats"
        );

        // Try to extract network events if they're stored differently
        if (
          traceData.network.events &&
          Array.isArray(traceData.network.events)
        ) {
          console.log(
            `Found ${traceData.network.events.length} events in network.events`
          );
          networkEvents = traceData.network.events;
        } else if (
          traceData.network.format === "ndjson" &&
          Array.isArray(traceData.network.events)
        ) {
          // Handle our custom NDJSON format from the parser
          console.log(
            `Found ${traceData.network.events.length} events in NDJSON format`
          );
          networkEvents = traceData.network.events;
        } else {
          // If we can't find network events in expected formats, try to infer structure
          console.log(
            "Could not find network events in expected format, trying to infer structure"
          );

          // Try to collect all potential request objects
          const potentialRequests: any[] = [];

          // If we have a network data object with properties that might be requests
          Object.entries(traceData.network).forEach(([key, value]) => {
            if (typeof value === "object" && value !== null) {
              // Check if the object looks like a network request
              if (
                "url" in value ||
                "method" in value ||
                "status" in value ||
                "requestId" in value ||
                "type" in value
              ) {
                potentialRequests.push(value);
              }
            }
          });

          if (potentialRequests.length > 0) {
            console.log(
              `Inferred ${potentialRequests.length} potential network requests`
            );
            networkEvents = potentialRequests;
          } else {
            console.log(
              "Could not infer network event structure, continuing with empty array"
            );
          }
        }
      }
    }

    // Process the supplementary network events
    const initialRequestCount = requests.length;
    console.log(
      `Processing ${networkEvents.length} supplemental network events`
    );

    for (const event of networkEvents) {
      if (!event || typeof event !== "object") continue;

      // Check if this is a network event from DevTools protocol
      if (
        event.method &&
        typeof event.method === "string" &&
        event.method.startsWith("Network.")
      ) {
        processNetworkEvent(event, requests);
      } else {
        // Handle direct network objects
        processDirectNetworkObject(event, requests);
      }
    }

    console.log(
      `Added ${
        requests.length - initialRequestCount
      } network requests from supplemental data`
    );
    console.log(`Total extracted network requests: ${requests.length}`);
  } catch (error) {
    console.error("Error processing network requests:", error);
    // Continue with what we have so far
  }

  return requests;
}

// Helper function to process DevTools protocol network events
function processNetworkEvent(event: any, requests: NetworkRequest[]): void {
  // Process Playwright/DevTools protocol network events
  if (event.method === "Network.requestWillBeSent" && event.params) {
    const request = event.params.request;
    if (request) {
      requests.push({
        requestId: event.params.requestId,
        url: request.url,
        method: request.method,
        headers: request.headers,
        timestamp: event.timestamp || event.params.timestamp,
        type: request.resourceType || "other",
      });
    }
  } else if (event.method === "Network.responseReceived" && event.params) {
    // Find the matching request and update with response data
    const requestId = event.params.requestId;
    const response = event.params.response;

    if (response) {
      const existingRequest = requests.find((r) => r.requestId === requestId);
      if (existingRequest) {
        existingRequest.status = response.status;
        existingRequest.statusText = response.statusText;
        existingRequest.responseHeaders = response.headers;
        existingRequest.mimeType = response.mimeType;
        existingRequest.responseTimestamp =
          event.timestamp || event.params.timestamp;
      } else {
        // Sometimes we might get a response without a matching request
        requests.push({
          requestId,
          url: response.url,
          method: response.requestMethod || "GET", // Add default method
          status: response.status,
          statusText: response.statusText,
          responseHeaders: response.headers,
          mimeType: response.mimeType,
          responseTimestamp: event.timestamp || event.params.timestamp,
        });
      }
    }
  }
}

// Helper function to process direct network objects
function processDirectNetworkObject(
  event: any,
  requests: NetworkRequest[]
): void {
  // Process direct network objects which might be in a different format
  // This is for trace data that already has processed network requests
  if (
    (event.url || event.request?.url) &&
    (event.method || event.request?.method)
  ) {
    const req: NetworkRequest = {
      requestId: event.requestId || event.id || `req_${requests.length}`,
      url: event.url || event.request?.url,
      method: event.method || event.request?.method,
      headers: event.headers || event.request?.headers,
      timestamp: event.timestamp || event.startTime,
      type: event.type || event.resourceType || "other",
      status: event.status || event.response?.status,
      statusText: event.statusText || event.response?.statusText,
      responseHeaders: event.responseHeaders || event.response?.headers,
      mimeType: event.mimeType || event.response?.mimeType,
      responseTimestamp: event.responseTimestamp || event.endTime,
    };

    // Only add if we have at least a URL
    if (req.url) {
      requests.push(req);
    }
  }
}

function extractConsoleMessages(traceData: any): ConsoleMessage[] {
  const messages: ConsoleMessage[] = [];

  try {
    // Look for console messages in different places depending on trace format
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    const consoleEvents = Array.isArray(traceData.console)
      ? traceData.console
      : [];

    // Process console events
    for (const event of [...events, ...consoleEvents]) {
      if (!event || typeof event !== "object") continue;

      if (
        event.method === "Runtime.consoleAPICalled" ||
        event.type === "console"
      ) {
        messages.push({
          type: event.params?.type || event.type || "log",
          text:
            event.params?.args?.[0]?.value || event.text || event.message || "",
          timestamp: event.timestamp || event.time || 0,
          stackTrace: event.params?.stackTrace?.toString() || event.stack,
        });
      }
    }
  } catch (error) {
    console.error("Error processing console messages:", error);
    // Continue with what we have so far
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

function extractScreenshots(
  traceData: any
): { timestamp: number; data: string; title?: string }[] {
  const screenshots: { timestamp: number; data: string; title?: string }[] = [];

  try {
    // Look for screenshots in different places depending on trace format
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    const screenshotEvents = Array.isArray(traceData.screenshots)
      ? traceData.screenshots
      : [];

    // Process screenshot events
    for (const event of [...events, ...screenshotEvents]) {
      if (!event || typeof event !== "object") continue;

      if (
        event.method === "Page.screencastFrame" ||
        event.type === "screencast-frame"
      ) {
        screenshots.push({
          timestamp: event.timestamp || event.time || 0,
          data: event.params?.data || event.data || "",
          title: event.params?.metadata?.title,
        });
      }
    }
  } catch (error) {
    console.error("Error processing screenshots:", error);
    // Continue with what we have so far
  }

  return screenshots.sort((a, b) => a.timestamp - b.timestamp);
}

function extractErrors(
  traceData: any
): { message: string; stack?: string; timestamp: number }[] {
  const errors: { message: string; stack?: string; timestamp: number }[] = [];

  try {
    // Look for errors in different places depending on trace format
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    const calls = Array.isArray(traceData.calls) ? traceData.calls : [];

    // Process error events
    for (const event of events) {
      if (!event || typeof event !== "object") continue;

      if (event.error || (event.method && event.method.includes("Error"))) {
        errors.push({
          message:
            event.error?.message || event.params?.message || "Unknown error",
          stack: event.error?.stack || event.params?.stack,
          timestamp: event.timestamp || event.time || 0,
        });
      }
    }

    // Process calls with errors
    for (const call of calls) {
      if (!call || typeof call !== "object") continue;

      if (call.error) {
        errors.push({
          message: call.error.message || "Unknown error",
          stack: call.error.stack,
          timestamp: call.endTime || call.startTime || 0,
        });
      }
    }
  } catch (error) {
    console.error("Error processing errors:", error);
    // Continue with what we have so far
  }

  return errors.sort((a, b) => a.timestamp - b.timestamp);
}

function extractDuration(traceData: any): {
  start: number;
  end: number;
  total: number;
} {
  let startTime = Number.MAX_SAFE_INTEGER;
  let endTime = 0;

  try {
    // Find earliest and latest timestamps
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    const calls = Array.isArray(traceData.calls) ? traceData.calls : [];

    for (const event of [...events, ...calls]) {
      if (!event || typeof event !== "object") continue;

      const start = event.startTime || event.timestamp || event.time || 0;
      const end = event.endTime || start;

      if (start < startTime) startTime = start;
      if (end > endTime) endTime = end;
    }
  } catch (error) {
    console.error("Error processing duration:", error);
    // Continue with a default duration
  }

  // Fall back to reasonable defaults if no times found
  if (startTime === Number.MAX_SAFE_INTEGER) startTime = 0;
  if (endTime === 0) endTime = startTime + 1000; // Assume 1 second

  return {
    start: startTime,
    end: endTime,
    total: endTime - startTime,
  };
}

function extractTestResult(traceData: any): {
  status: "passed" | "failed" | "timedOut" | "skipped";
  error?: { message: string; stack?: string };
} {
  try {
    // Default to failed if there are any errors
    const errors = extractErrors(traceData);
    if (errors.length > 0) {
      return {
        status: "failed",
        error: {
          message: errors[0].message,
          stack: errors[0].stack,
        },
      };
    }

    // Look for test result in metadata
    if (traceData.result) return traceData.result;
    if (traceData.metadata?.result) return traceData.metadata.result;

    // Check for specific error patterns
    const events = Array.isArray(traceData.events) ? traceData.events : [];
    for (const event of events) {
      if (!event || typeof event !== "object") continue;

      if (event.method === "Runtime.exceptionThrown") {
        return {
          status: "failed",
          error: {
            message:
              event.params?.exceptionDetails?.text || "Unknown exception",
            stack: event.params?.exceptionDetails?.stackTrace?.toString(),
          },
        };
      }
    }
  } catch (error) {
    console.error("Error processing test result:", error);
    // Return a default result if processing fails
    return { status: "passed" };
  }

  // Default to passed if no errors found
  return { status: "passed" };
}
