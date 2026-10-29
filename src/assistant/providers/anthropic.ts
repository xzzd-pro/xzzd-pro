import { ChatAnthropic } from "@langchain/anthropic"

import type { ProviderConfig } from "../types"

/**
 * Creates a streaming Anthropic chat model.
 * @param config API key and model name.
 * @returns LangChain chat model.
 */
export function createAnthropicModel(config: ProviderConfig): ChatAnthropic {
  return new ChatAnthropic({
    anthropicApiKey: config.apiKey,
    modelName: config.model,
    temperature: 0.7,
    streaming: true
  })
}
