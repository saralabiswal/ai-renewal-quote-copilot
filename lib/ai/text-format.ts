export function sanitizeAiText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((rawLine) =>
      rawLine
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/\*\*([^*\n]+)\*\*/g, '$1')
        .replace(/__([^_\n]+)__/g, '$1')
        .replace(/^\s*\*\s+(?=\S)/, '- ')
        .trimEnd(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
