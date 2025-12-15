import type { Provider, ProviderConfig } from './types'

export const PROVIDER_DEFAULTS: Record<Provider, Omit<ProviderConfig, 'apiKey'>> = {
    openai: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini'
    },
    anthropic: {
        model: 'claude-sonnet-4-20250514'
    },
    google: {
        model: 'gemini-2.0-flash'
    },
    openrouter: {
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini'
    },
    siliconflow: {
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'Qwen/Qwen2.5-7B-Instruct'
    },
    qwen: {
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-turbo'
    },
    deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat'
    }
}

export const PROVIDER_MODELS: Record<Provider, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    google: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    openrouter: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-sonnet-4-20250514', 'google/gemini-2.0-flash-001'],
    siliconflow: ['Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner']
}

export const PROVIDER_LABELS: Record<Provider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
    openrouter: 'OpenRouter',
    siliconflow: 'SiliconFlow',
    qwen: 'Qwen (阿里云)',
    deepseek: 'Deepseek'
}

export const DEFAULT_PROVIDER: Provider = 'openai'

export const STORAGE_KEYS = {
    settings: 'xzzdpro_assistant_settings',
    chatHistory: 'xzzdpro_assistant_chat_'
} as const

export const MAX_CONTEXT_LENGTH = 8000
export const MAX_HISTORY_MESSAGES = 50
