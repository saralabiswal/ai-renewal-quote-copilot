import type { AiTextResult } from './types'

export function fallbackResult(content: string, label = 'rule-engine-fallback-v1'): AiTextResult {
  return {
    mode: 'FALLBACK',
    modelLabel: label,
    content,
  }
}
