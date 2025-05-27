import { Request, Response } from "express";
import { QueueStatus } from "../interfaces";
import { SQSService } from "../services/sqs.service";

// SQS service instance
const sqsService = new SQSService();

export class QueueController {
  /**
   * Get the status of the queue
   */
  public getQueueStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Initialize SQS service if needed
      if (!(sqsService as any).isInitialized) {
        await sqsService.initialize();
      }

      // Get queue attributes from SQS
      const attributes = await sqsService.getQueueAttributes();

      // Get DLQ attributes if available
      let dlqAttributes = null;
      try {
        dlqAttributes = await sqsService.getDLQAttributes();
      } catch (dlqError) {
        console.warn("Could not retrieve DLQ attributes:", dlqError);
      }

      // Extract relevant attributes
      const messageCount = parseInt(
        attributes.Attributes?.ApproximateNumberOfMessages || "0",
        10
      );
      const inFlightCount = parseInt(
        attributes.Attributes?.ApproximateNumberOfMessagesNotVisible || "0",
        10
      );
      const lastProcessedTime = new Date().toISOString(); // SQS doesn't provide this directly

      // Create queue status
      const queueStatus: QueueStatus = {
        queueName: "trace-processing-queue",
        messageCount,
        inFlightCount,
        lastProcessedAt: lastProcessedTime,
      };

      // Create DLQ status if available
      let dlqStatus = null;
      if (dlqAttributes && dlqAttributes.Attributes) {
        const dlqMessageCount = parseInt(
          dlqAttributes.Attributes.ApproximateNumberOfMessages || "0",
          10
        );
        dlqStatus = {
          queueName: "trace-processing-dlq",
          messageCount: dlqMessageCount,
          inFlightCount: parseInt(
            dlqAttributes.Attributes.ApproximateNumberOfMessagesNotVisible ||
              "0",
            10
          ),
          lastProcessedAt: lastProcessedTime,
        };
      }

      // Calculate some metrics
      // In a real implementation, these would be stored in a database
      const totalProcessed = 120; // Mock data
      const totalFailed = dlqStatus ? dlqStatus.messageCount : 3; // Use DLQ count if available, otherwise mock
      const averageProcessingTime = 2.5; // Mock data in seconds

      const queues = [queueStatus];
      if (dlqStatus) {
        queues.push(dlqStatus);
      }

      res.status(200).json({
        totalProcessed,
        totalFailed,
        averageProcessingTime,
        queues,
      });
    } catch (error) {
      console.error("Error getting queue status:", error);
      res.status(500).json({ message: "Error retrieving queue status" });
    }
  };

  /**
   * Reprocess a failed trace
   */
  public reprocessTrace = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ message: "Invalid trace ID" });
        return;
      }

      // Initialize SQS service if needed
      if (!(sqsService as any).isInitialized) {
        await sqsService.initialize();
      }

      // Create message for reprocessing
      const message = {
        traceId: id,
        reprocessed: true,
        timestamp: new Date().toISOString(),
      };

      // Send to SQS
      const messageId = await sqsService.sendMessage(message);

      res.status(200).json({
        message: `Trace ${id} has been requeued for processing`,
        status: "pending",
        messageId,
      });
    } catch (error) {
      console.error("Error reprocessing trace:", error);
      res.status(500).json({ message: "Error reprocessing trace" });
    }
  };

  /**
   * Get failed messages from DLQ
   */
  public getFailedMessages = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Initialize SQS service if needed
      if (!(sqsService as any).isInitialized) {
        await sqsService.initialize();
      }

      // Get number of messages to retrieve
      const count = req.query.count
        ? parseInt(req.query.count as string, 10)
        : 10;

      // Get failed messages from DLQ
      const messages = await sqsService.getFailedMessages(count);

      // Format messages for the response
      const formattedMessages = messages.map((message) => {
        try {
          // Parse the message body
          const body = JSON.parse(message.Body || "{}");

          return {
            messageId: message.MessageId,
            traceId: body.traceId,
            receiptHandle: message.ReceiptHandle,
            sentTimestamp: message.Attributes?.SentTimestamp,
            receiveCount: message.Attributes?.ApproximateReceiveCount,
            data: body,
          };
        } catch (parseError) {
          return {
            messageId: message.MessageId,
            error: "Failed to parse message body",
            receiptHandle: message.ReceiptHandle,
          };
        }
      });

      res.status(200).json({
        count: formattedMessages.length,
        messages: formattedMessages,
      });
    } catch (error) {
      console.error("Error getting failed messages:", error);
      res.status(500).json({ message: "Error retrieving failed messages" });
    }
  };

  /**
   * Redrive a failed message from DLQ to main queue
   */
  public redriveMessage = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { receiptHandle } = req.params;

      if (!receiptHandle) {
        res.status(400).json({ message: "Invalid receipt handle" });
        return;
      }

      // Initialize SQS service if needed
      if (!(sqsService as any).isInitialized) {
        await sqsService.initialize();
      }

      // Get failed messages from DLQ to find the one with matching receipt handle
      const messages = await sqsService.getFailedMessages(10);
      const message = messages.find((m) => m.ReceiptHandle === receiptHandle);

      if (!message) {
        res.status(404).json({ message: "Message not found in DLQ" });
        return;
      }

      // Redrive the message
      const messageId = await sqsService.redriveMessage(message);

      res.status(200).json({
        message: "Message has been redriven to the main queue",
        messageId,
      });
    } catch (error) {
      console.error("Error redriving message:", error);
      res.status(500).json({ message: "Error redriving message" });
    }
  };
}
