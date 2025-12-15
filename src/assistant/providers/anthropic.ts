import { ChatAnthropic } from '@langchain/anthropic'
import type { ProviderConfig } from '../types'

export function createAnthropicModel(config: ProviderConfig): ChatAnthropic {
    return new ChatAnthropic({
        anthropicApiKey: config.apiKey,
        modelName: config.model,
        temperature: 0.7,
        streaming: true
    })
}
