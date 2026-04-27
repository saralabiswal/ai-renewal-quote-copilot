import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export type MlRecommendationMode = 'RULES_ONLY' | 'ML_SHADOW' | 'HYBRID_RULES_ML'

export type RuntimeSettings = {
  mlRecommendationMode: MlRecommendationMode
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

function envDefaultSettings(): RuntimeSettings {
  if (isEnabled(process.env.ML_RECOMMENDATION_ENABLED)) {
    return { mlRecommendationMode: 'HYBRID_RULES_ML' }
  }

  return {
    mlRecommendationMode: normalizeMlRecommendationMode(
      process.env.ML_RECOMMENDATION_MODE || 'HYBRID_RULES_ML',
    ),
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
  }

  writeFileSync(SETTINGS_PATH, `${JSON.stringify(resolved, null, 2)}\n`, 'utf8')
  return resolved
}
