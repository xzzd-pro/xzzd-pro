import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { Provider, ProviderConfig } from '../types'
import { createOpenAIModel, createOpenAICompatibleModel } from './openai'
import { createAnthropicModel } from './anthropic'
import { createGoogleModel } from './google'

export function createChatModel(provider: Provider, config: ProviderConfig): BaseChatModel {
    switch (provider) {
        case 'openai':
            return createOpenAIModel(config)
        case 'anthropic':
            return createAnthropicModel(config)
        case 'google':
            return createGoogleModel(config)
        case 'openrouter':
        case 'siliconflow':
        case 'qwen':
        case 'deepseek':
            return createOpenAICompatibleModel(config)
        default:
            throw new Error(`Unsupported provider: ${provider}`)
    }
}

export { createOpenAIModel, createOpenAICompatibleModel } from './openai'
export { createAnthropicModel } from './anthropic'
export { createGoogleModel } from './google'
