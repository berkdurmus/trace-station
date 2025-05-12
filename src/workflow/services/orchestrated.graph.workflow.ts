/**
 * This is the new implementation of the orchestrated workflow using the AI orchestrator-workers pattern.
 * It replaces the older approach with a more dynamic and flexible orchestration model based on Claude's design patterns.
 */

import { WorkflowState } from "../interfaces";
import {
  AgentInput,
  AgentOutput,
  AgentType,
  BaseAgent,
  AgentFactory,
  OrchestrationTask,
  OrchestratorAgent,
  OrchestratorOutput,
} from "@/agents";
import { ModelProviderFactory } from "@/agents";
import { PlaywrightDocs } from "@/trace/classes/playwright.docs.class";

/**
 * Creates a dynamic orchestrated workflow that follows the orchestrator-workers pattern
 * @param apiKey API key for agent services
 * @param verbose Whether to show detailed documentation processing logs
 * @returns A callable workflow function
 */
export function createOrchestratedWorkflow(
  apiKey?: string,
  verbose: boolean = false,
  options: {
    enableRetries?: boolean;
    customAgents?: Record<string, BaseAgent<any>>;
    modelProviderType?: string;
    onProgress?: (stage: string, message: string) => void;
    parallelDiagnosis?: boolean;
    conditionalDiagnosis?: boolean;
    disableRag?: boolean;
  } = {}
) {
  // Create model provider
  const modelProvider = ModelProviderFactory.createProvider(
    options.modelProviderType || "anthropic",
    apiKey
  );

  // Create PlaywrightDocs instance for RAG if not disabled
  const playwrightDocs = options.disableRag
    ? undefined
    : new PlaywrightDocs(process.env.OPENAI_API_KEY, verbose);

  // Log RAG status
  console.log(
    `[OrchestratedWorkflow] RAG is ${
      options.disableRag ? "disabled" : "enabled"
    }`
  );

  // Progress reporting function
  const reportProgress = (stage: string, message: string) => {
    if (options.onProgress) {
      options.onProgress(stage, message);
    } else {
      console.log(`${stage}: ${message}`);
    }
  };

  // Create the agent factory
  const agentFactory = new AgentFactory();

  // Create the orchestrator agent (brain)
  // We need to cast to OrchestratorAgent to access specialized methods
  const orchestratorAgent = agentFactory.createAgent(
    AgentType.ORCHESTRATOR,
    modelProvider,
    { apiKey }
  ) as OrchestratorAgent;

  // Create standard worker agents
  const workerAgents: Record<string, BaseAgent<any>> = {
    analysis: agentFactory.createAgent(AgentType.ANALYSIS, modelProvider, {
      apiKey,
    }),
    context: agentFactory.createAgent(AgentType.CONTEXT, modelProvider, {
      apiKey,
      verbose,
      docsProvider: playwrightDocs,
    }),
    diagnosis: agentFactory.createAgent(AgentType.DIAGNOSIS, modelProvider, {
      apiKey,
    }),
    recommendation: agentFactory.createAgent(
      AgentType.RECOMMENDATION,
      modelProvider,
      { apiKey }
    ),
    // Add custom agents if provided
    ...options.customAgents,
  };

  // Maximum retries for agent calls
  const maxRetries = options.enableRetries ? 3 : 0;

  // Return a workflow function that processes trace data using the dynamic orchestrator
  return async function processTrace(
    initialState: WorkflowState
  ): Promise<WorkflowState> {
    reportProgress("orchestration", "Running dynamic orchestrated workflow");

    const state: WorkflowState = { ...initialState };

    try {
      // Initialize documentation if RAG is enabled
      if (playwrightDocs) {
        reportProgress(
          "docs",
          "Initializing documentation for RAG-enhanced context retrieval"
        );
        await playwrightDocs.initialize();
      } else {
        reportProgress(
          "docs",
          "RAG is disabled. Analysis will run without documentation context."
        );
      }

      // Step 1: Planning - Use the orchestrator to create a plan
      reportProgress("orchestration", "Creating orchestration plan");
      state.currentStep = "orchestration";

      try {
        // First run the orchestrator to create the plan
        // We need to ensure we use OrchestratorOutput type
        state.orchestration = (await orchestratorAgent.process({
          trace: state.trace,
        })) as OrchestratorOutput;

        // Add null checks to prevent TypeScript errors
        if (state.orchestration && state.orchestration.result) {
          reportProgress(
            "orchestration",
            `Plan created with ${state.orchestration.result.plan.length} tasks: ${state.orchestration.result.overview}`
          );
        }
      } catch (error) {
        reportProgress("error", "Error creating orchestration plan");
        console.error("Error creating orchestration plan:", error);
        throw new Error("Failed to create orchestration plan");
      }

      // Step 2: Task Execution - Execute tasks according to their dependencies
      reportProgress("orchestration", "Executing tasks according to plan");
      state.currentStep = "executing_tasks";

      // Create a map of tasks by name for easy access
      const taskMap = new Map<string, OrchestrationTask>();

      // Add null check before accessing plan
      if (
        state.orchestration &&
        state.orchestration.result &&
        state.orchestration.result.plan
      ) {
        for (const task of state.orchestration.result.plan) {
          taskMap.set(task.name, task);
        }
      }

      // Create a set of completed tasks
      const completedTasks = new Set<string>();

      // Execute tasks in dependency order using topological sort approach
      while (completedTasks.size < taskMap.size) {
        let madeProgress = false;

        for (const [taskName, task] of taskMap.entries()) {
          // Skip tasks that are already completed
          if (completedTasks.has(taskName)) {
            continue;
          }

          // Check if all dependencies are met
          const dependenciesMet = task.dependencies.every((dep) =>
            completedTasks.has(dep)
          );

          if (dependenciesMet) {
            reportProgress(
              task.type,
              `Executing task: ${taskName} (${task.type})`
            );

            // Get the appropriate agent for this task
            let agent: BaseAgent<any>;

            if (task.type === "custom" && task.customAgent) {
              // Use a custom agent if specified
              agent = workerAgents[task.customAgent] || workerAgents.analysis;
            } else {
              // Use a standard agent based on task type
              agent = workerAgents[task.type] || workerAgents.analysis;
            }

            if (!agent) {
              reportProgress(
                "warning",
                `No agent found for task type: ${task.type}, using analysis agent as fallback`
              );
              agent = workerAgents.analysis;
            }

            // Create input with current state context
            const input: AgentInput = {
              trace: state.trace,
              context: {
                task: task,
                taskResults: state.taskResults,
                orchestration: state.orchestration,
                // Include custom instructions if any
                instructions: task.customInstructions,
              },
            };

            // Execute the task with retry logic
            let retries = 0;
            let success = false;
            let result: AgentOutput | null = null;

            while (!success && retries <= maxRetries) {
              try {
                if (retries > 0) {
                  reportProgress(
                    task.type,
                    `Retry attempt ${retries} for task: ${taskName}`
                  );
                }

                // Process the task
                result = await agent.process(input);
                success = true;
              } catch (error) {
                console.error(`Error executing task ${taskName}:`, error);
                retries++;

                // Wait before retry (exponential backoff)
                if (retries <= maxRetries) {
                  const backoff = Math.min(
                    1000 * Math.pow(2, retries - 1),
                    10000
                  );
                  await new Promise((resolve) => setTimeout(resolve, backoff));
                }
              }
            }

            // Store the task result
            if (success && result) {
              // Store in task results
              if (!state.taskResults) {
                state.taskResults = {};
              }
              state.taskResults[taskName] = result;

              // Also store in appropriate state field if it matches a standard type
              if (task.type === "analysis") {
                state.analysis = result;
                reportProgress(
                  "analysis",
                  `Analysis completed: ${
                    result.result.failureReason || "No failure detected"
                  }`
                );
              } else if (task.type === "context") {
                state.context = result;
                const docCount =
                  result.result.relevantDocumentation?.length || 0;
                reportProgress(
                  "docs",
                  `Found ${docCount} relevant documentation items`
                );
              } else if (task.type === "diagnosis") {
                state.diagnosis = result;
                reportProgress(
                  "diagnosis",
                  `Diagnosis: ${result.result.rootCause || "Unknown cause"}`
                );
              } else if (task.type === "recommendation") {
                state.recommendation = result;
                const recCount = result.result.recommendations?.length || 0;
                reportProgress(
                  "recommendation",
                  `Generated ${recCount} recommendations`
                );
              } else {
                reportProgress(task.type, `Completed task: ${taskName}`);
              }

              // Mark task as completed
              completedTasks.add(taskName);
              madeProgress = true;
            } else {
              reportProgress(
                "error",
                `Failed to execute task: ${taskName} after ${retries} retries`
              );
              throw new Error(
                `Failed to execute task: ${taskName} after ${retries} retries`
              );
            }
          }
        }

        // If we didn't make progress in this iteration, we might have a dependency cycle
        if (!madeProgress && completedTasks.size < taskMap.size) {
          const remainingTasks = Array.from(taskMap.keys()).filter(
            (task) => !completedTasks.has(task)
          );
          reportProgress(
            "error",
            `Possible dependency cycle detected in tasks: ${remainingTasks.join(
              ", "
            )}`
          );
          throw new Error(
            `Possible dependency cycle detected in tasks: ${remainingTasks.join(
              ", "
            )}`
          );
        }
      }

      // Step 3: Synthesis - Combine results into a coherent understanding
      reportProgress("synthesis", "Synthesizing results from all agents");
      state.currentStep = "synthesis";

      try {
        // Check if we have enough results to synthesize
        const hasResults =
          state.analysis || state.diagnosis || state.recommendation;

        if (hasResults) {
          // We'll use the orchestrator for synthesis
          const synthesisInput: AgentInput = {
            trace: state.trace,
            context: {
              task: {
                name: "synthesize_results",
                type: "synthesis",
                description:
                  "Synthesize all analysis results into a coherent explanation",
                dependencies: [],
              },
              taskResults: state.taskResults,
              orchestration: state.orchestration,
            },
          };

          // Call the orchestrator to process synthesis
          // Use the regular process method instead of a non-existent synthesize method
          state.synthesis = await orchestratorAgent.process(synthesisInput);
          reportProgress("synthesis", "Final analysis synthesis completed");
        } else {
          reportProgress(
            "warning",
            "Not enough results available for synthesis"
          );
        }
      } catch (error) {
        reportProgress("error", "Error during synthesis");
        console.error("Error during synthesis:", error);
      }

      // Mark workflow as complete
      state.currentStep = "complete";
      reportProgress("complete", "Dynamic workflow complete");

      return state;
    } catch (error: unknown) {
      console.error("Error in workflow:", error);
      state.error = error instanceof Error ? error.message : String(error);
      return state;
    }
  };
}
