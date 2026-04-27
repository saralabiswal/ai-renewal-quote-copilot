import { existsSync, readFileSync } from 'fs'
import path from 'path'

export type ModelRegistryEntry = {
  activeVersion: string
  modelName: string
  modelPath: string
  metadataPath?: string
  featureSchemaVersion: string
  approvedForShadow: boolean
  approvedForHybrid: boolean
  artifactSha256?: string
  latestEvaluationReport?: string
  latestMetrics?: Record<string, number | null>
  owner?: string
  notes?: string
}

type ModelRegistry = {
  models?: Record<string, ModelRegistryEntry>
}

const REGISTRY_PATH = path.join(process.cwd(), 'ml/model-registry.json')

export function getModelRegistryEntry(modelKey: string): ModelRegistryEntry | null {
  if (!existsSync(REGISTRY_PATH)) return null

  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as ModelRegistry
    return parsed.models?.[modelKey] ?? null
  } catch {
    return null
  }
}

export function resolveModelRegistryPath(value: string | null | undefined) {
  if (!value) return null
  return path.isAbsolute(value) ? value : path.resolve(value)
}

export function getRenewalRiskModelRegistryStatus() {
  const entry = getModelRegistryEntry('renewal_risk')
  const modelPath = resolveModelRegistryPath(entry?.modelPath)
  const metadataPath = resolveModelRegistryPath(entry?.metadataPath)

  return {
    entry,
    modelPath,
    metadataPath,
    modelExists: modelPath ? existsSync(modelPath) : false,
    metadataExists: metadataPath ? existsSync(metadataPath) : false,
  }
}
