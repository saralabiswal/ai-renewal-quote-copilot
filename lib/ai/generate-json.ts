import { getAiClient, getAiModel } from '@/lib/ai/client'
import { isOpenAiMockModeEnabled } from '@/lib/ai/mock-mode'

export type AiJsonResult<T> = {
  ok: boolean
  mode: 'OPENAI' | 'OLLAMA' | 'FALLBACK'
  modelLabel: string
  value: T | null
  error: string | null
  rawText: string | null
}

function timeoutMs() {
  const parsed = Number(process.env.LLM_JSON_TIMEOUT_MS ?? 3500)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3500
}

function extractJson(text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}

export async function generateJson<T>(args: {
  instructions: string
  input: unknown
  fallbackLabel: string
}): Promise<AiJsonResult<T>> {
  const model = getAiModel()

  if (isOpenAiMockModeEnabled()) {
    return {
      ok: false,
      mode: 'FALLBACK',
      modelLabel: `${model}-mock-json-disabled`,
      value: null,
      error: 'Mock mode uses deterministic JSON shadow output.',
      rawText: null,
    }
  }

  const runtime = getAiClient()
  if (!runtime) {
    return {
      ok: false,
      mode: 'FALLBACK',
      modelLabel: args.fallbackLabel,
      value: null,
      error: 'No live LLM runtime is configured.',
      rawText: null,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs())

  try {
    const response = await runtime.client.chat.completions.create(
      {
        model: runtime.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: args.instructions,
          },
          {
            role: 'user',
            content: JSON.stringify(args.input),
          },
        ],
      },
      { signal: controller.signal },
    )

    const rawText = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(extractJson(rawText)) as T

    return {
      ok: true,
      mode: runtime.mode,
      modelLabel: runtime.model,
      value: parsed,
      error: null,
      rawText,
    }
  } catch (error) {
    return {
      ok: false,
      mode: runtime.mode,
      modelLabel: runtime.model,
      value: null,
      error: error instanceof Error ? error.message : 'Unable to generate valid JSON.',
      rawText: null,
    }
  } finally {
    clearTimeout(timer)
  }
}
