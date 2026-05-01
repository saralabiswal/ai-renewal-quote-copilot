import { strict as assert } from 'node:assert'
import {
  type DecisionCandidateEnvelope,
  DECISION_CANDIDATE_VERSION,
} from '../lib/decision/candidates'
import {
  type GuardedDecisionProposal,
  validateGuardedDecisionProposal,
  VALIDATION_RESULT_VERSION,
} from '../lib/decision/guarded-validator'
import {
  EVIDENCE_SNAPSHOT_VERSION,
  type RenewalEvidenceSnapshot,
} from '../lib/evidence/renewal-evidence'

function makeEvidenceSnapshot(
  overrides: Partial<RenewalEvidenceSnapshot['quality']> = {},
): RenewalEvidenceSnapshot {
  const quality = {
    signalCount: 4,
    currentCount: 4,
    staleCount: 0,
    missingCount: 0,
    completenessScore: 100,
    confidenceScore: 95,
    ...overrides,
  }

  return {
    evidenceSnapshotVersion: EVIDENCE_SNAPSHOT_VERSION,
    generatedAt: '2026-04-30T00:00:00.000Z',
    scenarioKey: 'BASE_CASE',
    quality,
    account: {
      id: 'acct_test',
      segment: 'ENTERPRISE',
      healthScore: 88,
      openEscalationCount: 0,
    },
    signals: [
      {
        evidenceRef: 'account.segment',
        subjectType: 'ACCOUNT',
        subjectId: 'acct_test',
        signalKey: 'account.segment',
        label: 'Account Segment',
        value: 'ENTERPRISE',
        unit: null,
        sourceSystem: 'Account Profile',
        observedAt: '2026-04-30T00:00:00.000Z',
        freshnessStatus: 'CURRENT',
        confidence: 0.95,
        lineage: 'RenewalCase.account',
      },
      {
        evidenceRef: 'item.item_test.metric.usage_percent',
        subjectType: 'RENEWAL_CASE_ITEM',
        subjectId: 'item_test',
        signalKey: 'usage_percent',
        label: 'Usage Percent of Entitlement',
        value: 91,
        unit: 'percent',
        sourceSystem: 'Subscription Telemetry',
        observedAt: '2026-04-30T00:00:00.000Z',
        freshnessStatus: quality.staleCount > 0 ? 'STALE' : 'CURRENT',
        confidence: quality.staleCount > 0 ? 0.55 : 0.95,
        lineage: 'SubscriptionMetricSnapshot',
      },
      {
        evidenceRef: 'item.item_test.metric.payment_risk_band',
        subjectType: 'RENEWAL_CASE_ITEM',
        subjectId: 'item_test',
        signalKey: 'payment_risk_band',
        label: 'Payment Risk Band',
        value: 'LOW',
        unit: null,
        sourceSystem: 'Subscription Telemetry',
        observedAt: '2026-04-30T00:00:00.000Z',
        freshnessStatus: 'CURRENT',
        confidence: 0.95,
        lineage: 'SubscriptionMetricSnapshot',
      },
      {
        evidenceRef: 'item.item_test.commercial.final_disposition',
        subjectType: 'RENEWAL_CASE_ITEM',
        subjectId: 'item_test',
        signalKey: 'final_disposition',
        label: 'Final Disposition',
        value: 'EXPAND',
        unit: null,
        sourceSystem: 'Decision Runtime',
        observedAt: '2026-04-30T00:00:00.000Z',
        freshnessStatus: 'CURRENT',
        confidence: 0.95,
        lineage: 'RenewalCaseEngineOutput',
      },
    ],
  }
}

function makeCandidateEnvelope(): DecisionCandidateEnvelope {
  return {
    candidateVersion: DECISION_CANDIDATE_VERSION,
    generatedAt: '2026-04-30T00:00:00.000Z',
    ruleWinner: 'EXPAND',
    allowedCandidates: ['EXPAND', 'RENEW_AS_IS'],
    blockedCandidates: ['ESCALATE'],
    candidates: [
      {
        candidateId: 'bundle_case_expand',
        scope: 'BUNDLE_RECOMMENDATION',
        subjectId: 'case_test',
        candidateType: 'EXPAND',
        eligibility: 'ALLOWED',
        score: 88,
        reasonCodes: ['EXPANSION_ELIGIBLE'],
        evidenceRefs: ['account.segment', 'item.item_test.metric.usage_percent'],
        policyRefs: ['recommendation-engine-v1'],
        selectedByRules: true,
        blockedReason: null,
      },
      {
        candidateId: 'bundle_case_escalate',
        scope: 'BUNDLE_RECOMMENDATION',
        subjectId: 'case_test',
        candidateType: 'ESCALATE',
        eligibility: 'BLOCKED',
        score: 20,
        reasonCodes: ['NO_ESCALATION_TRIGGER'],
        evidenceRefs: ['account.segment'],
        policyRefs: ['recommendation-engine-v1'],
        selectedByRules: false,
        blockedReason: 'No high-risk or approval trigger was present.',
      },
    ],
  }
}

function proposal(overrides: Partial<GuardedDecisionProposal> = {}): GuardedDecisionProposal {
  return {
    proposalSource: 'LLM_ASSISTED_GUARDED',
    selectedCandidate: 'EXPAND',
    confidence: 91,
    reasonCodes: ['EXPANSION_ELIGIBLE'],
    evidenceRefs: ['account.segment', 'item.item_test.metric.usage_percent'],
    ...overrides,
  }
}

const candidates = makeCandidateEnvelope()

const accepted = validateGuardedDecisionProposal({
  proposal: proposal(),
  candidates,
  evidenceSnapshot: makeEvidenceSnapshot(),
})
assert.equal(accepted.validationVersion, VALIDATION_RESULT_VERSION)
assert.equal(accepted.status, 'PASSED')
assert.equal(accepted.acceptedCandidate, 'EXPAND')
assert.equal(accepted.fallbackUsed, false)

const blockedCandidate = validateGuardedDecisionProposal({
  proposal: proposal({ selectedCandidate: 'ESCALATE' }),
  candidates,
  evidenceSnapshot: makeEvidenceSnapshot(),
})
assert.equal(blockedCandidate.status, 'REJECTED')
assert.equal(blockedCandidate.acceptedCandidate, 'EXPAND')
assert.equal(blockedCandidate.fallbackUsed, true)
assert.ok(blockedCandidate.rejectionReasons.some((reason) => reason.includes('allowedCandidates')))

const badEvidenceRef = validateGuardedDecisionProposal({
  proposal: proposal({ evidenceRefs: ['unsupported.evidence.ref'] }),
  candidates,
  evidenceSnapshot: makeEvidenceSnapshot(),
})
assert.equal(badEvidenceRef.status, 'REJECTED')
assert.equal(badEvidenceRef.fallbackUsed, true)
assert.ok(
  badEvidenceRef.rejectionReasons.some((reason) =>
    reason.includes('evidence references were not present'),
  ),
)

const cappedConfidence = validateGuardedDecisionProposal({
  proposal: proposal({ confidence: 99 }),
  candidates,
  evidenceSnapshot: makeEvidenceSnapshot({
    currentCount: 0,
    staleCount: 1,
    missingCount: 1,
    completenessScore: 70,
    confidenceScore: 70,
  }),
})
assert.equal(cappedConfidence.status, 'PASSED')
assert.equal(cappedConfidence.confidence, 55)
assert.ok(cappedConfidence.checks.some((check) => check.name === 'EvidenceFreshness'))
assert.ok(cappedConfidence.checks.some((check) => check.name === 'EvidenceCompleteness'))

console.log('Guarded decisioning validator checks passed.')
