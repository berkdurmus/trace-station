import { Router } from "express";
import { SystemController } from "../controllers/system.controller";

const router = Router();
const systemController = new SystemController();

// Health check endpoint
router.get("/health", systemController.getHealthStatus);

// Metrics endpoint
router.get("/metrics", systemController.getSystemMetrics);

export default router;
