'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useActionFeedback } from '@/components/ui/use-action-feedback'

export function GenerateQuoteScenariosButton({
  caseId,
  label = 'Generate Quote Scenarios',
  loadingLabel = 'Generating Quote Scenarios...',
  buttonClassName = 'button-secondary',
}: {
  caseId: string
  label?: string
  loadingLabel?: string
  buttonClassName?: string
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { didSucceed, flashSuccess } = useActionFeedback()

  async function handleClick() {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/renewal-cases/${caseId}/generate-quote-scenarios`, {
        method: 'POST',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to generate quote scenarios.')
      }

      flashSuccess()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        type="button"
        className={`${buttonClassName} action-feedback-button${isLoading ? ' is-loading' : ''}${
          didSucceed ? ' is-success' : ''
        }`}
        onClick={handleClick}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? loadingLabel : label}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
