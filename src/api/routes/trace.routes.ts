import { Router } from "express";
import { TraceController } from "../controllers/trace.controller";

const router = Router();
const traceController = new TraceController();

// Submit a new trace for analysis
router.post("/", traceController.submitTrace);

// Get analysis results for a specific trace
router.get("/:id", traceController.getTraceById);

// List all traces with optional filtering
router.get("/", traceController.listTraces);

// Delete a trace
router.delete("/:id", traceController.deleteTrace);

export default router;
