import { ChatAgent } from "@/agents/agent/chat.agent";
import { WorkflowResult } from "@/workflow";
import { ParsedTrace } from "@/trace";
import { SimpleSpinner } from "@/ui/classes/simple.spinner.class";
import { StageReporter } from "@/ui/classes/stage.reporter.class";
import { WorkflowState } from "@/workflow";

// @ts-ignore
const chalk = require("chalk");
import * as readline from "readline";
import * as fs from "fs";

// Start an interactive chat session using ChatAgent
export async function startChatSession(
  trace: ParsedTrace,
  workflowResult: WorkflowResult,
  apiKey?: string,
  verbose: boolean = false,
  outputFile?: string
) {
  const reporter = new StageReporter();

  console.log("\n" + chalk.bold.blue("Starting Chat Session:"));
  console.log(
    chalk.yellow(
      "You can now chat with the AI assistant about your Playwright test."
    )
  );
  console.log(chalk.yellow("Type 'exit' or 'quit' to end the chat session."));
  console.log(
    chalk.yellow(
      "The assistant has access to the analysis results and documentation."
    )
  );

  // Create a ChatAgent instance - reusing the results from workflow
  reporter.reportStage("chat", "Initializing chat agent...", chalk.blue);
  const chatAgent = new ChatAgent(apiKey, undefined, false); // Set verbose to false to avoid reprocessing docs
  reporter.reportStage("chat", "Chat agent ready", chalk.green);

  // Create a WorkflowState object from the workflow result
  const workflowState: WorkflowState = {
    trace: trace,
    analysis: workflowResult.analysis,
    context: workflowResult.context,
    diagnosis: workflowResult.diagnosis,
    recommendation: workflowResult.recommendation,
    currentStep: "complete",
  };

  // Create readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Store conversation history if output file is specified
  const chatHistory: {
    messages: Array<{ role: string; content: string; timestamp: string }>;
    metadata: {
      testTitle: string;
      status: string;
      timestamp: string;
    };
  } = {
    messages: [],
    metadata: {
      testTitle: trace.testTitle || "Unknown Test",
      status: trace.testResult.status,
      timestamp: new Date().toISOString(),
    },
  };

  let chatActive = true;
  while (chatActive) {
    // Prompt for user input
    const userMessage = await new Promise<string>((resolve) => {
      rl.question(chalk.green("\nYou: "), (input) => {
        resolve(input);
      });
    });

    // Record user message in history
    if (outputFile) {
      chatHistory.messages.push({
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if user wants to exit
    if (
      userMessage.toLowerCase() === "exit" ||
      userMessage.toLowerCase() === "quit"
    ) {
      chatActive = false;

      // Save chat history if output file is specified
      if (outputFile && chatHistory.messages.length > 0) {
        fs.writeFileSync(outputFile, JSON.stringify(chatHistory, null, 2));
        console.log(chalk.green(`\nChat transcript saved to ${outputFile}`));
      }

      // Close the readline interface to exit the program
      rl.close();
      process.exit(0);
      continue;
    }

    // Reset the timer for response timing
    reporter.reset();

    // Use a spinner that shows elapsed time
    const startTime = Date.now();
    const getElapsedTime = () => {
      return `[${((Date.now() - startTime) / 1000).toFixed(1)}s]`;
    };
    let spinner = new SimpleSpinner(
      `💬 ${getElapsedTime()} Processing your question...`,
      getElapsedTime
    ).start();

    try {
      // Send message to ChatAgent
      const response = await chatAgent.chat(userMessage, workflowState);

      // Calculate elapsed time for this chat response
      const chatElapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

      // Stop the spinner and display completed message with elapsed time
      spinner.stop();
      console.log(`💬 [${chatElapsedTime}s] Response ready`);

      // Record assistant response in history
      if (outputFile) {
        chatHistory.messages.push({
          role: "assistant",
          content: response.result.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Get message without reference section for cleaner display
      let messageToDisplay = response.result.message;
      if (messageToDisplay.includes("REFERENCES:")) {
        messageToDisplay = messageToDisplay.split("REFERENCES:")[0].trim();
      }

      // Display the assistant's response
      console.log(chalk.blue("\nAssistant: ") + messageToDisplay);

      // Display relevant documentation references if available
      if (
        response.result.relevantDocs &&
        response.result.relevantDocs.length > 0
      ) {
        console.log(chalk.cyan("\nRelevant Documentation:"));

        // Track unique URLs for information purposes
        const uniqueUrls = new Set(response.result.relevantDocs);

        // Display each reference
        response.result.relevantDocs.forEach((doc, index) => {
          console.log(chalk.cyan(`  ${index + 1}. ${doc}`));
        });

        // Show info about deduplication if necessary
        if (uniqueUrls.size < response.result.relevantDocs.length) {
          console.log(
            chalk.gray(
              "\n  Note: Duplicate references were removed from the original response."
            )
          );
        }
      }
    } catch (error) {
      // Stop the spinner on error
      spinner.stop();
      reporter.reportStage("error", "Error generating response", chalk.red);

      if (outputFile) {
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

  // Close the readline interface
  rl.close();
}
