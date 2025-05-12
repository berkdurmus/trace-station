import { BaseAgent } from "./base.agent";
import { AgentInput, OrchestratorAgentInterface } from "@/agents";
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { ParsedTrace } from "@/trace";
import { ILanguageModelProvider } from "@/agents";
import { OrchestratorOutput } from "../interfaces";

/**
 * The OrchestratorAgent is responsible for planning and coordinating the execution of tasks
 * by multiple specialized agents. It acts as the "brain" of the system.
 */
export class OrchestratorAgent
  extends BaseAgent<OrchestratorOutput>
  implements OrchestratorAgentInterface
{
  private outputParser: StructuredOutputParser<any>;

  constructor(apiKey?: string, modelProvider?: ILanguageModelProvider) {
    const systemPrompt =
      "You are an expert orchestrator for Playwright test analysis. Your job is to plan and coordinate the analysis of test failures.";
    super(systemPrompt, modelProvider, apiKey);

    // Create parser for structured output
    this.outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        plan: z.array(
          z.object({
            type: z.enum([
              "analysis",
              "context",
              "diagnosis",
              "recommendation",
              "custom",
            ]),
            name: z.string(),
            description: z.string(),
            reason: z.string(),
            dependencies: z.array(z.string()),
            priority: z.enum(["high", "medium", "low"]),
            customAgent: z.string().optional(),
            customInstructions: z.string().optional(),
          })
        ),
        overview: z.string(),
        reasoning: z.string(),
      })
    );
  }

  async formatInput(input: AgentInput): Promise<string> {
    const { trace } = input;

    // Format trace data for orchestrator input
    const traceSummary = this.formatTraceSummary(trace);
    const errorsSummary = this.formatErrorsSummary(trace);
    const networkSummary = this.formatNetworkSummary(trace);

    const format_instructions = this.outputParser.getFormatInstructions();

    return `
${this.systemPrompt}

Test Information:
${traceSummary}

Errors:
${errorsSummary}

Network Requests:
${networkSummary}

Available Agent Types:
1. "analysis" - Identifies failure points, error patterns, and severity
2. "context" - Gathers relevant Playwright documentation and common patterns
3. "diagnosis" - Determines root causes and explains the failure
4. "recommendation" - Suggests fixes and best practices
5. "custom" - Special-purpose analysis (specify details in customAgent and customInstructions)

${format_instructions}

Please analyze this test trace and create a comprehensive orchestration plan.
Explain your approach and reasoning, then provide a structured plan for analyzing this test failure.
    `;
  }

  async parseOutput(output: string): Promise<OrchestratorOutput> {
    try {
      // First try direct parsing with the StructuredOutputParser
      const parsedOutput = await this.outputParser.parse(output);

      return {
        result: {
          plan: parsedOutput.plan,
          overview: parsedOutput.overview,
          reasoning: parsedOutput.reasoning,
        },
      };
    } catch (error) {
      console.error("Error parsing orchestrator output:", error);

      // Fallback: Try to extract JSON from markdown code blocks
      try {
        const jsonMatch = output.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          const extractedJson = JSON.parse(jsonMatch[1]);

          return {
            result: {
              plan: extractedJson.plan || [],
              overview: extractedJson.overview || "Failed to parse overview",
              reasoning: extractedJson.reasoning || "Failed to parse reasoning",
            },
          };
        }
      } catch (jsonError) {
        console.error("Error extracting JSON from output:", jsonError);
      }

      // Return basic object if all parsing attempts fail
      return {
        result: {
          plan: [
            {
              type: "analysis",
              name: "Default analysis",
              description: "Perform basic analysis of the test",
              reason: "Fallback due to parsing error",
              dependencies: [],
              priority: "high",
            },
            {
              type: "diagnosis",
              name: "Default diagnosis",
              description: "Perform basic diagnosis of the test failure",
              reason: "Fallback due to parsing error",
              dependencies: ["Default analysis"],
              priority: "high",
            },
            {
              type: "recommendation",
              name: "Default recommendations",
              description: "Provide basic recommendations",
              reason: "Fallback due to parsing error",
              dependencies: ["Default diagnosis"],
              priority: "medium",
            },
          ],
          overview: "Failed to parse orchestrator output",
          reasoning: "The orchestrator output could not be parsed correctly",
        },
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
Actions Count: ${trace.actions.length}
Network Requests Count: ${trace.networkRequests.length}
Console Messages Count: ${trace.consoleMessages.length}
    `.trim();
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

    // Get statistics rather than listing all requests
    let failedRequests = 0;
    const statusCodes: Record<number, number> = {};

    trace.networkRequests.forEach((req) => {
      if (req.status) {
        statusCodes[req.status] = (statusCodes[req.status] || 0) + 1;
        if (req.status >= 400) {
          failedRequests++;
        }
      }
    });

    return `
Total Requests: ${trace.networkRequests.length}
Failed Requests: ${failedRequests}
Status Code Distribution: ${Object.entries(statusCodes)
      .map(([code, count]) => `${code}: ${count}`)
      .join(", ")}

`;
  }
}
