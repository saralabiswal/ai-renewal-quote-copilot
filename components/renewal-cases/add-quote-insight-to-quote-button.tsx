'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type InsightType =
  | 'RENEW_AS_IS'
  | 'CONCESSION'
  | 'MARGIN_RECOVERY'
  | 'DEFENSIVE_RENEWAL'
  | 'UPLIFT_RESTRAINT'
  | 'CROSS_SELL'
  | 'EXPANSION'
  | string

function isAdditiveInsight(insightType: InsightType) {
  return (
    insightType === 'CROSS_SELL' ||
    insightType === 'EXPANSION' ||
    insightType === 'HYBRID_DEPLOYMENT_FIT' ||
    insightType === 'DATA_MODERNIZATION'
  )
}

export function AddQuoteInsightToQuoteButton({
  caseId,
  quoteInsightId,
  insightType,
}: {
  caseId: string
  quoteInsightId: string
  insightType: InsightType
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isAdditive = useMemo(() => isAdditiveInsight(insightType), [insightType])

  const buttonLabel = useMemo(() => {
    return isAdditive ? 'Add to Quote' : 'Apply to Renewal Line'
  }, [isAdditive])

  const loadingLabel = useMemo(() => {
    return isAdditive ? 'Adding to Quote...' : 'Applying to Renewal Line...'
  }, [isAdditive])

  const buttonClassName = useMemo(() => {
    return isAdditive ? 'button-add-quote' : 'button-apply-renewal-line'
  }, [isAdditive])

  const actionNote = useMemo(() => {
    return isAdditive ? 'Adds a new line to the quote.' : 'Updates the existing renewal line.'
  }, [isAdditive])

  async function handleClick() {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(
        `/api/renewal-cases/${caseId}/quote-insights/${quoteInsightId}/add-to-quote`,
        {
          method: 'POST',
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to apply quote insight.')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={buttonClassName}
      >
        {isLoading ? loadingLabel : buttonLabel}
      </button>

      {!error ? <div className="small muted action-intent-note">{actionNote}</div> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
