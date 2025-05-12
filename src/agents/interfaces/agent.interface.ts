import { ILanguageModelProvider } from "@/agents";
import { ParsedTrace } from "@/trace";
import type { BaseAgent } from "../agent/base.agent";

export interface AgentInput {
  trace: ParsedTrace;
  context?: Record<string, any>;
}

export interface AgentOutput {
  result: any;
  reasoning?: string;
}

export interface Agent {
  name: string;
  process(input: AgentInput): Promise<AgentOutput>;
}

export interface TraceAnalysisOutput extends AgentOutput {
  result: {
    failurePoint?: string;
    failureReason?: string;
    failedActions?: string[];
    errorMessages?: string[];
    networkErrors?: string[];
    severityLevel?: "low" | "medium" | "high" | "critical";
  };
}

export interface ContextOutput extends AgentOutput {
  result: {
    relevantDocumentation: string[];
    commonPatterns?: string[];
    suggestions?: string[];
    documentationReferences?: string[];
  };
}

export interface DiagnosisOutput extends AgentOutput {
  result: {
    rootCause?: string;
    explanation?: string;
    confidence?: number;
    relatedIssues?: string[];
  };
}

export interface RecommendationOutput extends AgentOutput {
  result: {
    recommendations: string[];
    codeFixes?: string[];
    bestPractices?: string[];
    priority?: "low" | "medium" | "high";
    userImpact?: {
      severity: "minimal" | "moderate" | "critical";
      description: string;
      affectedFeatures?: string[];
    };
    notes?: string[];
    synthesis?: string;
  };
}

// Interface for the orchestrator agent
export interface OrchestratorAgentInterface {
  /**
   * Process input to generate an orchestration plan
   * @param input Agent input
   */
  process(input: AgentInput): Promise<any>;
}

// Specialized orchestration outputs

export interface OrchestrationOutput extends AgentOutput {
  result: {
    overview: string;
    plan: {
      name: string;
      type: string;
      description: string;
      dependencies: string[];
      customAgent?: string;
      customInstructions?: string;
    }[];
  };
}

export interface SynthesisOutput extends AgentOutput {
  result: {
    summary: string;
    insights: string[];
    overallAssessment: string;
  };
}

/**
 * Interface for an agent factory that creates agent instances
 */
export interface IAgentFactory {
  /**
   * Creates an agent of the specified type
   * @param agentType Type of agent to create
   * @param modelProvider Language model provider for the agent
   * @param options Additional options for agent creation
   * @returns An instance of the requested agent
   */
  createAgent<T extends AgentOutput>(
    agentType: string,
    modelProvider: ILanguageModelProvider,
    options?: Record<string, any>
  ): BaseAgent<T>;

  /**
   * Registers a new agent type with the factory
   * @param agentType Type identifier for the agent
   * @param agentConstructor Constructor function for the agent
   */
  registerAgentType<T extends AgentOutput>(
    agentType: string,
    agentConstructor: new (
      modelProvider: ILanguageModelProvider,
      options?: any
    ) => BaseAgent<T>
  ): void;
}

/**
 * Default agent type identifiers
 */
export enum AgentType {
  ANALYSIS = "analysis",
  CONTEXT = "context",
  DIAGNOSIS = "diagnosis",
  RECOMMENDATION = "recommendation",
  ORCHESTRATOR = "orchestrator",
  CHAT = "chat",
}
