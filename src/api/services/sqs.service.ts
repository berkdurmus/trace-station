import AWS from "aws-sdk";
import { config } from "dotenv";

// Load environment variables
config();

/**
 * Service for interacting with AWS SQS
 */
export class SQSService {
  private sqs: AWS.SQS;
  private queueUrl: string;
  private isInitialized: boolean = false;
  private isMockMode: boolean = false;

  constructor() {
    // Initialize AWS SDK
    AWS.config.update({
      region: process.env.AWS_REGION || "us-west-2",
    });

    this.sqs = new AWS.SQS();
    this.queueUrl = process.env.SQS_QUEUE_URL || "";

    // Check if we should use mock mode (no actual SQS)
    this.isMockMode = !this.queueUrl || process.env.MOCK_SQS === "true";

    if (this.isMockMode) {
      console.log(
        "SQS Service running in mock mode - no actual SQS will be used"
      );
    }
  }

  /**
   * Initialize the SQS service
   */
  public async initialize(): Promise<void> {
    // If in mock mode, just mark as initialized
    if (this.isMockMode) {
      this.isInitialized = true;
      console.log("SQS service initialized in mock mode");
      return;
    }

    if (!this.queueUrl) {
      throw new Error("SQS_QUEUE_URL is not defined in environment variables");
    }

    try {
      // Check if queue exists
      await this.sqs
        .getQueueAttributes({
          QueueUrl: this.queueUrl,
          AttributeNames: ["QueueArn"],
        })
        .promise();

      this.isInitialized = true;
      console.log("SQS service initialized successfully");
    } catch (error) {
      console.error("Error initializing SQS service:", error);
      throw error;
    }
  }

  /**
   * Send a message to the queue
   * @param message Message to send
   * @returns Message ID
   */
  public async sendMessage(message: any): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode, return a mock message ID
    if (this.isMockMode) {
      const mockId = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      console.log(`[MOCK] Message sent to SQS with ID: ${mockId}`);
      return mockId;
    }

    try {
      const result = await this.sqs
        .sendMessage({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(message),
        })
        .promise();

      return result.MessageId || "";
    } catch (error) {
      console.error("Error sending message to SQS:", error);
      throw error;
    }
  }

  /**
   * Receive messages from the queue
   * @param maxMessages Maximum number of messages to receive
   * @param waitTimeSeconds Time to wait for messages (long polling)
   * @returns Array of messages
   */
  public async receiveMessages(
    maxMessages: number = 1,
    waitTimeSeconds: number = 20
  ): Promise<AWS.SQS.Message[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode, return an empty array (no messages)
    if (this.isMockMode) {
      console.log("[MOCK] Receiving messages from SQS (none available)");
      return [];
    }

    try {
      const result = await this.sqs
        .receiveMessage({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: maxMessages,
          WaitTimeSeconds: waitTimeSeconds,
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"],
        })
        .promise();

      return result.Messages || [];
    } catch (error) {
      console.error("Error receiving messages from SQS:", error);
      throw error;
    }
  }

  /**
   * Delete a message from the queue
   * @param receiptHandle Receipt handle of the message to delete
   */
  public async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode, just log and return
    if (this.isMockMode) {
      console.log(`[MOCK] Message deleted from SQS: ${receiptHandle}`);
      return;
    }

    try {
      await this.sqs
        .deleteMessage({
          QueueUrl: this.queueUrl,
          ReceiptHandle: receiptHandle,
        })
        .promise();
    } catch (error) {
      console.error("Error deleting message from SQS:", error);
      throw error;
    }
  }

  /**
   * Get queue attributes
   * @returns Queue attributes
   */
  public async getQueueAttributes(): Promise<AWS.SQS.GetQueueAttributesResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode, return mock attributes
    if (this.isMockMode) {
      console.log("[MOCK] Getting queue attributes");
      return {
        Attributes: {
          ApproximateNumberOfMessages: "0",
          ApproximateNumberOfMessagesNotVisible: "0",
          CreatedTimestamp: (Date.now() / 1000).toString(),
          LastModifiedTimestamp: (Date.now() / 1000).toString(),
          QueueArn: "arn:aws:sqs:us-west-2:123456789012:mock-queue",
        },
      };
    }

    try {
      const result = await this.sqs
        .getQueueAttributes({
          QueueUrl: this.queueUrl,
          AttributeNames: ["All"],
        })
        .promise();

      return result;
    } catch (error) {
      console.error("Error getting queue attributes:", error);
      throw error;
    }
  }
}
