'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  caseId: string
  opportunityId: string
  isAddedToQuote?: boolean
}

export function AddOpportunityToQuoteButton({ caseId, opportunityId, isAddedToQuote = false }: Props) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(
        `/api/renewal-cases/${caseId}/opportunities/${opportunityId}/add-to-quote`,
        { method: 'POST' },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to add opportunity to quote.')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAddedToQuote) {
    return <span className="status-chip success">Added to Quote</span>
  }

  return (
    <div className="opportunity-action-stack">
      <button
        type="button"
        className="button-link"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? 'Adding…' : 'Add to Quote'}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
