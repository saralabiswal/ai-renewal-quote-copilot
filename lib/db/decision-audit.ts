import { prisma } from '@/lib/prisma'
import { verifyDecisionRunReplay } from '@/lib/decision/replay-verifier'

export async function getLatestDecisionAuditPacket(caseId: string) {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseNumber: true,
      recommendedAction: true,
      riskScore: true,
      riskLevel: true,
      requiresApproval: true,
      account: {
        select: {
          id: true,
          accountNumber: true,
          name: true,
          segment: true,
          industry: true,
        },
      },
      decisionRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          evidenceSnapshot: {
            include: {
              observations: {
                orderBy: { signalKey: 'asc' },
              },
            },
          },
        },
      },
      reviewDecisions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!renewalCase) {
    throw new Error(`Renewal case ${caseId} not found.`)
  }

  const latestRun = renewalCase.decisionRuns[0] ?? null

  return {
    auditPacketVersion: 'decision-audit-packet-v1',
    exportedAt: new Date().toISOString(),
    case: {
      id: renewalCase.id,
      caseNumber: renewalCase.caseNumber,
      account: renewalCase.account,
      finalState: {
        recommendedAction: renewalCase.recommendedAction,
        riskScore: renewalCase.riskScore,
        riskLevel: renewalCase.riskLevel,
        requiresApproval: renewalCase.requiresApproval,
      },
    },
    decisionRun: latestRun,
    replay: latestRun?.replayMetadataJson ? JSON.parse(latestRun.replayMetadataJson) : null,
    replayVerification: latestRun ? verifyDecisionRunReplay(latestRun) : null,
    telemetry: latestRun?.telemetryJson ? JSON.parse(latestRun.telemetryJson) : null,
    governance: latestRun?.governanceJson ? JSON.parse(latestRun.governanceJson) : null,
    reviewDecisions: renewalCase.reviewDecisions,
  }
}
