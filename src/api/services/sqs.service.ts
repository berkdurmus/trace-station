import AWS from "aws-sdk";
import { config } from "dotenv";
import { Span } from "@opentelemetry/api";
import { traceSQSOperation } from "../utils/tracing";

// Load environment variables
config();

/**
 * Service for interacting with AWS SQS
 */
export class SQSService {
  private sqs: AWS.SQS;
  private queueUrl: string;
  private dlqUrl: string;
  private isInitialized: boolean = false;
  private isMockMode: boolean = false;
  private maxReceiveCount: number = 3; // Maximum number of attempts before moving to DLQ

  constructor() {
    // Initialize AWS SDK
    AWS.config.update({
      region: process.env.AWS_REGION || "us-west-2",
    });

    this.sqs = new AWS.SQS();
    this.queueUrl = process.env.SQS_QUEUE_URL || "";
    this.dlqUrl = process.env.SQS_DLQ_URL || "";

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
          AttributeNames: ["QueueArn", "RedrivePolicy"],
        })
        .promise();

      // Check if DLQ exists and is configured
      if (this.dlqUrl) {
        // Verify DLQ exists
        await this.sqs
          .getQueueAttributes({
            QueueUrl: this.dlqUrl,
            AttributeNames: ["QueueArn"],
          })
          .promise();

        // Check if redrive policy is configured
        const mainQueueAttrs = await this.sqs
          .getQueueAttributes({
            QueueUrl: this.queueUrl,
            AttributeNames: ["RedrivePolicy"],
          })
          .promise();

        // If redrive policy is not configured, set it up
        if (!mainQueueAttrs.Attributes?.RedrivePolicy) {
          await this.configureDLQ();
        }
      }

      this.isInitialized = true;
      console.log("SQS service initialized successfully");
    } catch (error) {
      console.error("Error initializing SQS service:", error);
      throw error;
    }
  }

  /**
   * Configure Dead Letter Queue
   */
  private async configureDLQ(): Promise<void> {
    if (this.isMockMode || !this.dlqUrl) {
      return;
    }

    try {
      // Get DLQ ARN
      const dlqAttrs = await this.sqs
        .getQueueAttributes({
          QueueUrl: this.dlqUrl,
          AttributeNames: ["QueueArn"],
        })
        .promise();

      const dlqArn = dlqAttrs.Attributes?.QueueArn;

      if (!dlqArn) {
        console.error("Could not retrieve DLQ ARN");
        return;
      }

      // Set redrive policy on main queue
      await this.sqs
        .setQueueAttributes({
          QueueUrl: this.queueUrl,
          Attributes: {
            RedrivePolicy: JSON.stringify({
              maxReceiveCount: this.maxReceiveCount.toString(),
              deadLetterTargetArn: dlqArn,
            }),
          },
        })
        .promise();

      console.log("DLQ configured successfully");
    } catch (error) {
      console.error("Error configuring DLQ:", error);
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

    return traceSQSOperation(
      "sendMessage",
      "trace-processing-queue",
      async (span: Span) => {
        try {
          // Add trace attributes
          span.setAttribute(
            "messaging.message_id",
            message.traceId || "unknown"
          );
          span.setAttribute(
            "messaging.message_payload_size_bytes",
            JSON.stringify(message).length
          );

          const result = await this.sqs
            .sendMessage({
              QueueUrl: this.queueUrl,
              MessageBody: JSON.stringify(message),
            })
            .promise();

          // Record successful send
          span.setAttribute("messaging.message_id", result.MessageId || "");

          return result.MessageId || "";
        } catch (error) {
          console.error("Error sending message to SQS:", error);
          throw error;
        }
      }
    );
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

    return traceSQSOperation(
      "receiveMessage",
      "trace-processing-queue",
      async (span: Span) => {
        try {
          // Add trace attributes
          span.setAttribute("messaging.max_messages", maxMessages);
          span.setAttribute("messaging.wait_time_seconds", waitTimeSeconds);

          const result = await this.sqs
            .receiveMessage({
              QueueUrl: this.queueUrl,
              MaxNumberOfMessages: maxMessages,
              WaitTimeSeconds: waitTimeSeconds,
              AttributeNames: ["All"],
              MessageAttributeNames: ["All"],
            })
            .promise();

          // Record message count
          const messages = result.Messages || [];
          span.setAttribute("messaging.message_count", messages.length);

          return messages;
        } catch (error) {
          console.error("Error receiving messages from SQS:", error);
          throw error;
        }
      }
    );
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

    return traceSQSOperation(
      "deleteMessage",
      "trace-processing-queue",
      async (span: Span) => {
        try {
          // Add trace attributes
          span.setAttribute(
            "messaging.receipt_handle",
            receiptHandle.substring(0, 20) + "..."
          );

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
    );
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
          RedrivePolicy: JSON.stringify({
            maxReceiveCount: this.maxReceiveCount.toString(),
            deadLetterTargetArn: "arn:aws:sqs:us-west-2:123456789012:mock-dlq",
          }),
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

  /**
   * Get failed messages from DLQ
   * @param maxMessages Maximum number of messages to receive
   * @returns Array of messages
   */
  public async getFailedMessages(
    maxMessages: number = 10
  ): Promise<AWS.SQS.Message[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode or if DLQ is not configured, return empty array
    if (this.isMockMode || !this.dlqUrl) {
      console.log("[MOCK] Getting failed messages from DLQ (none available)");
      return [];
    }

    try {
      const result = await this.sqs
        .receiveMessage({
          QueueUrl: this.dlqUrl,
          MaxNumberOfMessages: maxMessages,
          WaitTimeSeconds: 1, // Short polling for DLQ
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"],
        })
        .promise();

      return result.Messages || [];
    } catch (error) {
      console.error("Error getting failed messages from DLQ:", error);
      throw error;
    }
  }

  /**
   * Redrive a message from DLQ back to main queue
   * @param message The message to redrive
   * @returns Message ID of the new message
   */
  public async redriveMessage(message: AWS.SQS.Message): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode or if DLQ is not configured, return mock ID
    if (this.isMockMode || !this.dlqUrl) {
      const mockId = `mock-redrive-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`;
      console.log(`[MOCK] Message redriven to main queue with ID: ${mockId}`);
      return mockId;
    }

    try {
      // Parse the original message
      const messageBody = JSON.parse(message.Body || "{}");

      // Send to main queue
      const result = await this.sqs
        .sendMessage({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(messageBody),
          MessageAttributes: message.MessageAttributes,
        })
        .promise();

      // Delete from DLQ
      await this.sqs
        .deleteMessage({
          QueueUrl: this.dlqUrl,
          ReceiptHandle: message.ReceiptHandle || "",
        })
        .promise();

      return result.MessageId || "";
    } catch (error) {
      console.error("Error redriving message from DLQ:", error);
      throw error;
    }
  }

  /**
   * Get DLQ attributes
   * @returns DLQ attributes
   */
  public async getDLQAttributes(): Promise<AWS.SQS.GetQueueAttributesResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In mock mode or if DLQ is not configured, return mock attributes
    if (this.isMockMode || !this.dlqUrl) {
      console.log("[MOCK] Getting DLQ attributes");
      return {
        Attributes: {
          ApproximateNumberOfMessages: "0",
          ApproximateNumberOfMessagesNotVisible: "0",
          CreatedTimestamp: (Date.now() / 1000).toString(),
          LastModifiedTimestamp: (Date.now() / 1000).toString(),
          QueueArn: "arn:aws:sqs:us-west-2:123456789012:mock-dlq",
        },
      };
    }

    try {
      const result = await this.sqs
        .getQueueAttributes({
          QueueUrl: this.dlqUrl,
          AttributeNames: ["All"],
        })
        .promise();

      return result;
    } catch (error) {
      console.error("Error getting DLQ attributes:", error);
      throw error;
    }
  }
}
