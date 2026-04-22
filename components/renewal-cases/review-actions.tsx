'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Decision = 'APPROVE' | 'REJECT' | 'REQUEST_REVISION'

const decisionLabel: Record<Decision, string> = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  REQUEST_REVISION: 'Request Revision',
}

const decisionClassName: Record<Decision, string> = {
  APPROVE: 'button-success',
  REQUEST_REVISION: 'button-warn',
  REJECT: 'button-danger',
}

export function ReviewActions({
  quoteDraftId,
  align = 'right',
}: {
  quoteDraftId: string
  align?: 'left' | 'right'
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<Decision | null>(null)
  const [activeSuccess, setActiveSuccess] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isRightAligned = align === 'right'

  async function submitDecision(decision: Decision) {
    const comment = window.prompt(`Optional comment for ${decisionLabel[decision]}:`) ?? ''

    try {
      setIsLoading(decision)
      setError(null)

      const response = await fetch(`/api/quote-drafts/${quoteDraftId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to submit review decision.')
      }

      setActiveSuccess(decision)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.')
    } finally {
      setIsLoading(null)
      setTimeout(() => {
        setActiveSuccess(null)
      }, 1000)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div
        className="small muted"
        style={{
          fontWeight: 600,
          textAlign: isRightAligned ? 'right' : 'left',
        }}
      >
        Quote Review Decision
      </div>

      <div
        className="actions"
        style={{
          flexWrap: 'wrap',
          justifyContent: isRightAligned ? 'flex-end' : 'flex-start',
          gap: 10,
        }}
      >
        <button
          type="button"
          className={`${decisionClassName.APPROVE} action-feedback-button${
            isLoading === 'APPROVE' ? ' is-loading' : ''
          }${activeSuccess === 'APPROVE' ? ' is-success' : ''}`}
          onClick={() => submitDecision('APPROVE')}
          disabled={isLoading !== null}
          aria-busy={isLoading === 'APPROVE'}
        >
          {isLoading === 'APPROVE' ? 'Approving...' : 'Approve'}
        </button>

        <button
          type="button"
          className={`${decisionClassName.REQUEST_REVISION} action-feedback-button${
            isLoading === 'REQUEST_REVISION' ? ' is-loading' : ''
          }${activeSuccess === 'REQUEST_REVISION' ? ' is-success' : ''}`}
          onClick={() => submitDecision('REQUEST_REVISION')}
          disabled={isLoading !== null}
          aria-busy={isLoading === 'REQUEST_REVISION'}
        >
          {isLoading === 'REQUEST_REVISION' ? 'Submitting...' : 'Request Revision'}
        </button>

        <button
          type="button"
          className={`${decisionClassName.REJECT} action-feedback-button${
            isLoading === 'REJECT' ? ' is-loading' : ''
          }${activeSuccess === 'REJECT' ? ' is-success' : ''}`}
          onClick={() => submitDecision('REJECT')}
          disabled={isLoading !== null}
          aria-busy={isLoading === 'REJECT'}
        >
          {isLoading === 'REJECT' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
