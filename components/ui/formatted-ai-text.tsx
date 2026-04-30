import { sanitizeAiText } from '@/lib/ai/text-format'

export function FormattedAiText({ text }: { text: string }) {
  return <>{sanitizeAiText(text)}</>
}
