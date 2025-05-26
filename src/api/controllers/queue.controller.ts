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

      // Calculate some metrics
      // In a real implementation, these would be stored in a database
      const totalProcessed = 120; // Mock data
      const totalFailed = 3; // Mock data
      const averageProcessingTime = 2.5; // Mock data in seconds

      res.status(200).json({
        totalProcessed,
        totalFailed,
        averageProcessingTime,
        queues: [queueStatus],
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
}
