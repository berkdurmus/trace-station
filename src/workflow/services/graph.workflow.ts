import { WorkflowState } from "../interfaces";
import {
  TraceAnalysisAgent,
  ContextAgent,
  DiagnosisAgent,
  RecommendationAgent,
} from "@/agents";
import { PlaywrightDocs } from "@/trace/classes/playwright.docs.class";

/**
 * Creates a workflow for processing and analyzing trace data
 * @param apiKey API key for agent services
 * @param verbose Whether to show detailed documentation processing logs
 * @param options Additional options for workflow creation
 * @returns A callable workflow function
 */
export function createWorkflow(
  apiKey?: string,
  verbose: boolean = false,
  options: {
    disableRag?: boolean;
  } = {}
) {
  // Create PlaywrightDocs instance only if RAG is not disabled
  const playwrightDocs = options.disableRag
    ? undefined
    : new PlaywrightDocs(process.env.OPENAI_API_KEY, verbose);

  // Log RAG status
  console.log(
    `[Workflow] RAG is ${options.disableRag ? "disabled" : "enabled"}`
  );

  // Create agents with verbosity setting
  const traceAnalysisAgent = new TraceAnalysisAgent(apiKey);
  const contextAgent = new ContextAgent(
    apiKey,
    verbose,
    undefined,
    playwrightDocs // This will be undefined if RAG is disabled
  );
  const diagnosisAgent = new DiagnosisAgent(apiKey);
  const recommendationAgent = new RecommendationAgent(apiKey);

  // Return a workflow function that processes trace data sequentially
  return async function processTrace(
    initialState: WorkflowState
  ): Promise<WorkflowState> {
    const state: WorkflowState = { ...initialState };

    try {
      // Initialize documentation if RAG is enabled
      if (playwrightDocs) {
        if (verbose) {
          console.log("[Workflow] Initializing documentation for RAG...");
        }
        await playwrightDocs.initialize();
      } else {
        console.log(
          "[Workflow] RAG is disabled. Skipping documentation initialization."
        );
      }

      // Step 1: Analyze trace
      console.log("Analyzing trace...");
      state.analysis = await traceAnalysisAgent.process({
        trace: state.trace,
      });

      // Step 2: Gather context
      console.log("Gathering context...");
      state.context = await contextAgent.process({
        trace: state.trace,
        context: {
          analysis: state.analysis,
        },
      });

      // Step 3: Diagnose issue
      console.log("Diagnosing issue...");
      state.diagnosis = await diagnosisAgent.process({
        trace: state.trace,
        context: {
          analysis: state.analysis,
          context: state.context,
        },
      });

      // Step 4: Generate recommendations
      console.log("Generating recommendations...");
      state.recommendation = await recommendationAgent.process({
        trace: state.trace,
        context: {
          analysis: state.analysis,
          context: state.context,
          diagnosis: state.diagnosis,
        },
      });

      return state;
    } catch (error: unknown) {
      console.error("Error in workflow:", error);
      state.error = error instanceof Error ? error.message : String(error);
      return state;
    }
  };
}
