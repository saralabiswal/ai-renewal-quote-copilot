import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export type MlRecommendationMode = 'RULES_ONLY' | 'ML_SHADOW' | 'HYBRID_RULES_ML'
export type GuardedDecisioningMode =
  | 'RULES_ONLY'
  | 'LLM_CRITIC_SHADOW'
  | 'LLM_RANKING_SHADOW'
  | 'LLM_ASSISTED_GUARDED'
  | 'HUMAN_APPROVAL_REQUIRED'

export type RuntimeSettings = {
  mlRecommendationMode: MlRecommendationMode
  guardedDecisioningMode: GuardedDecisioningMode
  llmJsonTimeoutMs: number
}

const SETTINGS_PATH = path.join(process.cwd(), '.runtime-settings.json')

function isEnabled(raw: string | undefined) {
  const value = raw?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export function normalizeMlRecommendationMode(value: unknown): MlRecommendationMode {
  if (typeof value !== 'string') return 'HYBRID_RULES_ML'

  switch (value.trim().toUpperCase()) {
    case 'HYBRID_RULES_ML':
    case 'HYBRID':
    case 'ML':
    case 'ENABLED':
      return 'HYBRID_RULES_ML'
    case 'ML_SHADOW':
    case 'SHADOW':
      return 'ML_SHADOW'
    case 'RULES_ONLY':
      return 'RULES_ONLY'
    default:
      return 'HYBRID_RULES_ML'
  }
}

export function normalizeGuardedDecisioningMode(value: unknown): GuardedDecisioningMode {
  if (typeof value !== 'string') return 'LLM_CRITIC_SHADOW'

  switch (value.trim().toUpperCase()) {
    case 'LLM_ASSISTED_GUARDED':
    case 'GUARDED':
      return 'LLM_ASSISTED_GUARDED'
    case 'LLM_RANKING_SHADOW':
    case 'RANKING_SHADOW':
      return 'LLM_RANKING_SHADOW'
    case 'HUMAN_APPROVAL_REQUIRED':
    case 'HUMAN_APPROVAL':
      return 'HUMAN_APPROVAL_REQUIRED'
    case 'RULES_ONLY':
      return 'RULES_ONLY'
    case 'LLM_CRITIC_SHADOW':
    case 'CRITIC_SHADOW':
    default:
      return 'LLM_CRITIC_SHADOW'
  }
}

export function normalizeLlmJsonTimeoutMs(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 60000

  return Math.max(1000, Math.min(300000, Math.round(parsed)))
}

function envDefaultSettings(): RuntimeSettings {
  const guardedDecisioningMode = normalizeGuardedDecisioningMode(
    process.env.GUARDED_DECISIONING_MODE || 'LLM_CRITIC_SHADOW',
  )
  const llmJsonTimeoutMs = normalizeLlmJsonTimeoutMs(
    process.env.LLM_JSON_TIMEOUT_MS || 60000,
  )

  if (isEnabled(process.env.ML_RECOMMENDATION_ENABLED)) {
    return {
      mlRecommendationMode: 'HYBRID_RULES_ML',
      guardedDecisioningMode,
      llmJsonTimeoutMs,
    }
  }

  return {
    mlRecommendationMode: normalizeMlRecommendationMode(
      process.env.ML_RECOMMENDATION_MODE || 'HYBRID_RULES_ML',
    ),
    guardedDecisioningMode,
    llmJsonTimeoutMs,
  }
}

export function getRuntimeSettings(): RuntimeSettings {
  const defaults = envDefaultSettings()

  if (!existsSync(SETTINGS_PATH)) {
    return defaults
  }

  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<RuntimeSettings>
    return {
      ...defaults,
      mlRecommendationMode: normalizeMlRecommendationMode(
        parsed.mlRecommendationMode ?? defaults.mlRecommendationMode,
      ),
      guardedDecisioningMode: normalizeGuardedDecisioningMode(
        parsed.guardedDecisioningMode ?? defaults.guardedDecisioningMode,
      ),
      llmJsonTimeoutMs: normalizeLlmJsonTimeoutMs(
        parsed.llmJsonTimeoutMs ?? defaults.llmJsonTimeoutMs,
      ),
    }
  } catch {
    return defaults
  }
}

export function saveRuntimeSettings(next: Partial<RuntimeSettings>): RuntimeSettings {
  const current = getRuntimeSettings()
  const resolved: RuntimeSettings = {
    ...current,
    mlRecommendationMode: normalizeMlRecommendationMode(
      next.mlRecommendationMode ?? current.mlRecommendationMode,
    ),
    guardedDecisioningMode: normalizeGuardedDecisioningMode(
      next.guardedDecisioningMode ?? current.guardedDecisioningMode,
    ),
    llmJsonTimeoutMs: normalizeLlmJsonTimeoutMs(
      next.llmJsonTimeoutMs ?? current.llmJsonTimeoutMs,
    ),
  }

  writeFileSync(SETTINGS_PATH, `${JSON.stringify(resolved, null, 2)}\n`, 'utf8')
  return resolved
}
