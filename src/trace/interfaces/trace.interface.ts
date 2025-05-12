// Trace file types
export interface TraceFile {
  filename: string;
  content: Buffer | string;
}

export interface NetworkRequest {
  requestId?: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  timestamp?: number;
  responseTimestamp?: number;
  mimeType?: string;
  type?: string;
  timing?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  error?: string;
}

export interface ConsoleMessage {
  type: "log" | "info" | "warning" | "error";
  text: string;
  timestamp: number;
  stackTrace?: string;
}

export interface ActionEvent {
  type: string;
  selector?: string;
  value?: string;
  timestamp: number;
  duration?: number;
  error?: string;
}

export interface ScreenshotData {
  timestamp: number;
  data: string; // Base64 encoded image
  title?: string;
}

export interface ParsedTrace {
  testTitle?: string;
  testFile?: string;
  browser: {
    name: string;
    version?: string;
    platform?: string;
  };
  actions: ActionEvent[];
  networkRequests: NetworkRequest[];
  consoleMessages: ConsoleMessage[];
  screenshots: ScreenshotData[];
  errors: {
    message: string;
    stack?: string;
    timestamp: number;
  }[];
  duration: {
    start: number;
    end: number;
    total: number;
  };
  testResult: {
    status: "passed" | "failed" | "timedOut" | "skipped";
    error?: {
      message: string;
      stack?: string;
    };
  };
}
