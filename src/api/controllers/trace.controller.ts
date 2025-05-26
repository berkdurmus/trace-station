import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { TraceResponse, TraceSubmission } from "../interfaces";
import { SQSService } from "../services/sqs.service";

// Use global trace storage
declare global {
  var traces: Record<string, TraceResponse>;
}

// Initialize global trace storage if not exists
if (!global.traces) {
  global.traces = {};
}

// SQS service instance
const sqsService = new SQSService();

export class TraceController {
  /**
   * Submit a trace for analysis
   */
  public submitTrace = async (req: Request, res: Response): Promise<void> => {
    try {
      const submission: TraceSubmission = req.body;

      if (!submission || !submission.traceData) {
        res.status(400).json({ message: "Invalid trace data" });
        return;
      }

      // Generate a unique ID for the trace
      const id = uuidv4();

      // Create trace record
      const trace: TraceResponse = {
        id,
        status: "pending",
        submittedAt: new Date().toISOString(),
        metadata: submission.metadata,
      };

      // Store in global storage
      global.traces[id] = trace;

      // Send to SQS queue for processing
      try {
        // Create message with trace ID and data
        const message = {
          traceId: id,
          traceData: submission.traceData,
          metadata: submission.metadata,
        };

        // Send to SQS
        const messageId = await sqsService.sendMessage(message);
        console.log(`Trace ${id} enqueued with message ID ${messageId}`);

        // Update trace status
        global.traces[id].status = "processing";
      } catch (sqsError) {
        console.error("Error sending trace to SQS:", sqsError);
        // Still return success but note the queueing error
        trace.error =
          "Failed to enqueue for processing. Will retry automatically.";
      }

      res.status(201).json(trace);
    } catch (error) {
      console.error("Error submitting trace:", error);
      res.status(500).json({ message: "Error submitting trace for analysis" });
    }
  };

  /**
   * Get a specific trace by ID
   */
  public getTraceById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !global.traces[id]) {
        res.status(404).json({ message: "Trace not found" });
        return;
      }

      res.status(200).json(global.traces[id]);
    } catch (error) {
      console.error("Error retrieving trace:", error);
      res.status(500).json({ message: "Error retrieving trace" });
    }
  };

  /**
   * List all traces with optional filtering
   */
  public listTraces = async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract query parameters for filtering
      const { status, project, submittedBy } = req.query;

      // Convert to array and apply filters
      let filteredTraces = Object.values(global.traces);

      if (status) {
        filteredTraces = filteredTraces.filter((t) => t.status === status);
      }

      if (project) {
        filteredTraces = filteredTraces.filter(
          (t) => t.metadata?.project === project
        );
      }

      if (submittedBy) {
        filteredTraces = filteredTraces.filter(
          (t) => t.metadata?.submittedBy === submittedBy
        );
      }

      res.status(200).json(filteredTraces);
    } catch (error) {
      console.error("Error listing traces:", error);
      res.status(500).json({ message: "Error listing traces" });
    }
  };

  /**
   * Delete a trace
   */
  public deleteTrace = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || !global.traces[id]) {
        res.status(404).json({ message: "Trace not found" });
        return;
      }

      // Remove from storage
      delete global.traces[id];

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting trace:", error);
      res.status(500).json({ message: "Error deleting trace" });
    }
  };
}
