import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

import type { ProviderConfig } from "../types"

/**
 * Creates a streaming Google Gemini chat model.
 * @param config API key and model name.
 * @returns LangChain chat model.
 */
export function createGoogleModel(
  config: ProviderConfig
): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    apiKey: config.apiKey,
    model: config.model,
    temperature: 0.7,
    streaming: true
  })
}
