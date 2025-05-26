import express, { Application } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { config } from "dotenv";

// Import routes
import traceRoutes from "./routes/trace.routes";
import queueRoutes from "./routes/queue.routes";
import systemRoutes from "./routes/system.routes";

// Import processor
import { TraceProcessor } from "./services/trace.processor";

// Load environment variables
config();

class ApiServer {
  public app: Application;
  private port: number;
  private traceProcessor: TraceProcessor;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.API_PORT || "3000", 10);
    this.traceProcessor = new TraceProcessor();

    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    // Enable CORS
    this.app.use(cors());

    // Parse JSON bodies
    this.app.use(bodyParser.json({ limit: "50mb" }));

    // Parse URL-encoded bodies
    this.app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

    // Add request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private configureRoutes(): void {
    // API routes
    this.app.use("/api/traces", traceRoutes);
    this.app.use("/api/queue", queueRoutes);
    this.app.use("/api", systemRoutes);

    // Default route
    this.app.get("/", (req, res) => {
      res.json({ message: "Trace Station API" });
    });

    // Handle 404
    this.app.use((req, res) => {
      res.status(404).json({ message: "Route not found" });
    });
  }

  public async start(): Promise<void> {
    // Start the HTTP server
    this.app.listen(this.port, () => {
      console.log(`Server is running on port ${this.port}`);
    });

    // Start the trace processor
    try {
      await this.traceProcessor.start();
      console.log("Trace processor started successfully");
    } catch (error) {
      console.error("Failed to start trace processor:", error);
    }
  }
}

export default ApiServer;
