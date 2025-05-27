import { Router } from "express";
import { QueueController } from "../controllers/queue.controller";

const router = Router();
const queueController = new QueueController();

// Get queue status
router.get("/status", queueController.getQueueStatus);

// Reprocess a failed trace
router.post("/reprocess/:id", queueController.reprocessTrace);

// Get failed messages from DLQ
router.get("/failed", queueController.getFailedMessages);

// Redrive a specific message from DLQ
router.post("/redrive/:receiptHandle", queueController.redriveMessage);

export default router;
