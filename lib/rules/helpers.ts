export function toNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  if (typeof value === 'object' && value && 'toString' in (value as Record<string, unknown>)) {
    const parsed = Number(String(value))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function riskLevelFromScore(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 70) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
