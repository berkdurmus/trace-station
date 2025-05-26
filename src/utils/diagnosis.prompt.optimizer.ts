import { AgentInput } from "@/agents";
import { PromptOptimizer } from "./prompt.optimizer";
import { compressText } from "./prompt.utils";

/**
 * Specialized prompt optimizer for diagnosis agent
 */
export class DiagnosisPromptOptimizer extends PromptOptimizer {
  /**
   * Generate an optimized prompt for the diagnosis agent
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
    const networkSummary = this.formatNetworkSummary(trace);
    const consoleSummary = this.formatConsoleSummary(trace);

    // Include any previous analysis from other agents if available
    let previousAnalysis = "";
    if (context?.analysisResult) {
      previousAnalysis = compressText(`Previous Analysis:
${JSON.stringify(context.analysisResult, null, 2)}`);
    }

    // Include relevant documentation from the context agent if available
    let relevantDocumentation = "";
    if (
      context?.context?.result?.relevantDocumentation &&
      context.context.result.relevantDocumentation.length > 0
    ) {
      // Limit to 3 most relevant documentation items
      const docs = context.context.result.relevantDocumentation.slice(0, 3);
      relevantDocumentation = compressText(`Relevant Documentation:
${docs.map((doc: string, i: number) => `${i + 1}. ${doc}`).join("\n")}`);
    }

    // Optimize the system prompt
    const optimizedSystemPrompt = this.optimizeSystemPrompt(systemPrompt);

    // Organize sections for optimization
    const sections: Record<string, string> = {
      "Test Information": traceSummary,
      "Actions Timeline": actionsSummary,
      Errors: errorsSummary,
      "Network Requests": networkSummary,
      "Console Messages": consoleSummary,
      "Previous Analysis": previousAnalysis,
      "Relevant Documentation": relevantDocumentation,
    };

    // Build the optimized prompt
    return `${optimizedSystemPrompt}

${this.optimizeSections(sections)}

${formatInstructions}

Analyze the test failure details above and provide a detailed diagnosis of the root cause.`;
  }
}
