import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { ProviderConfig } from '../types'

export function createGoogleModel(config: ProviderConfig): ChatGoogleGenerativeAI {
    return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0.7,
        streaming: true
    })
}
