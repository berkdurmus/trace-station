import { ParsedTrace } from "@/trace";
import {
  compressText,
  optimizePrompt,
  optimizeSystemPrompt,
  truncateText,
} from "./prompt.utils";

/**
 * Base class for prompt optimization
 */
export class PromptOptimizer {
  /**
   * Maximum length for each section
   */
  protected maxSectionLength: number = 1000;

  /**
   * Optimize system prompt
   * @param prompt System prompt to optimize
   * @returns Optimized system prompt
   */
  optimizeSystemPrompt(prompt: string): string {
    return optimizeSystemPrompt(prompt);
  }

  /**
   * Optimize prompt sections
   * @param sections Sections to optimize
   * @returns Optimized prompt
   */
  optimizeSections(sections: Record<string, string>): string {
    return optimizePrompt(sections, this.maxSectionLength);
  }

  /**
   * Format trace summary with optimization
   * @param trace The trace to format
   * @returns Optimized trace summary
   */
  formatTraceSummary(trace: ParsedTrace): string {
    const summary = `
Title: ${trace.testTitle || "Unknown Test"}
File: ${trace.testFile || "Unknown File"}
Browser: ${trace.browser.name}${
      trace.browser.version ? ` v${trace.browser.version}` : ""
    }
Duration: ${Math.round(trace.duration.total / 1000)}s
Status: ${trace.testResult.status.toUpperCase()}
${trace.testResult.error ? `Error: ${trace.testResult.error.message}` : ""}
    `;

    return compressText(summary);
  }

  /**
   * Format actions summary with optimization
   * @param trace The trace to format
   * @returns Optimized actions summary
   */
  formatActionsSummary(trace: ParsedTrace): string {
    if (trace.actions.length === 0) {
      return "No actions recorded.";
    }

    // Prioritize failed actions
    const actions = trace.actions.map((action) => {
      const time = new Date(action.timestamp)
        .toISOString()
        .split("T")[1]
        .split("Z")[0];
      const status = action.error ? "FAILED" : "PASSED";
      return {
        text: `[${time}] ${status} - ${action.type}${
          action.selector ? ` "${action.selector}"` : ""
        }${action.value ? ` with value "${action.value}"` : ""}${
          action.error ? ` - Error: ${action.error}` : ""
        }`,
        isFailed: !!action.error,
      };
    });

    // Always include failures, then add most recent successful actions
    const failedActions = actions.filter((a) => a.isFailed).map((a) => a.text);
    const successfulActions = actions
      .filter((a) => !a.isFailed)
      .map((a) => a.text);

    // Keep all failures and a few successful actions
    const maxSuccessfulActions = Math.min(5, successfulActions.length);
    const relevantSuccessful = successfulActions.slice(-maxSuccessfulActions);

    if (failedActions.length > 0) {
      return [...relevantSuccessful, ...failedActions].join("\n");
    }

    // If no failures, just show the most recent actions, limited to 10
    return truncateText(
      successfulActions.join("\n"),
      this.maxSectionLength,
      3,
      7
    );
  }

  /**
   * Format errors summary with optimization
   * @param trace The trace to format
   * @returns Optimized errors summary
   */
  formatErrorsSummary(trace: ParsedTrace): string {
    if (trace.errors.length === 0) {
      return "No errors recorded.";
    }

    // Take the most recent errors, truncating if there are too many
    const errors = trace.errors.map((error) => {
      const time = new Date(error.timestamp)
        .toISOString()
        .split("T")[1]
        .split("Z")[0];

      // Optimize stack traces by only including key parts
      let stack = "";
      if (error.stack) {
        const stackLines = error.stack.split("\n");
        // Keep only first few and last few lines of stack trace
        if (stackLines.length > 6) {
          stack = `\nStack: ${stackLines.slice(0, 3).join("\n")}
... (${stackLines.length - 6} lines omitted) ...
${stackLines.slice(-3).join("\n")}`;
        } else {
          stack = `\nStack: ${error.stack}`;
        }
      }

      return `[${time}] ${error.message}${stack}`;
    });

    // Limit to last 3 errors if there are many
    if (errors.length > 3) {
      return `${errors.slice(-3).join("\n\n")}\n(${
        errors.length - 3
      } more errors omitted)`;
    }

    return errors.join("\n\n");
  }

  /**
   * Format network requests summary with optimization
   * @param trace The trace to format
   * @returns Optimized network summary
   */
  formatNetworkSummary(trace: ParsedTrace): string {
    if (trace.networkRequests.length === 0) {
      return "No network requests recorded.";
    }

    // Prioritize failed requests
    const requests = trace.networkRequests.map((req) => {
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

      return {
        text: `[${time}] ${req.method} ${req.url} - ${status} (${duration})${
          req.error ? ` - Error: ${req.error}` : ""
        }`,
        isFailed:
          (req.status !== undefined && req.status >= 400) || !!req.error,
      };
    });

    // Always include failures, then add a sample of successful requests
    const failedRequests = requests
      .filter((r) => r.isFailed)
      .map((r) => r.text);
    const successfulRequests = requests
      .filter((r) => !r.isFailed)
      .map((r) => r.text);

    // Compress URLs to keep the summary shorter
    const compressedFailed = failedRequests.map((req) => {
      // Shorten long URLs
      return req.replace(/([a-z]+:\/\/[^\/]+\/[^\/]+)\/.*?(\s|$)/, "$1/...$2");
    });

    if (compressedFailed.length > 0) {
      // Show a few successful requests for context
      const sampleSuccessful =
        successfulRequests.length > 3
          ? successfulRequests.slice(0, 3)
          : successfulRequests;

      return [...sampleSuccessful, ...compressedFailed].join("\n");
    }

    // If no failures, just show a sample of the requests
    return truncateText(
      successfulRequests.join("\n"),
      this.maxSectionLength,
      3,
      3
    );
  }

  /**
   * Format console messages summary with optimization
   * @param trace The trace to format
   * @returns Optimized console summary
   */
  formatConsoleSummary(trace: ParsedTrace): string {
    if (trace.consoleMessages.length === 0) {
      return "No console messages recorded.";
    }

    // Prioritize errors and warnings
    const messages = trace.consoleMessages.map((msg) => {
      const time = new Date(msg.timestamp)
        .toISOString()
        .split("T")[1]
        .split("Z")[0];

      return {
        text: `[${time}] ${msg.type.toUpperCase()}: ${msg.text}`,
        isPriority: msg.type === "error" || msg.type === "warning",
      };
    });

    const priorityMessages = messages
      .filter((m) => m.isPriority)
      .map((m) => m.text);
    const otherMessages = messages
      .filter((m) => !m.isPriority)
      .map((m) => m.text);

    if (priorityMessages.length > 0) {
      // Include all priority messages and a few others
      return [...priorityMessages, ...otherMessages.slice(0, 3)].join("\n");
    }

    // If no priority messages, just show most recent ones
    return truncateText(otherMessages.join("\n"), this.maxSectionLength, 3, 3);
  }
}
