import { Command } from "commander";

import {
  setupAnalyzeCLI,
  setupAnalyzeCLIChat,
  setupOrchestratedAnalyzeCLI,
  setupOrchestratedAnalyzeCLIChat,
} from "./index";

export async function setupCLI() {
  const program = new Command();

  program
    .name("trace-station")
    .description("AI-powered Playwright test debugging agent")
    .version("0.1.0")
    .option("--json", "Output results in JSON format");

  await setupAnalyzeCLI(program);
  await setupAnalyzeCLIChat(program);
  await setupOrchestratedAnalyzeCLI(program);
  await setupOrchestratedAnalyzeCLIChat(program);

  return program;
}
