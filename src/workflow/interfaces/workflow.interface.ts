import {
  AgentInput,
  AgentOutput,
  BaseAgent,
  ContextOutput,
  DiagnosisOutput,
  OrchestratorOutput,
  RecommendationOutput,
  TraceAnalysisOutput,
} from "@/agents";
import { ParsedTrace } from "@/trace";

/**
 * Represents a step configuration in a workflow
 */
export interface WorkflowStep<T extends AgentOutput> {
  name: string;
  agent: BaseAgent<T>;
  inputBuilder: (state: WorkflowState) => Promise<AgentInput>;
  outputKey: keyof WorkflowState;
  condition?: (state: WorkflowState) => boolean;
  maxRetries?: number;
  parallel?: boolean;
}

export interface WorkflowState {
  // Input
  trace: ParsedTrace;

  // Agent outputs
  orchestration?: OrchestratorOutput;
  analysis?: TraceAnalysisOutput;
  context?: ContextOutput;
  diagnosis?: DiagnosisOutput;
  recommendation?: RecommendationOutput;

  // Dynamic task outputs
  taskResults?: Record<string, AgentOutput>;

  // Synthesis result
  synthesis?: AgentOutput;

  // Control flow
  currentStep:
    | "orchestration"
    | "analysis"
    | "context"
    | "diagnosis"
    | "recommendation"
    | "executing_tasks"
    | "synthesis"
    | "complete";
  error?: string;
}

// Helper type for workflow results
export interface WorkflowResult {
  analysis?: TraceAnalysisOutput;
  context?: ContextOutput;
  diagnosis?: DiagnosisOutput;
  recommendation?: RecommendationOutput;
  synthesis?: AgentOutput;
  error?: string;
}
