import {
  ActionEvent,
  ConsoleMessage,
  NetworkRequest,
  ScreenshotData,
} from "./trace.interface";

/**
 * DOM snapshot at a specific point in time
 */
export interface DOMSnapshot {
  timestamp: number;
  html: string;
  cssSelector?: string; // Selector where the action was performed
  xpath?: string; // XPath where the action was performed
  title?: string;
  url?: string;
}

/**
 * Synchronized data point with all modalities at a specific timestamp
 */
export interface SynchronizedDataPoint {
  timestamp: number;
  screenshot?: ScreenshotData;
  domSnapshot?: DOMSnapshot;
  actions?: ActionEvent[];
  networkRequests?: NetworkRequest[];
  consoleMessages?: ConsoleMessage[];
  errors?: {
    message: string;
    stack?: string;
    timestamp: number;
  }[];
}

/**
 * The embedded representation of each modality
 */
export interface ModalityEmbedding {
  modalityType: "visual" | "dom" | "network" | "console" | "action";
  embedding: number[];
  timestamp: number;
  sourceId: string; // Reference to the original data point
}

/**
 * Analysis result from a specific modality
 */
export interface ModalityAnalysis {
  modalityType: "visual" | "dom" | "network" | "console" | "action";
  confidence: number;
  result: string;
  relevantDataPoints: string[]; // References to the data points that contributed to this analysis
  timestamp: number;
}

/**
 * The combined analysis result from all modalities
 */
export interface MultiModalAnalysisResult {
  traceId: string;
  timestamp: number;
  failurePoint?: SynchronizedDataPoint;
  rootCause?: string;
  explanation: string;
  suggestedFix?: string;
  confidenceScore: number;
  modalityAnalyses: ModalityAnalysis[];
  relatedDocumentation?: {
    title: string;
    content: string;
    url?: string;
    relevance: number;
  }[];
  visualizationData?: {
    timelineEvents: Array<{
      timestamp: number;
      eventType: string;
      importance: number;
      description: string;
    }>;
    causalGraph?: any; // Graph representation of the causal relationships
  };
}

/**
 * Configuration for the multi-modal analysis
 */
export interface MultiModalAnalysisConfig {
  enabledModalities: {
    visual: boolean;
    dom: boolean;
    network: boolean;
    console: boolean;
    action: boolean;
  };
  modalityWeights: {
    visual: number;
    dom: number;
    network: number;
    console: number;
    action: number;
  };
  openAIApiKey?: string;
  huggingFaceApiKey?: string;
  embeddingModel: string;
  visionModel: string;
  textModel: string;
  minConfidenceThreshold: number;
}
