import { strict as assert } from 'node:assert'
import {
  buildPolicyChangeControlPlan,
  buildPolicyPromotionPacket,
} from '../lib/policies/policy-change-control'

const plan = buildPolicyChangeControlPlan()

assert.equal(plan.changeControlVersion, 'policy-change-control-v1')
assert.equal(plan.currentRegistryId, 'renewal-policy-registry-2026-q2')
assert.ok(plan.proposedRegistryId.endsWith('-draft'))
assert.ok(plan.summary.totalPolicies >= 7)
assert.ok(plan.summary.changedPolicies >= 3)
assert.ok(plan.summary.highImpactPolicies >= 2)
assert.equal(plan.summary.promotionStatus, 'BLOCKED')
assert.ok(
  plan.changes.some(
    (change) =>
      change.policyId === 'renewal-pricing-guardrail-policy' &&
      change.impact === 'HIGH' &&
      change.reviewerRole === 'DEAL_DESK_ADMIN',
  ),
)
assert.ok(
  plan.approvalWorkflow.some(
    (step) =>
      step.id === 'ai-governance-review' &&
      step.requiredForPromotion &&
      step.status === 'PENDING',
  ),
)

const packet = buildPolicyPromotionPacket()
assert.equal(packet.packetVersion, 'policy-promotion-packet-v1')
assert.equal(packet.plan.proposedRegistryId, plan.proposedRegistryId)
assert.equal(packet.promotionReadiness.readyForPromotion, false)
assert.ok(packet.promotionReadiness.blockedReasons.length >= 2)
assert.ok(packet.promotionReadiness.requiredApproverRoles.includes('AI_GOVERNANCE_ADMIN'))

console.log('Policy change control checks passed.')
