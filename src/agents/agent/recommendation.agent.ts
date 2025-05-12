import { BaseAgent } from "./base.agent";
import { AgentInput, RecommendationOutput } from "@/agents";
import { ParsedTrace } from "@/trace";
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { ILanguageModelProvider } from "@/agents";

export class RecommendationAgent extends BaseAgent<RecommendationOutput> {
  private outputParser: StructuredOutputParser<any>;

  constructor(apiKey?: string, modelProvider?: ILanguageModelProvider) {
    const systemPrompt = `
You are an expert at recommending fixes for Playwright test failures. Your task is to provide actionable
recommendations that help developers fix their failing tests quickly and effectively.

Focus on:
1. Providing clear, specific recommendations to fix the issues
2. Suggesting code fixes or examples when appropriate
3. Highlighting best practices to prevent similar issues
4. Prioritizing recommendations based on impact
5. Describing the potential user impact of the issues

Your recommendations should be practical, technically sound, and easy to implement.
    `;

    super(systemPrompt, modelProvider, apiKey);

    // Create parser for structured output
    this.outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        recommendations: z.array(z.string()),
        codeFixes: z.array(z.string()).optional(),
        bestPractices: z.array(z.string()).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        userImpact: z
          .object({
            severity: z.enum(["minimal", "moderate", "critical"]),
            description: z.string(),
            affectedFeatures: z.array(z.string()).optional(),
          })
          .optional(),
        notes: z.array(z.string()).optional(),
        synthesis: z.string().optional(),
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

    // Include context data if available
    let previousAnalysis = "";
    let diagnosisData = "";
    let relevantDocumentation = "";
    let contextData = "";

    if (context?.analysisResult) {
      previousAnalysis = `
Analysis Results:
${JSON.stringify(context.analysisResult, null, 2)}
      `;
    }

    if (context?.diagnosisResult) {
      diagnosisData = `
Diagnosis Results:
${JSON.stringify(context.diagnosisResult, null, 2)}
      `;
    }

    // Include relevant documentation from context if available
    if (
      context?.context?.result?.relevantDocumentation &&
      context.context.result.relevantDocumentation.length > 0
    ) {
      relevantDocumentation = `
Relevant Documentation:
${context.context.result.relevantDocumentation
  .map((doc: string, i: number) => `${i + 1}. ${doc}`)
  .join("\n")}
      `;
    }

    // Include context agent's common patterns and suggestions
    if (context?.context?.result) {
      const contextResult = context.context.result;
      if (
        contextResult.commonPatterns &&
        contextResult.commonPatterns.length > 0
      ) {
        contextData += `
Common Patterns Identified:
${contextResult.commonPatterns
  .map((pattern: string, i: number) => `${i + 1}. ${pattern}`)
  .join("\n")}
        `;
      }

      if (contextResult.suggestions && contextResult.suggestions.length > 0) {
        contextData += `
Suggestions from Context Analysis:
${contextResult.suggestions
  .map((suggestion: string, i: number) => `${i + 1}. ${suggestion}`)
  .join("\n")}
        `;
      }
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

${previousAnalysis}
${diagnosisData}
${relevantDocumentation}
${contextData}

${format_instructions}

Based on the provided trace information, previous analysis, and documentation, provide detailed recommendations to fix this test failure.
    `;
  }

  async parseOutput(output: string): Promise<RecommendationOutput> {
    try {
      // First try direct parsing with the StructuredOutputParser
      const parsedOutput = await this.outputParser.parse(output);

      return {
        result: {
          recommendations: parsedOutput.recommendations,
          codeFixes: parsedOutput.codeFixes || [],
          bestPractices: parsedOutput.bestPractices || [],
          priority: parsedOutput.priority || "medium",
          userImpact: parsedOutput.userImpact || {
            severity: "moderate",
            description:
              "May affect user experience but no critical functionality",
          },
          notes: parsedOutput.notes || [],
          synthesis: parsedOutput.synthesis || "",
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
              recommendations: extractedJson.recommendations || [
                "No specific recommendations could be parsed.",
              ],
              codeFixes: extractedJson.codeFixes || [],
              bestPractices: extractedJson.bestPractices || [],
              priority: extractedJson.priority || "medium",
              userImpact: extractedJson.userImpact || {
                severity: "moderate",
                description: "Impact could not be determined",
              },
              notes: extractedJson.notes || [],
              synthesis: extractedJson.synthesis || "",
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
          recommendations: [
            "The recommendation output could not be parsed correctly.",
          ],
          codeFixes: [],
          bestPractices: [],
          priority: "medium",
          userImpact: {
            severity: "minimal",
            description: "Unable to determine impact",
          },
        },
        reasoning: "The recommendation output could not be parsed correctly.",
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
}
