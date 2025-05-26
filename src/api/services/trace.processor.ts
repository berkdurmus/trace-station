import { SQSService } from "./sqs.service";
import { AgentType } from "@/agents/interfaces/agent.interface";
import { TraceResponse } from "../interfaces";

// In-memory trace storage (replace with database in production)
declare global {
  var traces: Record<string, TraceResponse>;
}

// Initialize global trace storage if not exists
if (!global.traces) {
  global.traces = {};
}

/**
 * Service for processing traces from SQS
 */
export class TraceProcessor {
  private sqsService: SQSService;
  private isProcessing: boolean = false;
  private pollInterval: number = 10000; // 10 seconds
  private maxConcurrentProcessing: number = 5;
  private currentlyProcessing: number = 0;

  constructor() {
    this.sqsService = new SQSService();
  }

  /**
   * Start processing messages from the queue
   */
  public async start(): Promise<void> {
    if (this.isProcessing) {
      console.log("Trace processor is already running");
      return;
    }

    this.isProcessing = true;
    console.log("Starting trace processor");

    // Initialize SQS service
    try {
      await this.sqsService.initialize();
    } catch (error) {
      console.error("Failed to initialize SQS service:", error);
      this.isProcessing = false;
      return;
    }

    // Start polling
    this.poll();
  }

  /**
   * Stop processing messages
   */
  public stop(): void {
    this.isProcessing = false;
    console.log("Stopping trace processor");
  }

  /**
   * Poll for messages from the queue
   */
  private poll(): void {
    if (!this.isProcessing) return;

    setTimeout(async () => {
      try {
        // Check if we can process more messages
        if (this.currentlyProcessing < this.maxConcurrentProcessing) {
          // Get available capacity
          const capacity =
            this.maxConcurrentProcessing - this.currentlyProcessing;

          // Receive messages from the queue
          const messages = await this.sqsService.receiveMessages(capacity, 5);

          if (messages.length > 0) {
            console.log(`Received ${messages.length} messages from queue`);

            // Process each message
            for (const message of messages) {
              this.processMessage(message);
            }
          }
        }
      } catch (error) {
        console.error("Error polling queue:", error);
      }

      // Continue polling
      if (this.isProcessing) {
        this.poll();
      }
    }, this.pollInterval);
  }

  /**
   * Process a message from the queue
   */
  private async processMessage(message: AWS.SQS.Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) {
      console.error("Invalid message received");
      return;
    }

    this.currentlyProcessing++;

    try {
      // Parse message body
      const body = JSON.parse(message.Body);
      const traceId = body.traceId;

      if (!traceId) {
        console.error("Message missing traceId:", body);
        await this.sqsService.deleteMessage(message.ReceiptHandle);
        this.currentlyProcessing--;
        return;
      }

      console.log(`Processing trace ${traceId}`);

      // Update trace status
      if (global.traces[traceId]) {
        global.traces[traceId].status = "processing";
      }

      // Process the trace
      try {
        // Here we would actually process the trace using the agent system
        // For now, we'll simulate processing with a delay
        await this.simulateProcessing(body);

        // Update trace with results
        if (global.traces[traceId]) {
          global.traces[traceId].status = "completed";
          global.traces[traceId].completedAt = new Date().toISOString();
          global.traces[traceId].results = {
            diagnosis: {
              rootCause: "Simulated root cause",
              confidence: 0.85,
              explanation: "This is a simulated diagnosis result",
            },
            recommendations: [
              "Simulated recommendation 1",
              "Simulated recommendation 2",
            ],
          };
        }

        console.log(`Successfully processed trace ${traceId}`);
      } catch (processingError: unknown) {
        console.error(`Error processing trace ${traceId}:`, processingError);

        // Update trace with error
        if (global.traces[traceId]) {
          global.traces[traceId].status = "failed";
          global.traces[traceId].error = `Processing error: ${
            processingError instanceof Error
              ? processingError.message
              : "Unknown error"
          }`;
        }
      }

      // Delete the message from the queue
      await this.sqsService.deleteMessage(message.ReceiptHandle);
    } catch (error) {
      console.error("Error handling message:", error);
      // Don't delete the message so it can be retried
    }

    this.currentlyProcessing--;
  }

  /**
   * Simulate processing a trace
   * In a real implementation, this would use the trace analysis system
   */
  private async simulateProcessing(body: any): Promise<void> {
    // Simulate processing time
    const processingTime = 2000 + Math.random() * 3000;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Randomly fail some processing attempts
        if (Math.random() < 0.1) {
          reject(new Error("Simulated processing failure"));
        } else {
          resolve();
        }
      }, processingTime);
    });
  }
}
