import { BaseAgent } from "./base.agent";
import { AgentInput, DiagnosisOutput, ILanguageModelProvider } from "@/agents";
import { ParsedTrace } from "@/trace";
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";

export class DiagnosisAgent extends BaseAgent<DiagnosisOutput> {
  private outputParser: StructuredOutputParser<any>;

  constructor(
    apiKey?: string,
    modelProvider?: ILanguageModelProvider,
    cacheOptions?: {
      enableCache?: boolean;
      cacheTTL?: number;
    }
  ) {
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

    super(systemPrompt, modelProvider, apiKey, cacheOptions);

    // Create parser for structured output
    this.outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        rootCause: z.string(),
        explanation: z.string(),
        confidence: z.number().min(0).max(1),
        relatedIssues: z.array(z.string()).optional(),
        reasoning: z.string().optional(),
      })
    );
  }

  async formatInput(input: AgentInput): Promise<string> {
    const { trace, context } = input;

    // Format trace data for agent input
    const traceSummary = this.formatTraceSummary(trace);
    const actionsSummary = this.formatActionsSummary(trace);
    const errorsSummary = this.formatErrorsSummary(trace);
    const networkSummary = this.formatNetworkSummary(trace);
    const consoleSummary = this.formatConsoleSummary(trace);

    // Include any previous analysis from other agents if available
    let previousAnalysis = "";
    if (context?.analysisResult) {
      previousAnalysis = `
Previous Analysis:
${JSON.stringify(context.analysisResult, null, 2)}
      `;
    }

    // Include relevant documentation from the context agent if available
    let relevantDocumentation = "";
    if (
      context?.context?.result?.relevantDocumentation &&
      context.context.result.relevantDocumentation.length > 0
    ) {
      relevantDocumentation = `
Relevant Documentation from Context:
${context.context.result.relevantDocumentation
  .map((doc: string, i: number) => `${i + 1}. ${doc}`)
  .join("\n")}
      `;
    }

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

${previousAnalysis}

${relevantDocumentation}

${format_instructions}

Based on the provided trace information and any relevant documentation, provide a detailed diagnosis of the root cause of this test failure.
    `;
  }

  async parseOutput(output: string): Promise<DiagnosisOutput> {
    try {
      // First try direct parsing with the StructuredOutputParser
      const parsedOutput = await this.outputParser.parse(output);

      return {
        result: {
          rootCause: parsedOutput.rootCause,
          explanation: parsedOutput.explanation,
          confidence: parsedOutput.confidence,
          relatedIssues: parsedOutput.relatedIssues || [],
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
              rootCause: extractedJson.rootCause || "Unknown root cause",
              explanation:
                extractedJson.explanation || "No explanation provided",
              confidence: extractedJson.confidence || 0.5,
              relatedIssues: extractedJson.relatedIssues || [],
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
          rootCause: "Unable to determine root cause",
          explanation: "Failed to parse diagnosis output.",
          confidence: 0.1,
          relatedIssues: [],
        },
        reasoning: "The diagnosis output could not be parsed correctly.",
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
