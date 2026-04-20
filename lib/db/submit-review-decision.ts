import { prisma } from '@/lib/prisma'

type ReviewDecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_REVISION'

const nextQuoteStatusByDecision: Record<ReviewDecisionType, string> = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  REQUEST_REVISION: 'REVISED',
}

export async function submitQuoteReviewDecision(params: {
  quoteDraftId: string
  decision: ReviewDecisionType
  comment?: string | null
  reviewerName?: string | null
}) {
  const quoteDraft = await prisma.quoteDraft.findUnique({
    where: { id: params.quoteDraftId },
    select: {
      id: true,
      quoteNumber: true,
      renewalCaseId: true,
    },
  })

  if (!quoteDraft) {
    throw new Error('Quote draft not found.')
  }

  const reviewerName = params.reviewerName?.trim() || 'dealdesk.lead@nimbussoft.demo'
  const decisionComment = params.comment?.trim() || null
  const now = new Date()

  const updatedQuoteDraft = await prisma.$transaction(async (tx) => {
    await tx.reviewDecision.create({
      data: {
        id: `rd_${quoteDraft.renewalCaseId}_${Date.now()}`,
        renewalCaseId: quoteDraft.renewalCaseId,
        decision: params.decision,
        reviewerName,
        comment: decisionComment,
        createdAt: now,
      },
    })

    return tx.quoteDraft.update({
      where: { id: quoteDraft.id },
      data: {
        status: nextQuoteStatusByDecision[params.decision],
        updatedAt: now,
      },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        renewalCaseId: true,
        updatedAt: true,
      },
    })
  })

  return updatedQuoteDraft
}

export async function submitReviewDecisionByCaseId(params: {
  caseId: string
  decision: ReviewDecisionType
  comment?: string | null
  reviewerName?: string | null
}) {
  const quoteDraft = await prisma.quoteDraft.findUnique({
    where: { renewalCaseId: params.caseId },
    select: {
      id: true,
    },
  })

  if (!quoteDraft) {
    throw new Error('No quote draft is linked to this renewal case yet.')
  }

  return submitQuoteReviewDecision({
    quoteDraftId: quoteDraft.id,
    decision: params.decision,
    comment: params.comment,
    reviewerName: params.reviewerName,
  })
}
