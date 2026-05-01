import { strict as assert } from 'node:assert'
import {
  normalizeGovernanceRole,
  validateRuntimeSettingsRoleChange,
} from '../lib/auth/role-controls'
import type { RuntimeSettings } from '../lib/settings/runtime-settings'

const current: RuntimeSettings = {
  mlRecommendationMode: 'HYBRID_RULES_ML',
  guardedDecisioningMode: 'LLM_CRITIC_SHADOW',
}

const guarded: RuntimeSettings = {
  ...current,
  guardedDecisioningMode: 'LLM_ASSISTED_GUARDED',
}

const humanApproval: RuntimeSettings = {
  ...current,
  guardedDecisioningMode: 'HUMAN_APPROVAL_REQUIRED',
}

const shadow: RuntimeSettings = {
  ...current,
  guardedDecisioningMode: 'LLM_RANKING_SHADOW',
}

assert.equal(normalizeGovernanceRole('technical_reviewer'), 'TECHNICAL_REVIEWER')
assert.equal(normalizeGovernanceRole('unknown'), 'AI_GOVERNANCE_ADMIN')

assert.equal(
  validateRuntimeSettingsRoleChange({
    role: 'AI_GOVERNANCE_ADMIN',
    current,
    requested: guarded,
  }).allowed,
  true,
)

assert.equal(
  validateRuntimeSettingsRoleChange({
    role: 'REVENUE_OPERATIONS_ADMIN',
    current,
    requested: guarded,
  }).allowed,
  true,
)

assert.equal(
  validateRuntimeSettingsRoleChange({
    role: 'TECHNICAL_REVIEWER',
    current,
    requested: guarded,
  }).allowed,
  false,
)

assert.equal(
  validateRuntimeSettingsRoleChange({
    role: 'DEAL_DESK_ADMIN',
    current,
    requested: humanApproval,
  }).allowed,
  true,
)

assert.equal(
  validateRuntimeSettingsRoleChange({
    role: 'RENEWAL_MANAGER',
    current,
    requested: shadow,
  }).allowed,
  true,
)

console.log('Role control checks passed.')
