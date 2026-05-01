import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import {
  signalDefinitionsForSnapshot,
  type RenewalEvidenceSnapshot,
} from '@/lib/evidence/renewal-evidence'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function safeDefinitionId(signalKey: string) {
  return `sig_${signalKey.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()}`
}

function dateOrNull(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function persistEvidenceSnapshot(args: {
  tx: Tx
  renewalCaseId: string
  decisionRunId?: string | null
  generatedBy: string
  snapshot: RenewalEvidenceSnapshot
}) {
  const definitions = signalDefinitionsForSnapshot(args.snapshot)

  const definitionIdsByKey = new Map<string, string>()
  for (const definition of definitions) {
    const id = safeDefinitionId(definition.signalKey)
    definitionIdsByKey.set(definition.signalKey, id)
    await args.tx.signalDefinition.upsert({
      where: { signalKey: definition.signalKey },
      update: {
        label: definition.label,
        dataType: definition.dataType,
        unit: definition.unit,
        validRangeJson: definition.validRange ? JSON.stringify(definition.validRange) : null,
        freshnessWindowDays: definition.freshnessWindowDays,
        sourceCategory: definition.sourceCategory,
        description: definition.description,
        isActive: true,
      },
      create: {
        id,
        signalKey: definition.signalKey,
        label: definition.label,
        dataType: definition.dataType,
        unit: definition.unit,
        validRangeJson: definition.validRange ? JSON.stringify(definition.validRange) : null,
        freshnessWindowDays: definition.freshnessWindowDays,
        sourceCategory: definition.sourceCategory,
        description: definition.description,
      },
    })
  }

  const evidenceSnapshot = await args.tx.evidenceSnapshot.create({
    data: {
      id: makeId('evs'),
      renewalCaseId: args.renewalCaseId,
      decisionRunId: args.decisionRunId ?? null,
      evidenceSnapshotVersion: args.snapshot.evidenceSnapshotVersion,
      scenarioKey: args.snapshot.scenarioKey,
      generatedBy: args.generatedBy,
      qualityJson: JSON.stringify(args.snapshot.quality),
      accountJson: JSON.stringify(args.snapshot.account),
      generatedAt: new Date(args.snapshot.generatedAt),
      observations: {
        create: args.snapshot.signals.map((signal) => ({
          id: makeId('sobs'),
          signalDefinitionId: definitionIdsByKey.get(signal.signalKey) ?? null,
          subjectType: signal.subjectType,
          subjectId: signal.subjectId,
          signalKey: signal.signalKey,
          valueJson: JSON.stringify(signal.value),
          unit: signal.unit,
          sourceSystem: signal.sourceSystem,
          observedAt: dateOrNull(signal.observedAt),
          freshnessStatus: signal.freshnessStatus,
          confidence: new Prisma.Decimal(signal.confidence),
          lineageJson: JSON.stringify({ lineage: signal.lineage, evidenceRef: signal.evidenceRef }),
        })),
      },
    },
    include: {
      observations: true,
    },
  })

  return evidenceSnapshot
}
