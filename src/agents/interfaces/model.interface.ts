import { ChatAnthropic } from "@langchain/anthropic";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";

/**
 * Interface for a language model provider
 */
export interface ILanguageModelProvider {
  /**
   * Creates a runnable sequence for processing prompts
   * @param prompt The prompt template to use
   * @returns A runnable sequence
   */
  createChain(prompt: PromptTemplate): RunnableSequence;

  /**
   * Gets the underlying model instance
   */
  getModel(): any;
}

/**
 * Implementation of ILanguageModelProvider for Anthropic Claude models
 */
export class AnthropicModelProvider implements ILanguageModelProvider {
  private model: ChatAnthropic;

  constructor(
    apiKey?: string,
    // modelName: string = "claude-3-5-sonnet-20240620",
    modelName: string = "claude-3-7-sonnet-latest",
    temperature: number = 0
  ) {
    this.model = new ChatAnthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      temperature,
      maxTokens: 4000,
      model: modelName,
    });
  }

  createChain(prompt: PromptTemplate): RunnableSequence {
    return RunnableSequence.from([
      prompt,
      this.model,
      new StringOutputParser(),
    ]);
  }

  getModel(): ChatAnthropic {
    return this.model;
  }
}

/**
 * Factory for creating model providers
 */
export class ModelProviderFactory {
  /**
   * Creates a model provider of the specified type
   * @param providerType The type of provider to create
   * @param apiKey Optional API key
   * @param options Additional provider options
   * @returns A language model provider
   */
  static createProvider(
    providerType: "anthropic" | string = "anthropic",
    apiKey?: string,
    options: {
      modelName?: string;
      temperature?: number;
    } = {}
  ): ILanguageModelProvider {
    switch (providerType) {
      case "anthropic":
      default:
        return new AnthropicModelProvider(
          apiKey,
          options.modelName,
          options.temperature
        );
    }
  }
}
