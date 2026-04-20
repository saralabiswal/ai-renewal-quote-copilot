import OpenAI from 'openai'

let singleton: OpenAI | null = null

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  if (!singleton) {
    singleton = new OpenAI({ apiKey })
  }

  return singleton
}

export function getAiModel() {
  return process.env.OPENAI_MODEL || 'gpt-5.3'
}
