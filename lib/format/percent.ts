export function formatPercent(
  value: number | string | null | undefined,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number },
) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const numericValue = typeof value === 'string' ? Number(value) : value

  if (!Number.isFinite(numericValue)) {
    return '—'
  }

  const maximumFractionDigits = options?.maximumFractionDigits ?? 2
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0

  return `${numericValue.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  })}%`
}