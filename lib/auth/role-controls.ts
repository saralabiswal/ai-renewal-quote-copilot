import type { GuardedDecisioningMode, RuntimeSettings } from '@/lib/settings/runtime-settings'

export type GovernanceRole =
  | 'AI_GOVERNANCE_ADMIN'
  | 'REVENUE_OPERATIONS_ADMIN'
  | 'DEAL_DESK_ADMIN'
  | 'TECHNICAL_REVIEWER'
  | 'RENEWAL_MANAGER'

export const GOVERNANCE_ROLES: GovernanceRole[] = [
  'AI_GOVERNANCE_ADMIN',
  'REVENUE_OPERATIONS_ADMIN',
  'DEAL_DESK_ADMIN',
  'TECHNICAL_REVIEWER',
  'RENEWAL_MANAGER',
]

export const ROLE_CONTROL_VERSION = 'role-controls-v1'

const GUARDED_MODE_ADMIN_ROLES: GovernanceRole[] = [
  'AI_GOVERNANCE_ADMIN',
  'REVENUE_OPERATIONS_ADMIN',
]

const HUMAN_APPROVAL_ADMIN_ROLES: GovernanceRole[] = [
  'AI_GOVERNANCE_ADMIN',
  'DEAL_DESK_ADMIN',
]

export type RoleControlDecision = {
  roleControlVersion: typeof ROLE_CONTROL_VERSION
  role: GovernanceRole
  allowed: boolean
  restrictedModeRequested: boolean
  reason: string
}

export function normalizeGovernanceRole(value: unknown): GovernanceRole {
  if (typeof value !== 'string') return 'AI_GOVERNANCE_ADMIN'
  const normalized = value.trim().toUpperCase()
  return GOVERNANCE_ROLES.includes(normalized as GovernanceRole)
    ? (normalized as GovernanceRole)
    : 'AI_GOVERNANCE_ADMIN'
}

export function getRequestGovernanceRole(request: Request): GovernanceRole {
  return normalizeGovernanceRole(
    request.headers.get('x-demo-user-role') ||
      request.headers.get('x-governance-role') ||
      process.env.DEMO_USER_ROLE,
  )
}

function isRestrictedGuardedMode(mode: GuardedDecisioningMode) {
  return mode === 'LLM_ASSISTED_GUARDED' || mode === 'HUMAN_APPROVAL_REQUIRED'
}

export function validateRuntimeSettingsRoleChange(args: {
  role: GovernanceRole
  current: RuntimeSettings
  requested: RuntimeSettings
}): RoleControlDecision {
  const requestedMode = args.requested.guardedDecisioningMode
  const currentMode = args.current.guardedDecisioningMode
  const restrictedModeRequested =
    requestedMode !== currentMode && isRestrictedGuardedMode(requestedMode)

  if (!restrictedModeRequested) {
    return {
      roleControlVersion: ROLE_CONTROL_VERSION,
      role: args.role,
      allowed: true,
      restrictedModeRequested,
      reason: 'Requested settings do not enable a restricted guarded decisioning mode.',
    }
  }

  if (
    requestedMode === 'LLM_ASSISTED_GUARDED' &&
    GUARDED_MODE_ADMIN_ROLES.includes(args.role)
  ) {
    return {
      roleControlVersion: ROLE_CONTROL_VERSION,
      role: args.role,
      allowed: true,
      restrictedModeRequested,
      reason: `${args.role} can enable LLM-assisted guarded mode.`,
    }
  }

  if (
    requestedMode === 'HUMAN_APPROVAL_REQUIRED' &&
    HUMAN_APPROVAL_ADMIN_ROLES.includes(args.role)
  ) {
    return {
      roleControlVersion: ROLE_CONTROL_VERSION,
      role: args.role,
      allowed: true,
      restrictedModeRequested,
      reason: `${args.role} can route guarded decisions to human approval mode.`,
    }
  }

  return {
    roleControlVersion: ROLE_CONTROL_VERSION,
    role: args.role,
    allowed: false,
    restrictedModeRequested,
    reason: `${args.role} cannot enable ${requestedMode}. Use AI governance, revenue operations, or deal desk authority for restricted modes.`,
  }
}
