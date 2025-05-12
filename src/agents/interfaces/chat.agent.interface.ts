import { AgentOutput } from "@/agents";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse extends AgentOutput {
  result: {
    message: string;
    followupQuestions?: string[];
    relevantDocs?: string[];
  };
}
