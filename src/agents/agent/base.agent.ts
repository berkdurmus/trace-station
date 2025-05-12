import { AgentInput, ILanguageModelProvider } from "@/agents";
import { AgentOutput } from "../interfaces/agent.interface";
import { ModelProviderFactory } from "../interfaces";
import { PromptTemplate } from "@langchain/core/prompts";

export abstract class BaseAgent<T extends AgentOutput> {
  protected modelProvider: ILanguageModelProvider;
  protected systemPrompt: string;

  constructor(
    systemPrompt: string,
    modelProvider?: ILanguageModelProvider,
    apiKey?: string
  ) {
    this.systemPrompt = systemPrompt;
    // Use provided model provider or create default one
    this.modelProvider =
      modelProvider || ModelProviderFactory.createProvider("anthropic", apiKey);
  }

  abstract formatInput(input: AgentInput): Promise<string>;
  abstract parseOutput(output: string): Promise<T>;

  async process(input: AgentInput): Promise<T> {
    let formattedInput = await this.formatInput(input);

    // Escape any curly braces in the input to avoid template parsing errors
    formattedInput = formattedInput.replace(/\{/g, "{{").replace(/\}/g, "}}");

    // Use a simple template with no variables since we've already formatted the input
    const prompt = PromptTemplate.fromTemplate("{input}");
    const chain = this.modelProvider.createChain(prompt);

    const result = await chain.invoke({ input: formattedInput });
    return this.parseOutput(result);
  }
}
