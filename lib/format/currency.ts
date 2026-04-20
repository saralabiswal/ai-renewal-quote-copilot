export function formatCurrency(value: number | string | null | undefined, currency = 'USD') {
  const amount = typeof value === 'string' ? Number(value) : value ?? 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}
