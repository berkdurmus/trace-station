import { ParsedTrace } from "@/trace";
import { WorkflowState } from "../interfaces";

export const createInitialState = (trace: ParsedTrace): WorkflowState => {
  return {
    trace,
    currentStep: "orchestration",
    taskResults: {},
  };
};
