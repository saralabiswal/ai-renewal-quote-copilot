import OpenAI from 'openai'
import type { AiGenerationMode } from './types'

type LiveAiProvider = Extract<AiGenerationMode, 'OPENAI' | 'OLLAMA'>

type AiClientConfig = {
  client: OpenAI
  cacheKey: string
  model: string
  mode: LiveAiProvider
}

let singleton: AiClientConfig | null = null

function normalizeProvider(value: string | undefined): LiveAiProvider {
  return value?.trim().toUpperCase() === 'OLLAMA' ? 'OLLAMA' : 'OPENAI'
}

export function getAiProvider(): LiveAiProvider {
  return normalizeProvider(process.env.AI_PROVIDER)
}

export function getAiModel() {
  if (getAiProvider() === 'OLLAMA') {
    return process.env.OLLAMA_MODEL || 'llama3.1'
  }

  return process.env.OPENAI_MODEL || 'gpt-5.3'
}

export function getAiClient(): AiClientConfig | null {
  const provider = getAiProvider()
  const model = getAiModel()
  const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1'
  const apiKey =
    provider === 'OLLAMA' ? process.env.OLLAMA_API_KEY || 'ollama' : process.env.OPENAI_API_KEY
  const cacheKey = `${provider}|${model}|${baseURL}|${apiKey ?? ''}`

  if (singleton?.cacheKey === cacheKey) {
    return singleton
  }

  if (provider === 'OLLAMA') {
    singleton = {
      client: new OpenAI({
        apiKey,
        baseURL,
      }),
      cacheKey,
      model,
      mode: 'OLLAMA',
    }
    return singleton
  }

  if (!apiKey) return null

  singleton = {
    client: new OpenAI({ apiKey }),
    cacheKey,
    model,
    mode: 'OPENAI',
  }
  return singleton
}
