import { AgentInput, ILanguageModelProvider } from "@/agents";
import { AgentOutput } from "../interfaces/agent.interface";
import { ModelProviderFactory } from "../interfaces";
import { PromptTemplate } from "@langchain/core/prompts";
import { ILLMCache, LLMCacheFactory } from "../interfaces/cache.interface";
import { createHash } from "crypto";

export abstract class BaseAgent<T extends AgentOutput> {
  protected modelProvider: ILanguageModelProvider;
  protected systemPrompt: string;
  protected cache: ILLMCache;
  protected enableCache: boolean = true;
  protected cacheTTL: number = 3600; // 1 hour by default

  constructor(
    systemPrompt: string,
    modelProvider?: ILanguageModelProvider,
    apiKey?: string,
    options: {
      enableCache?: boolean;
      cacheTTL?: number;
    } = {}
  ) {
    this.systemPrompt = systemPrompt;
    // Use provided model provider or create default one
    this.modelProvider =
      modelProvider || ModelProviderFactory.createProvider("anthropic", apiKey);

    // Initialize cache
    this.cache = LLMCacheFactory.getCache();

    // Set cache options
    if (options.enableCache !== undefined) {
      this.enableCache = options.enableCache;
    }

    if (options.cacheTTL !== undefined) {
      this.cacheTTL = options.cacheTTL;
    }
  }

  abstract formatInput(input: AgentInput): Promise<string>;
  abstract parseOutput(output: string): Promise<T>;

  /**
   * Generate a cache key for a given input
   * @param input The formatted input to generate a key for
   * @returns A hash of the input to use as cache key
   */
  protected generateCacheKey(input: string): string {
    return createHash("sha256").update(input).digest("hex");
  }

  async process(input: AgentInput): Promise<T> {
    let formattedInput = await this.formatInput(input);

    // Generate a cache key for this input
    const cacheKey = this.generateCacheKey(formattedInput);

    // Check cache first if enabled
    if (this.enableCache) {
      const cachedResult = await this.cache.get(cacheKey);
      if (cachedResult) {
        console.log(`Cache hit for ${input.context?.type || "agent"} request`);
        return this.parseOutput(cachedResult);
      }
    }

    // Escape any curly braces in the input to avoid template parsing errors
    formattedInput = formattedInput.replace(/\{/g, "{{").replace(/\}/g, "}}");

    // Use a simple template with no variables since we've already formatted the input
    const prompt = PromptTemplate.fromTemplate("{input}");
    const chain = this.modelProvider.createChain(prompt);

    const result = await chain.invoke({ input: formattedInput });

    // Cache the result if caching is enabled
    if (this.enableCache) {
      await this.cache.set(cacheKey, result, this.cacheTTL);
    }

    return this.parseOutput(result);
  }
}
