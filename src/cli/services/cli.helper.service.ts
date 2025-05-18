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
  const divider = "─────────────────────────────────────────────────";

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // HEADER: Basic test info
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(chalk.bold("\n🔍 TRACE ANALYSIS REPORT"));

  // Test title and status
  console.log(divider);
  console.log(`Test:    ${chalk.bold(trace.testTitle || "Unknown")}`);
  const statusColor =
    trace.testResult.status === "passed" ? chalk.green : chalk.red;
  console.log(`Status:  ${statusColor(trace.testResult.status.toUpperCase())}`);
  console.log(
    `Browser: ${trace.browser.name}${
      trace.browser.version ? ` v${trace.browser.version}` : ""
    }`
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 1: Root cause - the most important info
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  if (workflowResult.diagnosis?.result.rootCause) {
    console.log(divider);
    console.log(chalk.yellow.bold("ROOT CAUSE"));
    console.log(workflowResult.diagnosis.result.rootCause);

    // Only show explanation if it adds value beyond the root cause
    const explanation = workflowResult.diagnosis?.result.explanation;
    if (
      explanation &&
      !explanation.includes(workflowResult.diagnosis.result.rootCause)
    ) {
      console.log(`\n${explanation}`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 2: Action items - what to do
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const recommendations =
    workflowResult.recommendation?.result.recommendations || [];
  if (recommendations.length > 0) {
    console.log(divider);
    console.log(chalk.green.bold("RECOMMENDED ACTIONS"));

    // Limit to top 3 most important recommendations
    const topRecommendations = recommendations.slice(0, 3);
    topRecommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

    // Show remaining count if applicable
    if (recommendations.length > 3) {
      const remaining = recommendations.length - 3;
      console.log(
        chalk.dim(
          `\n...and ${remaining} more recommendation${
            remaining > 1 ? "s" : ""
          }.`
        )
      );
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 3: Code example (if available)
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const codeFixes = workflowResult.recommendation?.result.codeFixes || [];
  if (codeFixes.length > 0) {
    console.log(divider);
    console.log(chalk.cyan.bold("CODE SOLUTION"));

    // Only show the first code solution
    console.log(codeFixes[0]);

    // Show count of additional fixes if there are more
    if (codeFixes.length > 1) {
      console.log(chalk.dim(`\nAdditional code solutions available.`));
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 4: Technical details - for those who want more info
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(divider);
  console.log(chalk.blue.bold("TECHNICAL DETAILS"));

  // Error message
  if (trace.testResult.error?.message) {
    const errorFirstLine = trace.testResult.error.message.split("\n")[0]; // Just first line
    console.log(`Error: ${chalk.red(errorFirstLine)}`);
  }

  // Failure point
  if (workflowResult.analysis?.result.failurePoint) {
    console.log(`Where: ${workflowResult.analysis.result.failurePoint}`);
  }

  // Network failures (if any)
  const failedRequests = trace.networkRequests.filter(
    (req) => (req.status && req.status >= 400) || req.error
  );

  if (failedRequests.length > 0) {
    console.log(
      `Network: ${failedRequests.length} failed request${
        failedRequests.length > 1 ? "s" : ""
      }`
    );

    // Show only the first failed request as an example
    if (failedRequests.length > 0) {
      const req = failedRequests[0];
      const shortUrl =
        req.url.length > 50 ? req.url.substring(0, 47) + "..." : req.url;

      console.log(
        `  → ${req.method || "GET"} ${shortUrl} (${req.status || "Error"})`
      );
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 5: Resources - documentation & best practices
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const docRefs = workflowResult.context?.result.documentationReferences || [];
  const bestPractices =
    workflowResult.recommendation?.result.bestPractices || [];

  if (docRefs.length > 0 || bestPractices.length > 0) {
    console.log(divider);
    console.log(chalk.magenta.bold("RESOURCES & BEST PRACTICES"));

    // Documentation references
    if (docRefs.length > 0) {
      // Only show up to 2 doc references
      const refs = docRefs.slice(0, 2);
      refs.forEach((ref) => {
        // Extract URL if present
        const urlMatch = ref.match(/(https?:\/\/[^\s)]+)/);
        if (urlMatch) {
          console.log(`• ${chalk.underline(urlMatch[0])}`);
        } else {
          console.log(`• ${ref}`);
        }
      });
    }

    // Best practices
    if (bestPractices.length > 0) {
      if (docRefs.length > 0) console.log(""); // Add spacing if we already showed docs

      // Show only the first best practice
      console.log(`Pro tip: ${bestPractices[0]}`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // FOOTER: What to do next
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(divider);
  console.log(chalk.bold("NEXT STEPS"));
  console.log(
    `• Run ${chalk.cyan("chat")} command to interactively explore this analysis`
  );
  console.log(
    `• Add ${chalk.cyan(
      "--output filename.json"
    )} to save full analysis details`
  );

  // End marker
  console.log(divider);
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
