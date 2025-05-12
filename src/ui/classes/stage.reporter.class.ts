import { SimpleSpinner } from "./simple.spinner.class";
// @ts-ignore
const chalk = require("chalk");

// Utility for tracking elapsed time and displaying stage messages
export class StageReporter {
  private startTime: number;
  private activeSpinner: SimpleSpinner | null = null;
  private currentStage: string | null = null;
  private stageEmojis: Record<string, string> = {
    start: "🚀",
    load: "📦",
    parse: "📝",
    analyze: "🧠",
    search: "🔎",
    docs: "📚",
    diagnosis: "🔍",
    recommendation: "💡",
    complete: "✅",
    error: "❌",
    network: "🌐",
    orchestration: "🔄",
    chat: "💬",
    warning: "⚠️",
    synthesis: "🧩",
  };

  constructor() {
    this.startTime = Date.now();
  }

  // Get current elapsed time as formatted string
  private getElapsedTimeStr(): string {
    const elapsedTotal = ((Date.now() - this.startTime) / 1000).toFixed(1);
    return `[${elapsedTotal}s]`;
  }

  reportStage(
    stage: string,
    message: string,
    color?: (text: string) => string
  ): void {
    const currentTime = Date.now();
    const elapsedTotal = ((currentTime - this.startTime) / 1000).toFixed(1);
    const emoji = this.stageEmojis[stage] || "•";

    // Stop any active spinners when changing stages
    if (
      this.activeSpinner &&
      (this.currentStage !== stage || stage === "complete" || stage === "error")
    ) {
      this.activeSpinner.stop();
      this.activeSpinner = null;
    }

    // Format the message
    const formattedMessage = color ? color(message) : message;

    // For certain stages, use a spinner to show ongoing activity
    const spinnerStages = [
      "analyze",
      "docs",
      "diagnosis",
      "recommendation",
      "orchestration",
      "synthesis",
    ];

    if (
      spinnerStages.includes(stage) &&
      stage !== this.currentStage &&
      stage !== "complete" &&
      stage !== "error"
    ) {
      // Stop previous spinner if there was one
      if (this.activeSpinner) {
        this.activeSpinner.stop();
      }

      // Start a new spinner for this stage with time updating function
      const spinnerText = `${emoji} ${this.getElapsedTimeStr()} ${formattedMessage}`;
      this.activeSpinner = new SimpleSpinner(
        spinnerText,
        () => this.getElapsedTimeStr() // Pass time update function to spinner
      ).start();
      this.currentStage = stage;
    } else if (stage === "complete" && this.currentStage) {
      // For completed stage, show a completion message
      console.log(`${emoji} [${elapsedTotal}s] ${formattedMessage}`);
      this.currentStage = null;
    } else if (stage === "error") {
      // For errors, show the error message
      console.log(`${emoji} [${elapsedTotal}s] ${formattedMessage}`);
      this.currentStage = null;
    } else {
      // For other transitions or updates, just log the message
      console.log(`${emoji} [${elapsedTotal}s] ${formattedMessage}`);
    }
  }

  complete(message: string = "Analysis completed"): void {
    // Stop any active spinner
    if (this.activeSpinner) {
      this.activeSpinner.stop();
      this.activeSpinner = null;
    }

    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(
      `${this.stageEmojis.complete} [${totalTime}s] ${chalk.green(
        message
      )} in ${totalTime}s`
    );
    this.currentStage = null;
  }

  reset(): void {
    // Stop any active spinner
    if (this.activeSpinner) {
      this.activeSpinner.stop();
      this.activeSpinner = null;
    }

    this.startTime = Date.now();
    this.currentStage = null;
  }
}
