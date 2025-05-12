import { BaseAgent } from "../agent/base.agent";
import { AgentOutput, IAgentFactory, AgentType } from "@/agents";
import { ILanguageModelProvider } from "@/agents";
import { TraceAnalysisAgent } from "../agent/trace.analysis.agent";
import { ContextAgent } from "../agent/context.agent";
import { DiagnosisAgent } from "../agent/diagnosis.agent";
import { RecommendationAgent } from "../agent/recommendation.agent";
import { OrchestratorAgent } from "../agent/orchestrator.agent";
import { ChatAgent } from "../agent/chat.agent";

/**
 * Factory implementation for creating agent instances
 */
export class AgentFactory implements IAgentFactory {
  // Map of agent types to their constructor functions
  private agentConstructors: Map<
    string,
    new (modelProvider: ILanguageModelProvider, options?: any) => BaseAgent<any>
  > = new Map();

  constructor() {
    // Register the standard agent types
    this.registerDefaultAgents();
  }

  /**
   * Register the default agent types
   */
  private registerDefaultAgents(): void {
    // Notes:
    // Since we don't have access to the full implementation of the agent classes,
    // we're making assumptions about their constructors.
    // In a real implementation, you would need to adapt these registrations
    // based on the actual constructor signatures of your agent classes.

    this.registerAgentType(
      AgentType.ANALYSIS,
      class extends TraceAnalysisAgent {
        constructor(modelProvider: ILanguageModelProvider, options?: any) {
          const apiKey = options?.apiKey;
          super(apiKey, modelProvider);
        }
      }
    );

    this.registerAgentType(
      AgentType.CONTEXT,
      class extends ContextAgent {
        constructor(modelProvider: ILanguageModelProvider, options?: any) {
          const apiKey = options?.apiKey;
          const verbose = options?.verbose || false;
          const docsProvider = options?.docsProvider;
          super(apiKey, verbose, modelProvider, docsProvider);
        }
      }
    );

    this.registerAgentType(
      AgentType.DIAGNOSIS,
      class extends DiagnosisAgent {
        constructor(modelProvider: ILanguageModelProvider, options?: any) {
          const apiKey = options?.apiKey;
          super(apiKey, modelProvider);
        }
      }
    );

    this.registerAgentType(
      AgentType.RECOMMENDATION,
      class extends RecommendationAgent {
        constructor(modelProvider: ILanguageModelProvider, options?: any) {
          const apiKey = options?.apiKey;
          super(apiKey, modelProvider);
        }
      }
    );

    this.registerAgentType(
      AgentType.ORCHESTRATOR,
      class extends OrchestratorAgent {
        constructor(modelProvider: ILanguageModelProvider, options?: any) {
          const apiKey = options?.apiKey;
          super(apiKey, modelProvider);
        }
      }
    );

    this.registerAgentType(
      AgentType.CHAT,
      class extends ChatAgent {
        constructor(modelProvider: ILanguageModelProvider, options?: any) {
          const apiKey = options?.apiKey;
          const verbose = options?.verbose || false;
          super(apiKey, modelProvider, verbose);
        }
      }
    );
  }

  /**
   * Create an agent of the specified type
   * @param agentType Type of agent to create
   * @param modelProvider Language model provider
   * @param options Additional options for the agent
   * @returns An instance of the requested agent
   */
  createAgent<T extends AgentOutput>(
    agentType: string,
    modelProvider: ILanguageModelProvider,
    options?: Record<string, any>
  ): BaseAgent<T> {
    const AgentConstructor = this.agentConstructors.get(agentType);

    if (!AgentConstructor) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    return new AgentConstructor(modelProvider, options) as BaseAgent<T>;
  }

  /**
   * Register a new agent type with the factory
   * @param agentType Type identifier for the agent
   * @param agentConstructor Constructor function for the agent
   */
  registerAgentType<T extends AgentOutput>(
    agentType: string,
    agentConstructor: new (
      modelProvider: ILanguageModelProvider,
      options?: any
    ) => BaseAgent<T>
  ): void {
    this.agentConstructors.set(agentType, agentConstructor);
  }
}
