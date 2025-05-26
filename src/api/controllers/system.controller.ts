import { Request, Response } from "express";
import { HealthStatus, SystemMetrics } from "../interfaces";
import os from "os";

// Start time for uptime calculation
const startTime = Date.now();

export class SystemController {
  /**
   * Get system health status
   */
  public getHealthStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Calculate uptime in seconds
      const uptime = Math.floor((Date.now() - startTime) / 1000);

      // TODO: Add actual health checks for components

      const healthStatus: HealthStatus = {
        status: "healthy", // Default to healthy
        components: {
          api: "up",
          queue: "up", // Will be updated when SQS is implemented
          database: "up", // Will be updated when database is implemented
        },
        uptime,
        version: process.env.npm_package_version || "1.0.0",
      };

      res.status(200).json(healthStatus);
    } catch (error) {
      console.error("Error checking system health:", error);
      res.status(500).json({ message: "Error checking system health" });
    }
  };

  /**
   * Get system metrics
   */
  public getSystemMetrics = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // TODO: Implement actual metrics collection

      // For now, just return some mock data
      const metrics: SystemMetrics = {
        requestsTotal: 150,
        requestsPerMinute: 2.5,
        responseTimeAverage: 120, // in ms
        errorRate: 0.02, // 2%
        queueLatency: 350, // in ms
      };

      // Add some system information
      const systemInfo = {
        cpu: {
          loadAvg: os.loadavg(),
          cpus: os.cpus().length,
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          usage: (1 - os.freemem() / os.totalmem()) * 100,
        },
        os: {
          platform: os.platform(),
          release: os.release(),
        },
      };

      res.status(200).json({
        ...metrics,
        system: systemInfo,
      });
    } catch (error) {
      console.error("Error getting system metrics:", error);
      res.status(500).json({ message: "Error retrieving system metrics" });
    }
  };
}
