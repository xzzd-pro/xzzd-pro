import { ChatOpenAI } from '@langchain/openai'
import type { ProviderConfig } from '../types'

export function createOpenAIModel(config: ProviderConfig): ChatOpenAI {
    if (!config.apiKey) {
        throw new Error('API Key is missing for OpenAI provider')
    }
    if (!config.model || config.model.trim() === '') {
        throw new Error('Model name is missing for OpenAI provider')
    }
    return new ChatOpenAI({
        openAIApiKey: config.apiKey,
        apiKey: config.apiKey, // Redundant but safe
        modelName: config.model,
        configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
        temperature: 0.7,
        streaming: true
    })
}

export function createOpenAICompatibleModel(config: ProviderConfig): ChatOpenAI {
    if (!config.apiKey) {
        throw new Error('API Key is missing for OpenAI Compatible provider')
    }
    if (!config.model || config.model.trim() === '') {
        throw new Error('Model name is missing for OpenAI Compatible provider')
    }
    if (!config.baseUrl || config.baseUrl.trim() === '') {
        throw new Error('Base URL is required for OpenAI Compatible provider')
    }
    return new ChatOpenAI({
        openAIApiKey: config.apiKey,
        apiKey: config.apiKey, // Redundant but safe
        modelName: config.model,
        configuration: { baseURL: config.baseUrl },
        temperature: 0.7,
        streaming: true
    })
}
