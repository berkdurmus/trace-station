import { BaseAgent } from "./base.agent";
import { AgentInput, ContextOutput, ILanguageModelProvider } from "@/agents";
import { ParsedTrace } from "@/trace";
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PlaywrightDocs } from "@/trace/classes/playwright.docs.class";
import { DocumentationChunk } from "@/trace/interfaces";

export class ContextAgent extends BaseAgent<ContextOutput> {
  private outputParser: StructuredOutputParser<any>;
  private verbose: boolean;
  private docsProvider?: PlaywrightDocs;

  constructor(
    apiKey?: string,
    verbose: boolean = false,
    modelProvider?: ILanguageModelProvider,
    docsProvider?: PlaywrightDocs
  ) {
    const systemPrompt = `
You are an expert at providing context for Playwright test issues. Your task is to analyze test failures
and provide relevant documentation, common patterns, and suggestions to help developers understand and fix
the issues they're encountering.

Focus on:
1. Identifying relevant Playwright documentation for the issues
2. Recognizing common patterns or anti-patterns that might be causing the failure
3. Providing general guidance on best practices
4. Referencing specific documentation sections that might help

Your analysis should be helpful, concise, and directly relevant to the test failure.
    `;

    super(systemPrompt, modelProvider, apiKey);
    this.verbose = verbose;
    this.docsProvider = docsProvider;

    // Create parser for structured output
    this.outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        relevantDocumentation: z.array(z.string()),
        commonPatterns: z.array(z.string()).optional(),
        suggestions: z.array(z.string()).optional(),
        documentationReferences: z.array(z.string()).optional(),
        reasoning: z.string().optional(),
      })
    );
  }

  async formatInput(input: AgentInput): Promise<string> {
    const { trace, context } = input;

    // Format trace data for agent input
    const traceSummary = this.formatTraceSummary(trace);
    const errorsSummary = this.formatErrorsSummary(trace);

    // Retrieve relevant documentation if provider exists
    let relevantDocumentation = "";
    if (this.docsProvider) {
      console.log(
        `[ContextAgent] RAG enabled, retrieving relevant documentation...`
      );
      try {
        // Get analysis from context if available
        const analysis = context?.analysis?.result;

        // Retrieve relevant docs
        const docs = await this.docsProvider.retrieveRelevantDocs(
          trace,
          analysis
        );

        if (docs.length > 0) {
          relevantDocumentation = this.formatDocumentationForPrompt(docs);
          console.log(
            `[ContextAgent] Retrieved ${docs.length} relevant documentation items via RAG`
          );
        } else {
          console.log(`[ContextAgent] No relevant documentation found`);
        }
      } catch (error) {
        if (this.verbose) {
          console.error("Error retrieving documentation:", error);
        }
      }
    } else {
      console.log(
        `[ContextAgent] RAG disabled, skipping documentation retrieval`
      );
    }

    const format_instructions = this.outputParser.getFormatInstructions();

    return `
${this.systemPrompt}

Test Information:
${traceSummary}

Errors:
${errorsSummary}

${
  relevantDocumentation
    ? `Relevant Documentation:\n${relevantDocumentation}\n`
    : ""
}

${
  context && Object.keys(context).length > 0
    ? `Additional Context:\n${JSON.stringify(context, null, 2)}\n`
    : ""
}

${format_instructions}

Based on the provided trace information, errors, and documentation, provide relevant documentation references, common patterns, and suggestions.
    `;
  }

  // Helper method to format documentation for the prompt
  private formatDocumentationForPrompt(docs: DocumentationChunk[]): string {
    return docs
      .map((doc, index) => {
        return `
Document ${index + 1}: ${doc.title}
Source: ${doc.documentSource}
---
${doc.content}
      `.trim();
      })
      .join("\n\n");
  }

  async parseOutput(output: string): Promise<ContextOutput> {
    try {
      // First try direct parsing with the StructuredOutputParser
      const parsedOutput = await this.outputParser.parse(output);

      console.log("context:", parsedOutput);

      return {
        result: {
          relevantDocumentation: parsedOutput.relevantDocumentation || [],
          commonPatterns: parsedOutput.commonPatterns || [],
          suggestions: parsedOutput.suggestions || [],
          documentationReferences: parsedOutput.documentationReferences || [],
        },
        reasoning: parsedOutput.reasoning || "",
      };
    } catch (error) {
      if (this.verbose) {
        console.error("Error parsing output:", error);
      }

      // Fallback: Try to extract JSON from markdown code blocks
      try {
        const jsonMatch = output.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          const extractedJson = JSON.parse(jsonMatch[1]);

          return {
            result: {
              relevantDocumentation: extractedJson.relevantDocumentation || [],
              commonPatterns: extractedJson.commonPatterns || [],
              suggestions: extractedJson.suggestions || [],
              documentationReferences:
                extractedJson.documentationReferences || [],
            },
            reasoning: extractedJson.reasoning || "",
          };
        }
      } catch (jsonError) {
        if (this.verbose) {
          console.error("Error extracting JSON from output:", jsonError);
        }
      }

      // Return basic object if all parsing attempts fail
      return {
        result: {
          relevantDocumentation: ["Unable to parse relevant documentation."],
          suggestions: ["The context output could not be parsed correctly."],
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
