import { ChatOpenAI } from '@langchain/openai'
import type { ProviderConfig } from '../types'

// try to catch OpenAI API errors (like 20015) in the response body, and throw them as exceptions to be handled by the caller
const customFetchIntercept = async (url: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(url, init);
    
    if (!response.ok) {
        let errorText = '';
        try {
            errorText = await response.clone().text();
        } catch (e) {
            // if cannot parse error text, just ignore and throw generic error
        }
        
        if (errorText) {
            throw new Error(`[API_ERROR_INTERCEPTED] ${errorText}`);
        }
    }
    
    return response;
};

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
        maxRetries: 0, // Disable retries to surface errors immediately
        configuration: { 
            baseURL: config.baseUrl,
            fetch: customFetchIntercept
        },
        temperature: 0.7,
        streaming: true
    })
}