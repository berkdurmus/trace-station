import { BaseAgent } from "./base.agent";
import { AgentInput, TraceAnalysisOutput } from "@/agents";
import { ParsedTrace } from "@/trace";
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { ILanguageModelProvider } from "@/agents";

export class TraceAnalysisAgent extends BaseAgent<TraceAnalysisOutput> {
  private outputParser: StructuredOutputParser<any>;

  constructor(apiKey?: string, modelProvider?: ILanguageModelProvider) {
    const systemPrompt = `
You are an expert Playwright test analyzer. Your task is to analyze trace data from Playwright tests to identify failures.
Focus on:
1. Failed assertions or expectations
2. Error messages and stack traces
3. Network request failures
4. Timing issues
5. DOM-related failures
6. Console errors

Provide a structured analysis of what failed in this test. Your analysis should be detailed but focused on the most critical issues.
You will receive parsed trace information, including actions, network requests, console messages, and errors.
    `;

    super(systemPrompt, modelProvider, apiKey);

    // Create parser for structured output
    this.outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        failurePoint: z.string().optional(),
        failureReason: z.string().optional(),
        failedActions: z.array(z.string()).optional(),
        errorMessages: z.array(z.string()).optional(),
        severityLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
        reasoning: z.string().optional(),
      })
    );
  }

  async formatInput(input: AgentInput): Promise<string> {
    const { trace } = input;

    // Format trace data for agent input
    const traceSummary = this.formatTraceSummary(trace);
    const actionsSummary = this.formatActionsSummary(trace);
    const errorsSummary = this.formatErrorsSummary(trace);
    const networkSummary = this.formatNetworkSummary(trace);
    const consoleSummary = this.formatConsoleSummary(trace);

    const format_instructions = this.outputParser.getFormatInstructions();

    return `
${this.systemPrompt}

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

${format_instructions}

Based on the provided trace information, identify what failed in this test.
    `;
  }

  async parseOutput(output: string): Promise<TraceAnalysisOutput> {
    try {
      // First try direct parsing with the StructuredOutputParser
      const parsedOutput = await this.outputParser.parse(output);

      console.log("trace analysis:", parsedOutput);

      return {
        result: {
          failurePoint: parsedOutput.failurePoint,
          failureReason: parsedOutput.failureReason,
          failedActions: parsedOutput.failedActions || [],
          errorMessages: parsedOutput.errorMessages || [],
          severityLevel: parsedOutput.severityLevel || "medium",
        },
        reasoning: parsedOutput.reasoning || "",
      };
    } catch (error) {
      console.error("Error parsing output:", error);

      // Fallback: Try to extract JSON from markdown code blocks
      try {
        const jsonMatch = output.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          const extractedJson = JSON.parse(jsonMatch[1]);

          return {
            result: {
              failurePoint: extractedJson.failurePoint,
              failureReason: extractedJson.failureReason,
              failedActions: extractedJson.failedActions || [],
              errorMessages: extractedJson.errorMessages || [],
              severityLevel: extractedJson.severityLevel || "medium",
            },
            reasoning: extractedJson.reasoning || "",
          };
        }
      } catch (jsonError) {
        console.error("Error extracting JSON from output:", jsonError);
      }

      // Return basic object if all parsing attempts fail
      return {
        result: {
          failureReason: "Failed to parse analysis output.",
          failedActions: [],
          errorMessages: [],
          severityLevel: "medium",
        },
        reasoning: "The analysis output could not be parsed correctly.",
      };
    }
  }

  private formatTraceSummary(trace: ParsedTrace): string {
    return `
Title: ${trace.testTitle || "Unknown Test"}
File: ${trace.testFile || "Unknown File"}
Browser: ${trace.browser.name}${
      trace.browser.version ? ` v${trace.browser.version}` : ""
    }
Duration: ${Math.round(trace.duration.total / 1000)}s
Status: ${trace.testResult.status.toUpperCase()}
${trace.testResult.error ? `Error: ${trace.testResult.error.message}` : ""}
    `.trim();
  }

  private formatActionsSummary(trace: ParsedTrace): string {
    if (trace.actions.length === 0) {
      return "No actions recorded.";
    }

    return trace.actions
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
  }

  private formatErrorsSummary(trace: ParsedTrace): string {
    if (trace.errors.length === 0) {
      return "No errors recorded.";
    }

    return trace.errors
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
  }

  private formatNetworkSummary(trace: ParsedTrace): string {
    if (trace.networkRequests.length === 0) {
      return "No network requests recorded.";
    }

    return trace.networkRequests
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
  }

  private formatConsoleSummary(trace: ParsedTrace): string {
    if (trace.consoleMessages.length === 0) {
      return "No console messages recorded.";
    }

    return trace.consoleMessages
      .map((msg) => {
        const time = new Date(msg.timestamp)
          .toISOString()
          .split("T")[1]
          .split("Z")[0];
        return `[${time}] ${msg.type.toUpperCase()}: ${msg.text}`;
      })
      .join("\n");
  }
}
