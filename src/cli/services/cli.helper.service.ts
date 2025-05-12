import {
  ContextOutput,
  DiagnosisOutput,
  RecommendationOutput,
  TraceAnalysisOutput,
} from "@/agents";
import chalk from "chalk";
import { NetworkRequest } from "@/trace";
import { ParsedTrace } from "@/trace";
import { WorkflowResult } from "@/workflow";

export function displayAnalysis(analysis: TraceAnalysisOutput) {
  console.log("\n" + chalk.bold.red("Failure Analysis:"));

  if (analysis.result.failureReason) {
    console.log(
      `Failure Reason: ${chalk.yellow(analysis.result.failureReason)}`
    );
  }

  if (analysis.result.failurePoint) {
    console.log(`Failure Point: ${chalk.yellow(analysis.result.failurePoint)}`);
  }

  if (
    analysis.result.errorMessages &&
    analysis.result.errorMessages.length > 0
  ) {
    console.log("\nError Messages:");
    analysis.result.errorMessages.forEach((msg: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.red(msg)}`);
    });
  }

  if (
    analysis.result.failedActions &&
    analysis.result.failedActions.length > 0
  ) {
    console.log("\nFailed Actions:");
    analysis.result.failedActions.forEach((action: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.yellow(action)}`);
    });
  }

  // Display network errors if they exist in the analysis results
  if (
    analysis.result.networkErrors &&
    analysis.result.networkErrors.length > 0
  ) {
    console.log("\nNetwork Errors:");
    analysis.result.networkErrors.forEach((error: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.red(error)}`);
    });
  }

  console.log(
    `\nSeverity: ${getSeverityColor(analysis.result.severityLevel)(
      analysis.result.severityLevel?.toUpperCase() || "MEDIUM"
    )}`
  );

  if (analysis.reasoning) {
    console.log("\n" + chalk.bold.blue("Detailed Analysis:"));
    console.log(analysis.reasoning);
  }
}

export function displayContext(context: ContextOutput) {
  console.log("\n" + chalk.bold.blue("Context Information:"));

  if (
    context.result.relevantDocumentation &&
    context.result.relevantDocumentation.length > 0
  ) {
    console.log("\nRelevant Documentation:");
    context.result.relevantDocumentation.forEach((doc: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.blue(doc)}`);
    });
  }

  if (
    context.result.commonPatterns &&
    context.result.commonPatterns.length > 0
  ) {
    console.log("\nCommon Patterns:");
    context.result.commonPatterns.forEach((pattern: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.blue(pattern)}`);
    });
  }

  if (context.result.suggestions && context.result.suggestions.length > 0) {
    console.log("\nSuggestions:");
    context.result.suggestions.forEach((suggestion: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.blue(suggestion)}`);
    });
  }

  if (
    context.result.documentationReferences &&
    context.result.documentationReferences.length > 0
  ) {
    console.log("\nDocumentation References:");
    context.result.documentationReferences.forEach((ref: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.cyan(ref)}`);
    });
  }

  if (context.reasoning) {
    console.log("\nReasoning:");
    console.log(context.reasoning);
  }
}

export function displayDiagnosis(diagnosis: DiagnosisOutput) {
  console.log("\n" + chalk.bold.yellow("Root Cause Diagnosis:"));

  if (diagnosis.result.rootCause) {
    console.log(`Root Cause: ${chalk.yellow(diagnosis.result.rootCause)}`);
  }

  if (diagnosis.result.explanation) {
    console.log(`\nExplanation: ${diagnosis.result.explanation}`);
  }

  if (
    diagnosis.result.relatedIssues &&
    diagnosis.result.relatedIssues.length > 0
  ) {
    console.log("\nRelated Issues:");
    diagnosis.result.relatedIssues.forEach((issue: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.yellow(issue)}`);
    });
  }

  if (diagnosis.result.confidence !== undefined) {
    const confidencePercentage = Math.round(diagnosis.result.confidence * 100);
    let confidenceColor;
    if (confidencePercentage >= 80) confidenceColor = chalk.green;
    else if (confidencePercentage >= 50) confidenceColor = chalk.yellow;
    else confidenceColor = chalk.red;

    console.log(`\nConfidence: ${confidenceColor(`${confidencePercentage}%`)}`);
  }

  if (diagnosis.reasoning) {
    console.log("\nReasoning:");
    console.log(diagnosis.reasoning);
  }
}

export function displayRecommendations(recommendation: RecommendationOutput) {
  console.log("\n" + chalk.bold.green("Recommendations:"));

  if (recommendation.result.recommendations.length > 0) {
    console.log("\nAction Items:");
    recommendation.result.recommendations.forEach((rec: string, i: number) => {
      console.log(`  ${i + 1}. ${chalk.green(rec)}`);
    });
  }

  if (
    recommendation.result.codeFixes &&
    recommendation.result.codeFixes.length > 0
  ) {
    console.log("\nCode Fixes:");
    recommendation.result.codeFixes.forEach((fix: string, i: number) => {
      console.log(`\n  ${i + 1}. ${chalk.cyan(fix)}`);
    });
  }

  if (
    recommendation.result.bestPractices &&
    recommendation.result.bestPractices.length > 0
  ) {
    console.log("\nBest Practices:");
    recommendation.result.bestPractices.forEach(
      (practice: string, i: number) => {
        console.log(`  ${i + 1}. ${chalk.green(practice)}`);
      }
    );
  }

  if (recommendation.result.priority) {
    console.log(
      `\nPriority: ${getPriorityColor(recommendation.result.priority)(
        recommendation.result.priority.toUpperCase()
      )}`
    );
  }

  if (recommendation.result.userImpact) {
    const impact = recommendation.result.userImpact;
    console.log("\nUser Impact:");

    // Display severity with appropriate color
    const severityColor =
      impact.severity === "critical"
        ? chalk.red.bold
        : impact.severity === "moderate"
        ? chalk.yellow.bold
        : chalk.green;

    console.log(`  Severity: ${severityColor(impact.severity.toUpperCase())}`);
    console.log(`  Description: ${impact.description}`);

    if (impact.affectedFeatures && impact.affectedFeatures.length > 0) {
      console.log("  Affected Features:");
      impact.affectedFeatures.forEach((feature: string, i: number) => {
        console.log(`    - ${chalk.cyan(feature)}`);
      });
    }
  }

  if (recommendation.reasoning) {
    console.log("\nReasoning:");
    console.log(recommendation.reasoning);
  }
}

// Helper function to count network requests by status code group
function getNetworkStatusCounts(networkRequests: NetworkRequest[]): {
  [key: string]: number;
} {
  const statusCodeCounts: { [key: string]: number } = {};

  networkRequests.forEach((req) => {
    if (!req.status) return;
    const statusGroup = Math.floor(req.status / 100) * 100;
    statusCodeCounts[statusGroup] = (statusCodeCounts[statusGroup] || 0) + 1;
  });

  return statusCodeCounts;
}

// Helper function to display all analysis results
export function displayFullAnalysisResults(
  trace: ParsedTrace,
  workflowResult: WorkflowResult
) {
  console.log("\n" + chalk.bold.blue("Test Information:"));
  console.log(`Test: ${chalk.bold(trace.testTitle || "Unknown")}`);
  console.log(
    `Status: ${
      trace.testResult.status === "passed"
        ? chalk.green(trace.testResult.status.toUpperCase())
        : chalk.red(trace.testResult.status.toUpperCase())
    }`
  );
  console.log(
    `Browser: ${chalk.bold(
      trace.browser.name +
        (trace.browser.version ? ` v${trace.browser.version}` : "")
    )}`
  );

  // Display network stats if available
  if (trace.networkRequests && trace.networkRequests.length > 0) {
    console.log("\n" + chalk.bold.cyan("Network Information:"));
    console.log(`Total Requests: ${chalk.bold(trace.networkRequests.length)}`);

    // Group by status code
    const statusCounts = getNetworkStatusCounts(trace.networkRequests);
    for (const [status, count] of Object.entries(statusCounts)) {
      let statusColor = chalk.blue;
      if (status === "400") statusColor = chalk.yellow;
      if (status === "500") statusColor = chalk.red;
      console.log(`  ${statusColor(`${status}s Responses`)}: ${count}`);
    }

    // Show failed requests if any
    const failedRequests = trace.networkRequests.filter(
      (req) => req.status && req.status >= 400
    );

    if (failedRequests.length > 0) {
      console.log("\n" + chalk.bold.yellow("Failed Network Requests:"));
      failedRequests.slice(0, 5).forEach((req, i) => {
        console.log(
          `  ${i + 1}. ${chalk.red(req.url || "Unknown URL")} - Status ${
            req.status
          }`
        );
      });

      if (failedRequests.length > 5) {
        console.log(
          `  ...and ${failedRequests.length - 5} more failed requests`
        );
      }
    }
  }

  // Display analysis results
  if (workflowResult.analysis) {
    displayAnalysis(workflowResult.analysis);
  }

  // Display context information
  if (workflowResult.context) {
    displayContext(workflowResult.context);
  }

  // Display diagnosis
  if (workflowResult.diagnosis) {
    displayDiagnosis(workflowResult.diagnosis);
  }

  // Display recommendations
  if (workflowResult.recommendation) {
    displayRecommendations(workflowResult.recommendation);
  }

  // Display synthesis if available
  if (workflowResult.synthesis) {
    console.log("\n" + chalk.bold.magenta("AI Synthesis:"));

    if (workflowResult.synthesis.result.synthesis) {
      console.log(workflowResult.synthesis.result.synthesis);
    } else {
      console.log(JSON.stringify(workflowResult.synthesis.result, null, 2));
    }

    console.log(
      "\n" +
        chalk.gray(
          "This is a high-level synthesis combining results from all analysis agents."
        )
    );
  }

  // Display error if any
  if (workflowResult.error) {
    console.log("\n" + chalk.bold.red("Error:"));
    console.log(workflowResult.error);
  }
}

export function getSeverityColor(
  severity?: "low" | "medium" | "high" | "critical"
) {
  switch (severity) {
    case "low":
      return chalk.green;
    case "medium":
      return chalk.yellow;
    case "high":
      return chalk.red;
    case "critical":
      return chalk.bgRed.white;
    default:
      return chalk.yellow;
  }
}

export function getPriorityColor(priority?: "low" | "medium" | "high") {
  switch (priority) {
    case "low":
      return chalk.green;
    case "medium":
      return chalk.yellow;
    case "high":
      return chalk.red;
    default:
      return chalk.yellow;
  }
}
