import { WorkflowResult } from "@/workflow";
import { ParsedTrace } from "@/trace";

/**
 * Format analysis results as a clean JSON object
 */
export function formatResultsAsJson(
  trace: ParsedTrace,
  result: WorkflowResult
): Record<string, any> {
  const output: Record<string, any> = {
    test: {
      title: trace.testTitle || "Unknown Test",
      file: trace.testFile || "Unknown File",
      status: trace.testResult.status,
      error: trace.testResult.error
        ? {
            message: trace.testResult.error.message,
            stack: trace.testResult.error.stack,
          }
        : null,
    },
    browser: {
      name: trace.browser.name,
      version: trace.browser.version,
    },
    timestamp: new Date().toISOString(),
  };

  if (result.analysis) {
    output.analysis = {
      failurePoint: result.analysis.result.failurePoint,
      failureReason: result.analysis.result.failureReason,
      errorMessages: result.analysis.result.errorMessages,
      failedActions: result.analysis.result.failedActions,
    };
  }

  if (result.diagnosis) {
    output.diagnosis = {
      rootCause: result.diagnosis.result.rootCause,
      explanation: result.diagnosis.result.explanation,
      confidence: result.diagnosis.result.confidence,
      relatedIssues: result.diagnosis.result.relatedIssues,
    };
  }

  if (result.recommendation) {
    output.recommendation = {
      recommendations: result.recommendation.result.recommendations,
      codeFixes: result.recommendation.result.codeFixes,
      bestPractices: result.recommendation.result.bestPractices,
      priority: result.recommendation.result.priority,
      userImpact: result.recommendation.result.userImpact,
    };
  }

  if (result.error) {
    output.error = result.error;
  }

  return output;
}
