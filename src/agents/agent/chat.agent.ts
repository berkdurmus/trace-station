import { BaseAgent } from "./base.agent";
import { AgentInput, ILanguageModelProvider } from "@/agents";
import { ParsedTrace } from "@/trace";
import { ChatMessage, ChatResponse } from "../interfaces/chat.agent.interface";
export class ChatAgent extends BaseAgent<ChatResponse> {
  private conversationHistory: ChatMessage[] = [];
  private verbose: boolean;

  constructor(
    apiKey?: string,
    modelProvider?: ILanguageModelProvider,
    verbose: boolean = false
  ) {
    const systemPrompt = `
You are an expert Playwright testing assistant. You help developers understand and fix their Playwright 
test failures by providing clear, concise, and helpful responses to their questions.

When answering questions:
1. Be specific and technical when explaining Playwright concepts
2. Provide code examples when relevant
3. Reference official documentation when appropriate
4. Suggest best practices for test stability
5. Help troubleshoot common testing issues

Your goal is to provide the most helpful and accurate information to assist the developer in resolving 
their Playwright test issues.
    `;

    super(systemPrompt, modelProvider, apiKey);
    this.verbose = verbose;

    // Initialize conversation with system message
    this.conversationHistory.push({
      role: "system",
      content: systemPrompt,
    });
  }

  async chat(userMessage: string, workflowState: any): Promise<ChatResponse> {
    // Add user message to history
    this.addMessage("user", userMessage);

    // Process with current history and workflow state
    const response = await this.process({
      trace: workflowState.trace,
      context: {
        workflowState,
        userQuery: userMessage,
        analysisResult: workflowState?.analysis?.result,
        diagnosisResult: workflowState?.diagnosis?.result,
        recommendationResult: workflowState?.recommendation?.result,
      },
    });

    return response;
  }

  async formatInput(input: AgentInput): Promise<string> {
    const { trace, context } = input;

    // Get user query from context
    const userQuery = context?.userQuery || "Tell me about this test failure";

    // Format trace data for agent input
    let traceContext = "";
    if (trace) {
      const traceSummary = this.formatTraceSummary(trace);
      const errorsSummary = this.formatErrorsSummary(trace);

      traceContext = `
Test Information:
${traceSummary}

Errors:
${errorsSummary}
      `;
    }

    // Include any additional context that might be available
    let additionalContext = "";
    if (context?.analysisResult) {
      additionalContext += `
Analysis Results:
${JSON.stringify(context.analysisResult, null, 2)}
      `;
    }

    if (context?.diagnosisResult) {
      additionalContext += `
Diagnosis Results:
${JSON.stringify(context.diagnosisResult, null, 2)}
      `;
    }

    if (context?.recommendationResult) {
      additionalContext += `
Recommendation Results:
${JSON.stringify(context.recommendationResult, null, 2)}
      `;
    }

    // Format the full conversation history for the prompt
    const conversationFormatted = this.conversationHistory
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");

    return `
${this.systemPrompt}

${traceContext}
${additionalContext}

CONVERSATION HISTORY:
${conversationFormatted}

Based on the provided information and conversation history, please respond to the user's most recent message.
Also, suggest 2-3 follow-up questions that might help the user further if they're still having issues.
Format your response as follows:

RESPONSE:
Your detailed response here...

FOLLOW-UP QUESTIONS:
1. First follow-up question
2. Second follow-up question
3. Third follow-up question (optional)
    `;
  }

  async parseOutput(output: string): Promise<ChatResponse> {
    try {
      // Extract response and follow-up questions from the output
      const responseMatch = output.match(
        /RESPONSE:([\s\S]*?)(?=FOLLOW-UP QUESTIONS:|$)/i
      );
      const followupMatch = output.match(/FOLLOW-UP QUESTIONS:([\s\S]*?)$/i);

      const responseText = responseMatch
        ? responseMatch[1].trim()
        : output.trim();

      // Add assistant response to conversation history
      this.addMessage("assistant", responseText);

      // Parse follow-up questions if they exist
      let followupQuestions: string[] = [];
      if (followupMatch && followupMatch[1]) {
        // Extract numbered questions using regex
        const questionMatches = followupMatch[1].match(
          /\d+\.\s*(.*?)(?=\d+\.|$)/gs
        );
        if (questionMatches) {
          followupQuestions = questionMatches
            .map((q) => q.replace(/^\d+\.\s*/, "").trim())
            .filter((q) => q.length > 0);
        }
      }

      return {
        result: {
          message: responseText,
          followupQuestions: followupQuestions,
        },
      };
    } catch (error) {
      if (this.verbose) {
        console.error("Error parsing chat output:", error);
      }

      // Add generic response to conversation history
      const genericResponse =
        "I'm having trouble understanding, could you clarify or rephrase your question?";
      this.addMessage("assistant", genericResponse);

      // Return basic response
      return {
        result: {
          message: genericResponse,
          followupQuestions: [
            "Could you provide more details about the issue you're experiencing?",
            "What steps have you already tried to resolve this?",
          ],
        },
      };
    }
  }

  // Add a message to the conversation history
  addMessage(role: "user" | "assistant" | "system", content: string): void {
    this.conversationHistory.push({ role, content });
  }

  // Clear the conversation history
  clearHistory(): void {
    // Keep the system message
    const systemMessage = this.conversationHistory.find(
      (msg) => msg.role === "system"
    );
    this.conversationHistory = systemMessage ? [systemMessage] : [];
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
