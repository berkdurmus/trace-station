import { displayFullAnalysisResults } from "./cli.helper.service";
import { formatResultsAsJson } from "./cli.format.service";
import { loadTraceFile } from "@/trace/services/load.trace.service";
import { parseTraceFile } from "@/trace/services/parse.trace.service";
import { SimpleSpinner } from "@/ui/classes/simple.spinner.class";
import { StageReporter } from "@/ui/classes/stage.reporter.class";
import { runOrchestratedWorkflow } from "@/workflow/services";
import { Command } from "commander";
const chalk = require("chalk");
import * as fs from "fs";
import { startChatSession } from "./chat.service";
import { fetchPlaywrightDocs } from "@/trace/services/fetch.docs.service";

export async function setupOrchestratedAnalyzeCLI(program: Command) {
  program
    .command("analyze-orchestrated")
    .description("Analyze a test trace using dynamic AI orchestration")
    .argument("<file>", "Path to trace file or zip archive")
    .option("-k, --api-key <key>", "API key for Anthropic Claude")
    .option("-v, --verbose", "Show detailed processing logs")
    .option("-o, --output <file>", "Save results to JSON file")
    .option("--retries", "Enable retry mechanism for failed steps")
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
          retries?: boolean;
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
              "Starting orchestrated trace analysis...",
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
            return;
          }

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

          // Parse trace file
          if (!useJsonOutput)
            reporter.reportStage("parse", "Parsing trace data...", chalk.blue);
          else spinner!.text = "Parsing trace data...";

          const parsedTrace = await parseTraceFile(
            { filename: traceFile.filename, content: traceFile.content },
            networkFile
              ? { filename: networkFile.filename, content: networkFile.content }
              : undefined,
            stacksFile
              ? { filename: stacksFile.filename, content: stacksFile.content }
              : undefined
          );

          // Handle both --rag and --no-rag options
          const disableRag = options.noRag === true || options.rag === false;

          // Run the dynamic orchestrated workflow
          if (!useJsonOutput)
            reporter.reportStage(
              "orchestration",
              "Running dynamic analysis workflow with AI orchestration...",
              chalk.magenta
            );
          else spinner!.text = "Running dynamic analysis workflow...";

          const workflowResult = await runOrchestratedWorkflow(
            parsedTrace,
            options.apiKey,
            options.verbose,
            useJsonOutput,
            {
              enableRetries: options.retries,
              disableRag: disableRag,
            }
          );

          if (workflowResult.error) {
            if (spinner) spinner.fail("Analysis failed");
            else
              reporter.reportStage(
                "error",
                `Analysis failed: ${workflowResult.error}`,
                chalk.red
              );

            console.error(chalk.red(`Error: ${workflowResult.error}`));
            return;
          }

          if (spinner) spinner.succeed("Analysis completed");
          else reporter.complete("Orchestrated analysis completed");

          // Output results
          if (useJsonOutput) {
            const jsonOutput = formatResultsAsJson(parsedTrace, workflowResult);
            console.log(JSON.stringify(jsonOutput, null, 2));
          } else {
            displayFullAnalysisResults(parsedTrace, workflowResult);
          }

          // Save results to file if requested
          if (options.output) {
            const jsonOutput = formatResultsAsJson(parsedTrace, workflowResult);
            fs.writeFileSync(
              options.output,
              JSON.stringify(jsonOutput, null, 2)
            );
            console.log(chalk.green(`Results saved to ${options.output}`));
          }
        } catch (error) {
          if (spinner) spinner.fail("Operation failed");
          else
            reporter.reportStage(
              "error",
              "Analysis operation failed",
              chalk.red
            );

          console.error(
            chalk.red(
              `Error: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    );
}

export async function setupOrchestratedAnalyzeCLIChat(program: Command) {
  program
    .command("chat-orchestrated")
    .description(
      "Analyze a Playwright trace file using the orchestrated workflow and start an interactive chat session"
    )
    .argument("<file>", "Path to trace file or zip archive")
    .option("-k, --api-key <key>", "API key for Anthropic Claude")
    .option("-v, --verbose", "Show detailed documentation processing logs")
    .option("-o, --output <file>", "Save chat transcript to JSON file")
    .option("-r, --retries", "Enable retries for agent calls")
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
          retries?: boolean;
          updateDocs?: boolean;
          rag?: boolean;
          noRag?: boolean;
        }
      ) => {
        const useJsonOutput = program.opts().json || false;
        const reporter = new StageReporter();

        // Exit if JSON output is requested since it's not compatible with chat
        if (useJsonOutput) {
          console.log(
            JSON.stringify({
              error:
                "JSON output mode is not compatible with interactive chat mode. Use the analyze-orchestrated command with --json instead.",
            })
          );
          return;
        }

        try {
          // Update documentation if requested
          if (options.updateDocs) {
            reporter.reportStage(
              "docs",
              "Updating Playwright documentation...",
              chalk.blue
            );

            await fetchPlaywrightDocs(true);
          }

          // Load and parse trace file
          reporter.reportStage(
            "start",
            "Starting orchestrated chat session...",
            chalk.blue
          );

          const traceFiles = await loadTraceFile(file);
          reporter.reportStage(
            "load",
            "Trace file loaded, parsing content...",
            chalk.blue
          );

          if (traceFiles.length === 0) {
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

          // Parse the trace file
          reporter.reportStage("parse", "Parsing trace data...", chalk.blue);
          const parsedTrace = await parseTraceFile(
            { filename: traceFile.filename, content: traceFile.content },
            networkFile
              ? { filename: networkFile.filename, content: networkFile.content }
              : undefined,
            stacksFile
              ? { filename: stacksFile.filename, content: stacksFile.content }
              : undefined
          );
          reporter.reportStage(
            "parse",
            "Trace file parsed successfully",
            chalk.green
          );

          // Handle both --rag and --no-rag options
          const disableRag = options.noRag === true || options.rag === false;

          // Run the orchestrated workflow
          const orchestratedOptions = {
            enableRetries: options.retries || false,
            disableRag: disableRag,
          };

          console.log(chalk.blue("Using orchestrated workflow with options:"));
          console.log(
            `- Retries: ${
              orchestratedOptions.enableRetries ? "Enabled" : "Disabled"
            }`
          );

          reporter.reportStage(
            "orchestration",
            "Running analysis for chat session...",
            chalk.magenta
          );

          const workflowResult = await runOrchestratedWorkflow(
            parsedTrace,
            options.apiKey,
            options.verbose,
            false,
            {
              enableRetries: options.retries,
              disableRag: disableRag,
            }
          );

          reporter.reportStage("complete", "Analysis completed", chalk.green);
          reporter.reportStage(
            "chat",
            "Starting interactive chat session...",
            chalk.magenta
          );

          // Start chat session with the workflow results
          await startChatSession(
            parsedTrace,
            workflowResult,
            options.apiKey,
            options.verbose || false,
            options.output
          );
        } catch (error: unknown) {
          reporter.reportStage(
            "error",
            "Error processing trace file",
            chalk.red
          );
          console.error(
            chalk.red("Error:"),
            error instanceof Error ? error.message : String(error)
          );
          if (error instanceof Error && error.stack) {
            console.error(chalk.gray(error.stack));
          }
        }
      }
    );
}
