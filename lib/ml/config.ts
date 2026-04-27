import { existsSync } from 'fs'
import path from 'path'
import {
  getRuntimeSettings,
  normalizeMlRecommendationMode,
  type MlRecommendationMode,
} from '@/lib/settings/runtime-settings'
import { getRenewalRiskModelRegistryStatus } from '@/lib/ml/model-registry'

export { type MlRecommendationMode }

export type MlRuntimeConfig = {
  mode: MlRecommendationMode
  enabled: boolean
  affectsRecommendations: boolean
  pythonBin: string
  predictionScriptPath: string
  modelPath: string
  serviceUrl: string | null
  modelExists: boolean
  predictionScriptExists: boolean
  registryModelName: string | null
  registryModelVersion: string | null
  registryApprovedForShadow: boolean
  registryApprovedForHybrid: boolean
  registryFeatureSchemaVersion: string | null
  registryArtifactSha256: string | null
  registryEvaluationReport: string | null
  registryLatestMetrics: Record<string, number | null> | null
}

export function getMlRuntimeConfig(): MlRuntimeConfig {
  const settings = getRuntimeSettings()
  const mode = normalizeMlRecommendationMode(settings.mlRecommendationMode)
  const registry = getRenewalRiskModelRegistryStatus()
  const localPythonBin = path.resolve('.venv-ml/bin/python')
  const predictionScriptPath = path.resolve(process.env.ML_PREDICTION_SCRIPT_PATH ?? 'ml/predict.py')
  const envModelPath = process.env.ML_MODEL_PATH?.trim()
  const configuredModelPath =
    envModelPath || registry.modelPath || 'ml/models/renewal_risk_sklearn.joblib'
  const modelPath = path.resolve(configuredModelPath)
  const serviceUrl = process.env.ML_SERVICE_URL?.trim() || null
  const approvedForMode =
    mode === 'HYBRID_RULES_ML'
      ? Boolean(registry.entry?.approvedForHybrid)
      : mode === 'ML_SHADOW'
        ? Boolean(registry.entry?.approvedForShadow)
        : false

  return {
    mode,
    enabled: mode !== 'RULES_ONLY' && approvedForMode,
    affectsRecommendations: mode === 'HYBRID_RULES_ML' && approvedForMode,
    pythonBin: process.env.ML_PYTHON_BIN || (existsSync(localPythonBin) ? localPythonBin : 'python3'),
    predictionScriptPath,
    modelPath,
    serviceUrl,
    modelExists: existsSync(modelPath),
    predictionScriptExists: existsSync(predictionScriptPath),
    registryModelName: registry.entry?.modelName ?? null,
    registryModelVersion: registry.entry?.activeVersion ?? null,
    registryApprovedForShadow: Boolean(registry.entry?.approvedForShadow),
    registryApprovedForHybrid: Boolean(registry.entry?.approvedForHybrid),
    registryFeatureSchemaVersion: registry.entry?.featureSchemaVersion ?? null,
    registryArtifactSha256: registry.entry?.artifactSha256 ?? null,
    registryEvaluationReport: registry.entry?.latestEvaluationReport ?? null,
    registryLatestMetrics: registry.entry?.latestMetrics ?? null,
  }
}

export function mlModeLabel(mode: MlRecommendationMode) {
  switch (mode) {
    case 'HYBRID_RULES_ML':
      return 'ML-Assisted Rules'
    case 'ML_SHADOW':
      return 'Shadow Mode'
    case 'RULES_ONLY':
    default:
      return 'Rules Only'
  }
}
