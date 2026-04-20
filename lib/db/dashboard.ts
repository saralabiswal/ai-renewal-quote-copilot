import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { labelize } from '@/lib/format/risk'
import type { DashboardData } from '@/types/dashboard'

function scenarioLabel(
  action: string | null | undefined,
  approvalRequired: boolean,
  riskLevel: string | null | undefined,
) {
  if (action === 'EXPAND') return 'Expansion Opportunity'
  if (action === 'CROSS_SELL') return 'Cross-Sell Opportunity'
  if (action === 'MARGIN_RECOVERY') return 'Margin Recovery'
  if (action === 'CONTROLLED_UPLIFT') return 'Controlled Uplift'
  if (action === 'ESCALATE') return 'Executive Escalation'
  if (action === 'MIXED_ACTION_PLAN') return 'Mixed Action Plan'
  if (action === 'RENEW_WITH_CONCESSION') return 'Retention Concession'
  if (action === 'DEFENSIVE_RENEWAL') return 'Defensive Renewal'
  if (riskLevel === 'LOW' && !approvalRequired) return 'Low-Risk Renewal'
  return 'Standard Review'
}

function urgencyScore(input: {
  riskLevel: string | null | undefined
  recommendedAction: string | null | undefined
  requiresApproval: boolean
  openEscalationCount: number
}) {
  let score = 0
  if (input.riskLevel === 'HIGH') score += 100
  if (input.riskLevel === 'MEDIUM') score += 50
  if (input.recommendedAction === 'ESCALATE') score += 60
  if (input.requiresApproval) score += 40
  score += input.openEscalationCount * 5
  return score
}

export async function getDashboardData(): Promise<DashboardData> {
  const [cases, reviews] = await Promise.all([
    prisma.renewalCase.findMany({
      include: {
        account: true,
      },
    }),
    prisma.reviewDecision.findMany({
      include: {
        renewalCase: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const sortedCases = [...cases].sort((a, b) => {
    const aScore = urgencyScore({
      riskLevel: a.riskLevel,
      recommendedAction: a.recommendedAction,
      requiresApproval: a.requiresApproval,
      openEscalationCount: Number(a.account.openEscalationCount ?? 0),
    })
    const bScore = urgencyScore({
      riskLevel: b.riskLevel,
      recommendedAction: b.recommendedAction,
      requiresApproval: b.requiresApproval,
      openEscalationCount: Number(b.account.openEscalationCount ?? 0),
    })
    return bScore - aScore
  })

  const currentArrTotal = cases.reduce((sum, item) => sum + Number(item.bundleCurrentArr), 0)
  const proposedArrTotal = cases.reduce((sum, item) => sum + Number(item.bundleProposedArr), 0)
  const delta = proposedArrTotal - currentArrTotal

  return {
    metrics: [
      { label: 'Bundled Renewal Cases', value: String(cases.length) },
      {
        label: 'High-Risk Cases',
        value: String(cases.filter((c) => c.riskLevel === 'HIGH').length),
      },
      {
        label: 'Approval Required',
        value: String(cases.filter((c) => c.requiresApproval).length),
      },
      {
        label: 'Expansion Opportunities',
        value: String(cases.filter((c) => c.recommendedAction === 'EXPAND').length),
      },
      {
        label: 'Current ARR',
        value: formatCurrency(currentArrTotal, 'USD'),
      },
      {
        label: 'Proposed ARR',
        value: formatCurrency(proposedArrTotal, 'USD'),
      },
      {
        label: 'ARR Delta',
        value: formatCurrency(delta, 'USD'),
      },
    ],
    needsAttention: sortedCases.slice(0, 3).map((item) => ({
      id: item.id,
      caseNumber: item.caseNumber,
      accountName: item.account.name,
      scenarioLabel: scenarioLabel(item.recommendedAction, item.requiresApproval, item.riskLevel),
      recommendedActionLabel: labelize(item.recommendedAction),
      riskLevel: labelize(item.riskLevel),
      bundleProposedArrFormatted: formatCurrency(Number(item.bundleProposedArr), item.account.billingCurrency),
      requiresApproval: item.requiresApproval,
    })),
    caseTable: sortedCases.map((item) => ({
      id: item.id,
      caseNumber: item.caseNumber,
      accountName: item.account.name,
      scenarioLabel: scenarioLabel(item.recommendedAction, item.requiresApproval, item.riskLevel),
      recommendedActionLabel: labelize(item.recommendedAction),
      riskLevel: labelize(item.riskLevel),
      bundleCurrentArrFormatted: formatCurrency(Number(item.bundleCurrentArr), item.account.billingCurrency),
      bundleProposedArrFormatted: formatCurrency(Number(item.bundleProposedArr), item.account.billingCurrency),
      requiresApproval: item.requiresApproval,
      statusLabel: labelize(item.status),
    })),
    recentReviewActivity: reviews.map((item) => ({
      id: item.id,
      decisionLabel: labelize(item.decision),
      accountName: item.renewalCase.account.name,
      caseNumber: item.renewalCase.caseNumber,
      reviewerName: item.reviewerName ?? 'Unassigned',
      createdAtLabel: new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(item.createdAt)),
      comment: item.comment,
    })),
  }
}
