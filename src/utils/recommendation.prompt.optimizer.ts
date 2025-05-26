import { AgentInput } from "@/agents";
import { PromptOptimizer } from "./prompt.optimizer";
import { compressText } from "./prompt.utils";

/**
 * Specialized prompt optimizer for recommendation agent
 */
export class RecommendationPromptOptimizer extends PromptOptimizer {
  /**
   * Generate an optimized prompt for the recommendation agent
   * @param input The agent input
   * @param systemPrompt The system prompt
   * @param formatInstructions Format instructions for output
   * @returns Optimized prompt
   */
  generatePrompt(
    input: AgentInput,
    systemPrompt: string,
    formatInstructions: string
  ): string {
    const { trace, context } = input;

    // Format trace data with optimizations
    const traceSummary = this.formatTraceSummary(trace);
    const actionsSummary = this.formatActionsSummary(trace);
    const errorsSummary = this.formatErrorsSummary(trace);

    // Include context data if available
    let previousAnalysis = "";
    let diagnosisData = "";
    let relevantDocumentation = "";
    let contextData = "";

    // Analysis from other agents
    if (context?.analysisResult) {
      previousAnalysis = compressText(`Analysis Results:
${JSON.stringify(context.analysisResult, null, 2)}`);
    }

    // Diagnosis results
    if (context?.diagnosisResult) {
      // Diagnosis is highly relevant, so we keep it with less compression
      diagnosisData = compressText(`Diagnosis Results:
${JSON.stringify(context.diagnosisResult, null, 2)}`);
    }

    // Include relevant documentation
    if (
      context?.context?.result?.relevantDocumentation &&
      context.context.result.relevantDocumentation.length > 0
    ) {
      // Limit to 3 most relevant documentation items
      const docs = context.context.result.relevantDocumentation.slice(0, 3);
      relevantDocumentation = compressText(`Relevant Documentation:
${docs.map((doc: string, i: number) => `${i + 1}. ${doc}`).join("\n")}`);
    }

    // Include context agent's common patterns and suggestions
    if (context?.context?.result) {
      const contextResult = context.context.result;

      // Common patterns
      if (
        contextResult.commonPatterns &&
        contextResult.commonPatterns.length > 0
      ) {
        // Limit to most relevant patterns
        const patterns = contextResult.commonPatterns.slice(0, 3);
        contextData += compressText(`Common Patterns Identified:
${patterns
  .map((pattern: string, i: number) => `${i + 1}. ${pattern}`)
  .join("\n")}`);
      }

      // Suggestions from context analysis
      if (contextResult.suggestions && contextResult.suggestions.length > 0) {
        // Limit to most relevant suggestions
        const suggestions = contextResult.suggestions.slice(0, 3);
        contextData += compressText(`\nSuggestions from Context Analysis:
${suggestions
  .map((suggestion: string, i: number) => `${i + 1}. ${suggestion}`)
  .join("\n")}`);
      }
    }

    // Optimize the system prompt
    const optimizedSystemPrompt = this.optimizeSystemPrompt(systemPrompt);

    // Organize sections for optimization
    const sections: Record<string, string> = {
      "Test Information": traceSummary,
      "Actions Timeline": actionsSummary,
      Errors: errorsSummary,
      "Diagnosis Results": diagnosisData,
      "Analysis Results": previousAnalysis,
      "Relevant Documentation": relevantDocumentation,
      "Context Analysis": contextData,
    };

    // Build the optimized prompt
    return `${optimizedSystemPrompt}

${this.optimizeSections(sections)}

${formatInstructions}

Based on the provided information, recommend specific solutions to fix this test failure.`;
  }
}
