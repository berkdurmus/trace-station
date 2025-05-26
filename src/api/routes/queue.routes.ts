import { Router } from "express";
import { QueueController } from "../controllers/queue.controller";

const router = Router();
const queueController = new QueueController();

// Get queue status
router.get("/status", queueController.getQueueStatus);

// Reprocess a failed trace
router.post("/reprocess/:id", queueController.reprocessTrace);

export default router;
