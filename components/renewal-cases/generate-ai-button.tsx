'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function GenerateAiButton({
  caseId,
  label = 'Generate AI Review Guidance',
  loadingLabel = 'Generating AI Review Guidance...',
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

  async function handleClick() {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/renewal-cases/${caseId}/generate-ai`, {
        method: 'POST',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to generate AI guidance.')
      }

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
        className={buttonClassName}
        onClick={handleClick}
        disabled={isLoading}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {isLoading ? loadingLabel : label}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
