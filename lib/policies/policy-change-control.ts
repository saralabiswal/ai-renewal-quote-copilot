import {
  ACTIVE_POLICY_ARTIFACTS,
  POLICY_REGISTRY_ID,
  type PolicyArtifact,
} from '@/lib/policies/policy-runtime'

export const POLICY_CHANGE_CONTROL_VERSION = 'policy-change-control-v1'

export type PolicyChangeImpact = 'LOW' | 'MEDIUM' | 'HIGH'
export type PolicyApprovalStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'BLOCKED'

export type PolicyArtifactChange = {
  policyId: string
  label: string
  type: PolicyArtifact['type']
  owner: string
  currentVersion: string | null
  proposedVersion: string
  changeType: 'UNCHANGED' | 'VERSION_UPDATE' | 'NEW_POLICY' | 'OWNER_CHANGE' | 'SOURCE_CHANGE'
  impact: PolicyChangeImpact
  reviewerRole: string
  changeSummary: string
  sourceRefs: string[]
}

export type PolicyApprovalStep = {
  id: string
  label: string
  ownerRole: string
  status: PolicyApprovalStatus
  requiredForPromotion: boolean
  detail: string
}

export type PolicyChangeControlPlan = {
  changeControlVersion: typeof POLICY_CHANGE_CONTROL_VERSION
  tenantScope: string
  currentRegistryId: typeof POLICY_REGISTRY_ID
  proposedRegistryId: string
  proposedEffectiveDate: string
  generatedAt: string
  changes: PolicyArtifactChange[]
  approvalWorkflow: PolicyApprovalStep[]
  summary: {
    totalPolicies: number
    changedPolicies: number
    highImpactPolicies: number
    approvalsRequired: number
    promotionStatus: 'READY_FOR_REVIEW' | 'BLOCKED'
  }
}

export type PolicyPromotionPacket = {
  packetVersion: 'policy-promotion-packet-v1'
  exportedAt: string
  plan: PolicyChangeControlPlan
  promotionReadiness: {
    readyForPromotion: boolean
    blockedReasons: string[]
    requiredApproverRoles: string[]
    replayRequired: boolean
    tenantPromotionGate: string
  }
}

const PROPOSED_POLICY_ARTIFACTS: PolicyArtifact[] = ACTIVE_POLICY_ARTIFACTS.map((artifact) => {
  if (artifact.id === 'renewal-pricing-guardrail-policy') {
    return {
      ...artifact,
      version: '2026.3.0-draft',
      sourceRefs: [...artifact.sourceRefs, 'docs/planning/llm-guarded-decisioning-plan.md'],
    }
  }

  if (artifact.id === 'guarded-llm-validation-policy') {
    return {
      ...artifact,
      version: '2026.3.0-draft',
      sourceRefs: [...artifact.sourceRefs, 'lib/auth/role-controls.ts'],
    }
  }

  if (artifact.id === 'quote-insight-mapping-policy') {
    return {
      ...artifact,
      version: '2026.3.0-draft',
    }
  }

  return artifact
})

function changeSummary(current: PolicyArtifact | null, proposed: PolicyArtifact) {
  if (!current) return 'New policy artifact proposed for registry promotion.'
  if (current.owner !== proposed.owner) return 'Policy owner changed and requires governance review.'
  if (current.sourceRefs.join('|') !== proposed.sourceRefs.join('|')) {
    return 'Policy source references changed; deterministic execution and audit links must be reviewed.'
  }
  if (current.version !== proposed.version) {
    return 'Policy version update proposed; compare replay and workflow outcomes before promotion.'
  }
  return 'No proposed change from the active registry.'
}

function changeType(current: PolicyArtifact | null, proposed: PolicyArtifact): PolicyArtifactChange['changeType'] {
  if (!current) return 'NEW_POLICY'
  if (current.owner !== proposed.owner) return 'OWNER_CHANGE'
  if (current.sourceRefs.join('|') !== proposed.sourceRefs.join('|')) return 'SOURCE_CHANGE'
  if (current.version !== proposed.version) return 'VERSION_UPDATE'
  return 'UNCHANGED'
}

function impactFor(proposed: PolicyArtifact, type: PolicyArtifactChange['changeType']): PolicyChangeImpact {
  if (type === 'UNCHANGED') return 'LOW'
  if (proposed.type === 'PRICING_GUARDRAIL' || proposed.type === 'LLM_VALIDATION') return 'HIGH'
  if (proposed.type === 'QUOTE_INSIGHT_MAPPING' || proposed.type === 'APPROVAL_ROUTING') return 'MEDIUM'
  return 'LOW'
}

function reviewerRoleFor(proposed: PolicyArtifact) {
  if (proposed.type === 'PRICING_GUARDRAIL' || proposed.type === 'APPROVAL_ROUTING') return 'DEAL_DESK_ADMIN'
  if (proposed.type === 'LLM_VALIDATION') return 'AI_GOVERNANCE_ADMIN'
  if (proposed.type === 'QUOTE_INSIGHT_MAPPING') return 'REVENUE_OPERATIONS_ADMIN'
  return 'TECHNICAL_REVIEWER'
}

export function buildPolicyChangeControlPlan(): PolicyChangeControlPlan {
  const activeById = new Map(ACTIVE_POLICY_ARTIFACTS.map((artifact) => [artifact.id, artifact]))
  const changes = PROPOSED_POLICY_ARTIFACTS.map((proposed) => {
    const current = activeById.get(proposed.id) ?? null
    const type = changeType(current, proposed)

    return {
      policyId: proposed.id,
      label: proposed.label,
      type: proposed.type,
      owner: proposed.owner,
      currentVersion: current?.version ?? null,
      proposedVersion: proposed.version,
      changeType: type,
      impact: impactFor(proposed, type),
      reviewerRole: reviewerRoleFor(proposed),
      changeSummary: changeSummary(current, proposed),
      sourceRefs: proposed.sourceRefs,
    }
  })
  const changedPolicies = changes.filter((change) => change.changeType !== 'UNCHANGED')
  const highImpactPolicies = changes.filter((change) => change.impact === 'HIGH')
  const approvalWorkflow: PolicyApprovalStep[] = [
    {
      id: 'technical-replay',
      label: 'Replay Verification',
      ownerRole: 'TECHNICAL_REVIEWER',
      status: 'PENDING',
      requiredForPromotion: true,
      detail: 'Run deterministic replay against representative decision packets and confirm no unintended final-output drift.',
    },
    {
      id: 'deal-desk-review',
      label: 'Commercial Guardrail Review',
      ownerRole: 'DEAL_DESK_ADMIN',
      status: highImpactPolicies.some((change) => change.type === 'PRICING_GUARDRAIL')
        ? 'PENDING'
        : 'NOT_STARTED',
      requiredForPromotion: highImpactPolicies.some((change) => change.type === 'PRICING_GUARDRAIL'),
      detail: 'Review pricing, approval routing, and exception behavior before tenant promotion.',
    },
    {
      id: 'ai-governance-review',
      label: 'AI Governance Review',
      ownerRole: 'AI_GOVERNANCE_ADMIN',
      status: highImpactPolicies.some((change) => change.type === 'LLM_VALIDATION')
        ? 'PENDING'
        : 'NOT_STARTED',
      requiredForPromotion: highImpactPolicies.some((change) => change.type === 'LLM_VALIDATION'),
      detail: 'Review guarded LLM validation boundaries, prompt contracts, and role controls.',
    },
    {
      id: 'tenant-promotion',
      label: 'Tenant Promotion',
      ownerRole: 'REVENUE_OPERATIONS_ADMIN',
      status: 'BLOCKED',
      requiredForPromotion: true,
      detail: 'Promote only after required approvals pass and audit packet replay is clean.',
    },
  ]

  return {
    changeControlVersion: POLICY_CHANGE_CONTROL_VERSION,
    tenantScope: 'Demo tenant / future tenant override boundary',
    currentRegistryId: POLICY_REGISTRY_ID,
    proposedRegistryId: 'renewal-policy-registry-2026-q3-draft',
    proposedEffectiveDate: '2026-07-01',
    generatedAt: new Date().toISOString(),
    changes,
    approvalWorkflow,
    summary: {
      totalPolicies: changes.length,
      changedPolicies: changedPolicies.length,
      highImpactPolicies: highImpactPolicies.length,
      approvalsRequired: approvalWorkflow.filter((step) => step.requiredForPromotion).length,
      promotionStatus: approvalWorkflow.some((step) => step.status === 'BLOCKED')
        ? 'BLOCKED'
        : 'READY_FOR_REVIEW',
    },
  }
}

export function buildPolicyPromotionPacket(): PolicyPromotionPacket {
  const plan = buildPolicyChangeControlPlan()
  const blockedSteps = plan.approvalWorkflow.filter((step) => step.status === 'BLOCKED')
  const pendingRequiredSteps = plan.approvalWorkflow.filter(
    (step) => step.requiredForPromotion && step.status === 'PENDING',
  )
  const requiredApproverRoles = Array.from(
    new Set(
      plan.approvalWorkflow
        .filter((step) => step.requiredForPromotion)
        .map((step) => step.ownerRole),
    ),
  )
  const blockedReasons = [
    ...pendingRequiredSteps.map((step) => `${step.label} is pending ${step.ownerRole}.`),
    ...blockedSteps.map((step) => `${step.label} is blocked until required approvals pass.`),
  ]

  return {
    packetVersion: 'policy-promotion-packet-v1',
    exportedAt: new Date().toISOString(),
    plan,
    promotionReadiness: {
      readyForPromotion: blockedReasons.length === 0,
      blockedReasons,
      requiredApproverRoles,
      replayRequired: plan.approvalWorkflow.some((step) => step.id === 'technical-replay'),
      tenantPromotionGate:
        blockedReasons.length === 0
          ? 'Ready for controlled tenant promotion.'
          : 'Promotion is blocked until required review steps are complete.',
    },
  }
}
