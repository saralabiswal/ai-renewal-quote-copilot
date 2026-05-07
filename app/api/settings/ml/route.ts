import { NextResponse } from 'next/server'
import {
  getRequestGovernanceRole,
  validateRuntimeSettingsRoleChange,
} from '@/lib/auth/role-controls'
import {
  getRuntimeSettings,
  normalizeGuardedDecisioningMode,
  normalizeLlmJsonTimeoutMs,
  normalizeMlRecommendationMode,
  saveRuntimeSettings,
} from '@/lib/settings/runtime-settings'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mlRecommendationMode?: unknown
      guardedDecisioningMode?: unknown
      llmJsonTimeoutMs?: unknown
    }
    const current = getRuntimeSettings()
    const requestedSettings = {
      ...current,
      ...(body.mlRecommendationMode === undefined
        ? {}
        : { mlRecommendationMode: normalizeMlRecommendationMode(body.mlRecommendationMode) }),
      ...(body.guardedDecisioningMode === undefined
        ? {}
        : {
            guardedDecisioningMode: normalizeGuardedDecisioningMode(
              body.guardedDecisioningMode,
            ),
          }),
      ...(body.llmJsonTimeoutMs === undefined
        ? {}
        : { llmJsonTimeoutMs: normalizeLlmJsonTimeoutMs(body.llmJsonTimeoutMs) }),
    }
    const role = getRequestGovernanceRole(request)
    const roleDecision = validateRuntimeSettingsRoleChange({
      role,
      current,
      requested: requestedSettings,
    })

    if (!roleDecision.allowed) {
      return NextResponse.json(
        {
          error: roleDecision.reason,
          roleDecision,
        },
        { status: 403 },
      )
    }

    const settings = saveRuntimeSettings(requestedSettings)

    return NextResponse.json({ settings, roleDecision })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to persist ML recommendation settings.',
      },
      { status: 500 },
    )
  }
}
