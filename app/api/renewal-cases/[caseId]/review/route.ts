import { NextResponse } from 'next/server'
import { submitReviewDecisionByCaseId } from '@/lib/db/submit-review-decision'

const allowedDecisions = new Set(['APPROVE', 'REJECT', 'REQUEST_REVISION'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params
    const body = await request.json().catch(() => ({}))
    const decision = typeof body?.decision === 'string' ? body.decision : ''
    const comment = typeof body?.comment === 'string' ? body.comment : null

    if (!allowedDecisions.has(decision)) {
      return NextResponse.json(
        { error: 'Invalid review decision.' },
        { status: 400 },
      )
    }

    const result = await submitReviewDecisionByCaseId({
      caseId,
      decision: decision as 'APPROVE' | 'REJECT' | 'REQUEST_REVISION',
      comment,
    })

    return NextResponse.json({ ok: true, quoteDraft: result })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to submit review decision.',
      },
      { status: 500 },
    )
  }
}
