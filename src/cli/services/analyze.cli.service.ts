import {
  displayAnalysis,
  displayContext,
  displayDiagnosis,
  displayFullAnalysisResults,
  displayRecommendations,
} from "@/cli";
import { formatResultsAsJson } from "@/cli";
import { WorkflowResult } from "@/workflow";
import { loadTraceFile, parseTraceFile } from "@/trace";
import { SimpleSpinner } from "@/ui/classes/simple.spinner.class";
import { StageReporter } from "@/ui/classes/stage.reporter.class";
import { createWorkflow } from "@/workflow/services/graph.workflow";
import { createInitialState } from "@/workflow/services/state.service";
import { Command } from "commander";
import { startChatSession } from "./chat.service";
import { runFullWorkflow } from "@/workflow/services";
// @ts-ignore
const chalk = require("chalk");
import * as fs from "fs";
import { fetchPlaywrightDocs } from "@/trace/services/fetch.docs.service";

export async function setupAnalyzeCLI(program: Command) {
  program
    .command("analyze")
    .description("Analyze a Playwright trace file")
    .argument("<file>", "Path to trace file or zip archive")
    .option("-k, --api-key <key>", "API key for Anthropic Claude")
    .option("-v, --verbose", "Show detailed documentation processing logs")
    .option("-o, --output <file>", "Save results to JSON file")
    .option(
      "--update-docs",
      "Fetch and update Playwright documentation before analysis"
    )
    .option(
      "--rag [boolean]",
      "Enable Retrieval Augmented Generation (use documentation)",
      true
    )
    .option(
      "--no-rag",
      "Disable Retrieval Augmented Generation (don't use documentation)"
    )
    .action(
      async (
        file: string,
        options: {
          apiKey?: string;
          verbose?: boolean;
          output?: string;
          updateDocs?: boolean;
          rag?: boolean;
          noRag?: boolean;
        }
      ) => {
        const useJsonOutput = program.opts().json || false;
        const spinner = useJsonOutput
          ? new SimpleSpinner("Loading trace file...").start()
          : null;

        // Create stage reporter for nicer output
        const reporter = new StageReporter();

        try {
          // Update documentation if requested
          if (options.updateDocs) {
            if (!useJsonOutput) {
              reporter.reportStage(
                "docs",
                "Updating Playwright documentation...",
                chalk.blue
              );
            } else {
              spinner!.text = "Updating Playwright documentation...";
            }

            await fetchPlaywrightDocs(true);
          }

          // Load and parse trace file
          if (!useJsonOutput)
            reporter.reportStage(
              "start",
              "Starting trace analysis...",
              chalk.blue
            );
          else spinner!.text = "Loading trace file...";

          const traceFiles = await loadTraceFile(file);

          if (!useJsonOutput)
            reporter.reportStage(
              "load",
              "Trace file loaded, parsing content...",
              chalk.blue
            );
          else spinner!.text = "Parsing trace file...";

          if (traceFiles.length === 0) {
            if (spinner) spinner.fail("No trace files found");
            else
              reporter.reportStage("error", "No trace files found", chalk.red);

            console.log(
              chalk.yellow(`Could not find trace files at path: ${file}`)
            );
            console.log(
              chalk.yellow(
                "Make sure the file exists and has the correct extension (.trace, .json, or .zip)"
              )
            );
            return;
          }

          console.log(
            "Found trace files:",
            traceFiles.map((f) => f.filename)
          );

          // Look for test.trace, network, and stacks files
          const traceFile = traceFiles.find((f) => f.filename === "test.trace");
          const networkFile = traceFiles.find(
            (f) => f.filename === "0-trace.network"
          );
          const stacksFile = traceFiles.find(
            (f) => f.filename === "0-trace.stacks"
          );

          if (!traceFile) {
            if (spinner) spinner.fail("trace file not found");
            else
              reporter.reportStage("error", "Trace file not found", chalk.red);

            console.log(
              chalk.yellow(
                "Could not find test.trace or 0-trace.trace file in the provided path"
              )
            );
            return;
          }

          console.log(`Using trace file: ${traceFile.filename}`);
          if (networkFile)
            console.log(`Using network file: ${networkFile.filename}`);
          if (stacksFile)
            console.log(`Using stacks file: ${stacksFile.filename}`);

          let parsedTrace;
          try {
            // Parse the trace file along with network and stacks files if available
            parsedTrace = await parseTraceFile(
              { filename: traceFile.filename, content: traceFile.content },
              networkFile
                ? {
                    filename: networkFile.filename,
                    content: networkFile.content,
                  }
                : undefined,
              stacksFile
                ? { filename: stacksFile.filename, content: stacksFile.content }
                : undefined
            );

            if (!useJsonOutput)
              reporter.reportStage(
                "parse",
                "Trace file parsed successfully",
                chalk.green
              );

            // Additional check for binary traces
            if (
              parsedTrace.testTitle === "test" &&
              parsedTrace.actions.length === 0 &&
              parsedTrace.networkRequests.length === 0 &&
              parsedTrace.errors.length === 0
            ) {
              console.log(
                chalk.yellow(
                  "Note: This appears to be a binary format Playwright trace file."
                )
              );
              console.log(
                chalk.yellow(
                  "Limited information can be extracted from this format."
                )
              );
              console.log(
                chalk.yellow(
                  "For full trace analysis, use the Playwright Trace Viewer:"
                )
              );
              console.log(chalk.blue("npx playwright show-trace " + file));
            }
          } catch (error) {
            if (spinner) spinner.fail("Failed to parse trace file");
            else
              reporter.reportStage(
                "error",
                "Failed to parse trace file",
                chalk.red
              );

            console.error(
              chalk.red("Error parsing trace file:"),
              error instanceof Error ? error.message : String(error)
            );
            console.log(
              chalk.yellow(
                "This may be a binary format trace file which requires the Playwright Trace Viewer:"
              )
            );
            console.log(chalk.blue("npx playwright show-trace " + file));
            return;
          }

          // Create workflow with verbosity option
          if (!useJsonOutput)
            reporter.reportStage(
              "analyze",
              "Running trace analysis...",
              chalk.blue
            );
          else spinner!.text = "Analyzing trace...";

          // Handle both --rag and --no-rag options
          const disableRag = options.noRag === true || options.rag === false;

          const workflow = createWorkflow(options.apiKey, options.verbose, {
            disableRag: disableRag,
          });

          // Initialize state and run workflow
          const initialState = createInitialState(parsedTrace);
          const result: WorkflowResult = await workflow(initialState);

          if (spinner) spinner.succeed("Analysis complete");
          else reporter.complete("Analysis completed");

          if (useJsonOutput) {
            // Output in JSON format
            const jsonOutput = formatResultsAsJson(parsedTrace, result);
            console.log(JSON.stringify(jsonOutput, null, 2));
          } else {
            // Display results using the improved common display function
            displayFullAnalysisResults(parsedTrace, result);

            console.log(
              chalk.yellow(
                "\nTip: Try the AI orchestrator-worker approach for more comprehensive analysis:"
              )
            );
            console.log(
              chalk.cyan(`npm run dev -- analyze-orchestrated ${file}`)
            );
          }

          // Save results to output file if specified
          if (options.output) {
            const jsonOutput = formatResultsAsJson(parsedTrace, result);
            fs.writeFileSync(
              options.output,
              JSON.stringify(jsonOutput, null, 2)
            );
            if (!useJsonOutput) {
              console.log(chalk.green(`Results saved to ${options.output}`));
            }
          }
        } catch (error: unknown) {
          if (spinner) spinner.fail("Analysis failed");
          else reporter.reportStage("error", "Analysis failed", chalk.red);

          if (useJsonOutput) {
            console.log(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              })
            );
          } else {
            console.error(
              chalk.red("Error:"),
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      }
    );
}

export async function setupAnalyzeCLIChat(program: Command) {
  program
    .command("chat")
    .description("Analyze a trace file and start an interactive chat session")
    .argument("<file>", "Path to trace file or zip archive")
    .option("-k, --api-key <key>", "API key for Anthropic Claude")
    .option("-v, --verbose", "Show detailed documentation processing logs")
    .option("-o, --output <file>", "Save chat transcript to JSON file")
    .option(
      "--rag [boolean]",
      "Enable Retrieval Augmented Generation (use documentation)",
      true
    )
    .option(
      "--no-rag",
      "Disable Retrieval Augmented Generation (don't use documentation)"
    )
    .action(
      async (
        file: string,
        options: { apiKey?: string; verbose?: boolean; output?: string }
      ) => {
        const useJsonOutput = program.opts().json || false;
        const spinner = useJsonOutput
          ? new SimpleSpinner("Loading trace file...").start()
          : null;

        // Create stage reporter for nicer output
        const reporter = new StageReporter();

        try {
          // Load and parse trace file
          if (!useJsonOutput)
            reporter.reportStage(
              "start",
              "Starting chat session...",
              chalk.blue
            );
          else spinner!.text = "Loading trace file...";

          const traceFiles = await loadTraceFile(file);

          if (!useJsonOutput)
            reporter.reportStage(
              "load",
              "Trace file loaded, parsing content...",
              chalk.blue
            );
          else spinner!.text = "Parsing trace file...";

          if (traceFiles.length === 0) {
            if (spinner) spinner.fail("No trace files found");
            else
              reporter.reportStage("error", "No trace files found", chalk.red);

            console.log(
              chalk.yellow(`Could not find trace files at path: ${file}`)
            );
            console.log(
              chalk.yellow(
                "Make sure the file exists and has the correct extension (.trace, .json, or .zip)"
              )
            );
            return;
          }

          // Look for test.trace, network, and stacks files - prioritize test.trace over 0-trace.trace
          const traceFile = traceFiles.find((f) => f.filename === "test.trace");
          const networkFile = traceFiles.find(
            (f) => f.filename === "0-trace.network"
          );
          const stacksFile = traceFiles.find(
            (f) => f.filename === "0-trace.stacks"
          );

          if (!traceFile) {
            if (spinner) spinner.fail("trace file not found");
            else
              reporter.reportStage("error", "Trace file not found", chalk.red);

            console.log(
              chalk.yellow(
                "Could not find test.trace or 0-trace.trace file in the provided path"
              )
            );
            return;
          }

          let parsedTrace;
          try {
            // Parse the trace file with network and stacks files if available
            if (!useJsonOutput)
              reporter.reportStage(
                "parse",
                "Parsing trace data...",
                chalk.blue
              );

            parsedTrace = await parseTraceFile(
              { filename: traceFile.filename, content: traceFile.content },
              networkFile
                ? {
                    filename: networkFile.filename,
                    content: networkFile.content,
                  }
                : undefined,
              stacksFile
                ? { filename: stacksFile.filename, content: stacksFile.content }
                : undefined
            );
          } catch (error) {
            if (spinner) spinner.fail("Failed to parse trace file");
            else
              reporter.reportStage(
                "error",
                "Failed to parse trace file",
                chalk.red
              );

            console.error(
              chalk.red("Error parsing trace file:"),
              error instanceof Error ? error.message : String(error)
            );
            return;
          }

          // Run the full workflow analysis first
          if (!useJsonOutput)
            reporter.reportStage(
              "analyze",
              "Analyzing trace...",
              chalk.magenta
            );
          else spinner!.text = "Analyzing trace...";

          const workflowResult: WorkflowResult = (await runFullWorkflow(
            parsedTrace,
            options.apiKey,
            options.verbose,
            useJsonOutput,
            reporter
          )) as WorkflowResult;

          if (spinner) spinner.succeed("Analysis complete");
          else
            reporter.reportStage("complete", "Analysis completed", chalk.green);

          // Display the analysis results
          if (useJsonOutput) {
            const jsonOutput = formatResultsAsJson(parsedTrace, workflowResult);
            console.log(JSON.stringify(jsonOutput, null, 2));
          } else {
            displayFullAnalysisResults(parsedTrace, workflowResult);

            console.log(
              chalk.yellow(
                "\nTip: Try the AI orchestrator-worker approach for more comprehensive analysis:"
              )
            );
            console.log(chalk.cyan(`npm run dev -- chat-orchestrated ${file}`));
          }

          // Start chat session with the workflow results
          if (!useJsonOutput) {
            if (!useJsonOutput)
              reporter.reportStage(
                "chat",
                "Starting interactive chat session...",
                chalk.green
              );
            await startChatSession(
              parsedTrace,
              workflowResult,
              options.apiKey,
              options.verbose,
              options.output
            );
          }
        } catch (error) {
          if (spinner) spinner.fail("Error");
          else reporter.reportStage("error", "An error occurred", chalk.red);

          if (useJsonOutput) {
            console.log(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              })
            );
          } else {
            console.error(
              chalk.red("An error occurred:"),
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      }
    );
}
