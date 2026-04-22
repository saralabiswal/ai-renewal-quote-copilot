'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useActionFeedback } from '@/components/ui/use-action-feedback'

export function RegenerateInsightsAiButton({
  caseId,
  label = 'Regenerate Insights + AI Rationale',
  loadingLabel = 'Regenerating Insights + AI Rationale...',
  buttonClassName = 'button-link',
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

      const response = await fetch(
        `/api/renewal-cases/${caseId}/regenerate-insights-ai`,
        { method: 'POST' },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to regenerate insights with AI rationale.')
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
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-busy={isLoading}
        className={`${buttonClassName} action-feedback-button${isLoading ? ' is-loading' : ''}${
          didSucceed ? ' is-success' : ''
        }`}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {isLoading ? loadingLabel : label}
      </button>

      {!error ? (
        <div className="small muted">
          One click refresh of quote insights and AI rationale.
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
