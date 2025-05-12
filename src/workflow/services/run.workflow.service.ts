import { WorkflowResult } from "@/workflow";
import { ParsedTrace } from "@/trace";
import { SimpleSpinner } from "@/ui/classes/simple.spinner.class";
import { StageReporter } from "@/ui/classes/stage.reporter.class";
import { createWorkflow } from "./graph.workflow";
import { createInitialState } from "./state.service";
import {
  displayAnalysis,
  displayContext,
  displayDiagnosis,
  displayRecommendations,
} from "@/cli";

// Import chalk with proper workaround for CommonJS module
// @ts-ignore
const chalk = require("chalk");

export async function runFullWorkflow(
  trace: ParsedTrace,
  apiKey?: string,
  verbose: boolean = false,
  useJsonOutput: boolean = false,
  existingReporter?: StageReporter
): Promise<WorkflowResult> {
  const spinner = useJsonOutput
    ? new SimpleSpinner("Running full debug workflow...").start()
    : null;

  const reporter =
    existingReporter || (useJsonOutput ? null : new StageReporter());

  try {
    // Create workflow with verbosity setting
    if (!useJsonOutput)
      reporter!.reportStage("analyze", "Creating workflow...", chalk.blue);
    else if (spinner) spinner.text = "Creating workflow...";

    const workflow = createWorkflow(apiKey, verbose);

    // Initialize state and run workflow
    if (!useJsonOutput)
      reporter!.reportStage(
        "analyze",
        "Running analysis with agents...",
        chalk.magenta
      );
    else if (spinner) spinner.text = "Running analysis...";

    const initialState = createInitialState(trace);
    const result: WorkflowResult = await workflow(initialState);

    if (spinner) spinner.succeed("Debug workflow complete");
    else if (reporter)
      reporter!.reportStage("complete", "Debug workflow complete", chalk.green);

    // Display results only if not in JSON mode
    if (!useJsonOutput) {
      // Display results
      console.log("\n" + chalk.bold.blue("Test Information:"));
      console.log(`Test: ${chalk.bold(trace.testTitle || "Unknown")}`);
      console.log(
        `Status: ${
          trace.testResult.status === "passed"
            ? chalk.green(trace.testResult.status.toUpperCase())
            : chalk.red(trace.testResult.status.toUpperCase())
        }`
      );
      console.log(
        `Browser: ${chalk.bold(
          trace.browser.name +
            (trace.browser.version ? ` v${trace.browser.version}` : "")
        )}`
      );
      console.log(
        `Duration: ${chalk.bold(Math.round(trace.duration.total / 1000))}s`
      );

      // Show analysis results
      if (result.analysis) {
        displayAnalysis(result.analysis);
      }

      // Show context results
      if (result.context) {
        displayContext(result.context);
      }

      // Show diagnosis results
      if (result.diagnosis) {
        displayDiagnosis(result.diagnosis);
      }

      // Show recommendation results
      if (result.recommendation) {
        displayRecommendations(result.recommendation);
      }

      // Show error if any
      if (result.error) {
        console.log("\n" + chalk.bold.red("Error:"));
        console.log(result.error);
      }
    }

    // Return the state as the result
    return {
      analysis: result.analysis,
      context: result.context,
      diagnosis: result.diagnosis,
      recommendation: result.recommendation,
      error: result.error,
    };
  } catch (error: unknown) {
    if (spinner) spinner.fail("Workflow execution failed");
    else if (reporter)
      reporter!.reportStage("error", "Workflow execution failed", chalk.red);

    if (!useJsonOutput) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : String(error)
      );
    }
    return {
      analysis: undefined,
      context: undefined,
      diagnosis: undefined,
      recommendation: undefined,
      error: String(error),
    };
  }
}
