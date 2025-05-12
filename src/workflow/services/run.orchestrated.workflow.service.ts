// Import chalk with proper workaround for CommonJS module

import { WorkflowResult } from "@/workflow";
import { ParsedTrace } from "@/trace";
import { SimpleSpinner } from "@/ui/classes/simple.spinner.class";
import { StageReporter } from "@/ui/classes/stage.reporter.class";
import { createInitialState } from "./state.service";
import { createOrchestratedWorkflow } from "./orchestrated.graph.workflow";

// @ts-ignore
const chalk = require("chalk");

/**
 * Runs the orchestrated workflow which uses the OrchestratorAgent
 */
export async function runOrchestratedWorkflow(
  trace: ParsedTrace,
  apiKey?: string,
  verbose: boolean = false,
  useJsonOutput: boolean = false,
  options: {
    enableRetries?: boolean;
    parallelDiagnosis?: boolean;
    conditionalDiagnosis?: boolean;
    disableRag?: boolean;
  } = {}
): Promise<WorkflowResult> {
  const spinner = useJsonOutput
    ? new SimpleSpinner("Running orchestrated workflow...").start()
    : null;

  const reporter = useJsonOutput ? null : new StageReporter();
  if (!useJsonOutput && reporter)
    reporter.reportStage(
      "orchestration",
      "Initializing orchestrated workflow...",
      chalk.blue
    );

  try {
    // Create initial state with trace data
    const initialState = createInitialState(trace);

    // Create workflow function with configuration
    const workflowFn = createOrchestratedWorkflow(apiKey, verbose, options);

    // Execute the workflow
    if (!useJsonOutput && reporter)
      reporter.reportStage(
        "analyze",
        "Running orchestrated analysis with AI agents...",
        chalk.magenta
      );
    const result = await workflowFn(initialState);

    if (result.error) {
      if (spinner) spinner.fail(`Workflow failed: ${result.error}`);
      else if (reporter)
        reporter.reportStage(
          "error",
          `Workflow failed: ${result.error}`,
          chalk.red
        );
      return { error: result.error };
    }

    if (spinner)
      spinner.succeed("Orchestrated workflow completed successfully");
    else if (reporter)
      reporter.reportStage(
        "complete",
        "Orchestrated workflow completed successfully",
        chalk.green
      );

    // Return results
    return {
      analysis: result.analysis,
      context: result.context,
      diagnosis: result.diagnosis,
      recommendation: result.recommendation,
      synthesis: result.synthesis,
    };
  } catch (error) {
    if (spinner) spinner.fail(`Workflow failed: ${error}`);
    else if (reporter)
      reporter.reportStage("error", `Workflow failed: ${error}`, chalk.red);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
