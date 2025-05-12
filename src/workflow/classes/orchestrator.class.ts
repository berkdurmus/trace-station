import { AgentOutput } from "@/agents";
import { WorkflowState } from "../interfaces";
import { WorkflowStep } from "../interfaces";

/**
 * Workflow Orchestrator that provides flexible execution of agent workflows
 */
export class WorkflowOrchestrator {
  private steps: WorkflowStep<any>[] = [];

  /**
   * Add a step to the workflow
   * @param step Step configuration
   */
  addStep<T extends AgentOutput>(step: WorkflowStep<T>): WorkflowOrchestrator {
    this.steps.push(step);
    return this;
  }

  /**
   * Execute the workflow with initial state
   * @param initialState Initial workflow state
   * @returns Final workflow state after all steps
   */
  async execute(initialState: WorkflowState): Promise<WorkflowState> {
    const state: WorkflowState = { ...initialState };

    try {
      // Execute each step sequentially
      for (const step of this.steps) {
        // Skip step if condition is defined and returns false
        if (step.condition && !step.condition(state)) {
          console.log(`Skipping step: ${step.name} (condition not met)`);
          continue;
        }

        console.log(`Executing step: ${step.name}`);

        // Update current step
        state.currentStep = step.name as any;

        // Build input for this step based on current state
        const input = await step.inputBuilder(state);

        // Execute with retry logic
        let retries = 0;
        let success = false;
        let error: unknown;

        while (!success && retries <= (step.maxRetries || 0)) {
          try {
            if (retries > 0) {
              console.log(`Retry attempt ${retries} for step: ${step.name}`);
            }

            // Execute the agent process
            const result = await step.agent.process(input);

            // Update state with the result
            state[step.outputKey] = result;

            success = true;
          } catch (err) {
            error = err;
            retries++;

            // Wait before retry (simple exponential backoff)
            if (retries <= (step.maxRetries || 0)) {
              const backoff = Math.min(1000 * Math.pow(2, retries - 1), 10000);
              await new Promise((resolve) => setTimeout(resolve, backoff));
            }
          }
        }

        // If all retries failed, throw the last error
        if (!success) {
          console.error(`Step ${step.name} failed after ${retries} attempts`);
          throw error;
        }
      }

      // Mark workflow as complete
      state.currentStep = "complete";

      return state;
    } catch (error: unknown) {
      console.error("Error in workflow:", error);
      state.error = error instanceof Error ? error.message : String(error);
      return state;
    }
  }

  /**
   * Execute steps in parallel when possible
   * Not implemented in basic version but could be extended
   */
  async executeParallel(initialState: WorkflowState): Promise<WorkflowState> {
    // For now, just calls the sequential executor
    // This could be enhanced to run parallel steps simultaneously
    return this.execute(initialState);
  }
}
