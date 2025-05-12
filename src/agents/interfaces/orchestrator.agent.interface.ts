import { AgentOutput } from "@/agents";

/**
 * Represents a task in the orchestration plan
 */
export interface OrchestrationTask {
  name: string;
  type: string;
  description: string;
  dependencies: string[];
  reason?: string;
  priority?: string;
  customAgent?: string;
  customInstructions?: string;
}

/**
 * Output from the orchestrator agent
 */
export interface OrchestratorOutput extends AgentOutput {
  result: {
    plan: OrchestrationTask[];
    overview: string;
    reasoning: string;
  };
}
