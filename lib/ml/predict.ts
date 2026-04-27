import { spawn } from 'child_process'
import { getMlRuntimeConfig } from '@/lib/ml/config'
import type { MlCasePrediction, MlPredictionRequest } from '@/lib/ml/types'

function unavailablePrediction(
  mode: string,
  status: MlCasePrediction['status'],
  error?: string,
): MlCasePrediction {
  return {
    status,
    mode,
    modelName: null,
    modelVersion: null,
    generatedAt: new Date().toISOString(),
    error: error ?? null,
    bundleRiskScore: null,
    itemPredictions: [],
  }
}

function sanitizePrediction(raw: unknown, mode: string): MlCasePrediction {
  if (!raw || typeof raw !== 'object') {
    return unavailablePrediction(mode, 'ERROR', 'ML predictor returned an invalid payload.')
  }

  const record = raw as Record<string, unknown>
  const itemPredictions = Array.isArray(record.itemPredictions)
    ? record.itemPredictions.map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
        return {
          itemId: String(row.itemId ?? ''),
          riskScore: row.riskScore == null ? null : Number(row.riskScore),
          riskProbability: row.riskProbability == null ? null : Number(row.riskProbability),
          expansionScore: row.expansionScore == null ? null : Number(row.expansionScore),
          expansionProbability:
            row.expansionProbability == null ? null : Number(row.expansionProbability),
          topFeatures: Array.isArray(row.topFeatures) ? row.topFeatures.map(String) : [],
        }
      })
    : []

  return {
    status: String(record.status ?? 'ERROR') as MlCasePrediction['status'],
    mode: String(record.mode ?? mode),
    modelName: record.modelName == null ? null : String(record.modelName),
    modelVersion: record.modelVersion == null ? null : String(record.modelVersion),
    generatedAt: record.generatedAt == null ? new Date().toISOString() : String(record.generatedAt),
    error: record.error == null ? null : String(record.error),
    bundleRiskScore: record.bundleRiskScore == null ? null : Number(record.bundleRiskScore),
    itemPredictions,
  }
}

async function predictWithPython(request: MlPredictionRequest): Promise<MlCasePrediction> {
  const config = getMlRuntimeConfig()

  if (!config.predictionScriptExists) {
    return unavailablePrediction(config.mode, 'UNAVAILABLE', 'ML prediction script was not found.')
  }

  return new Promise((resolve) => {
    const child = spawn(config.pythonBin, [config.predictionScriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ML_MODEL_PATH: config.modelPath,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      resolve(unavailablePrediction(config.mode, 'UNAVAILABLE', 'ML prediction timed out.'))
    }, 5000)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      resolve(unavailablePrediction(config.mode, 'UNAVAILABLE', error.message))
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        resolve(
          unavailablePrediction(
            config.mode,
            'UNAVAILABLE',
            stderr.trim() || `ML predictor exited with code ${code}.`,
          ),
        )
        return
      }

      try {
        resolve(sanitizePrediction(JSON.parse(stdout), config.mode))
      } catch (error) {
        resolve(
          unavailablePrediction(
            config.mode,
            'ERROR',
            error instanceof Error ? error.message : 'Failed to parse ML output.',
          ),
        )
      }
    })

    child.stdin.write(JSON.stringify(request))
    child.stdin.end()
  })
}

async function predictWithService(request: MlPredictionRequest): Promise<MlCasePrediction> {
  const config = getMlRuntimeConfig()
  if (!config.serviceUrl) {
    return unavailablePrediction(config.mode, 'UNAVAILABLE', 'ML service URL is not configured.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(new URL('/predict', config.serviceUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    if (!response.ok) {
      return unavailablePrediction(
        config.mode,
        'UNAVAILABLE',
        `ML service returned HTTP ${response.status}.`,
      )
    }

    return sanitizePrediction(await response.json(), config.mode)
  } catch (error) {
    return unavailablePrediction(
      config.mode,
      'UNAVAILABLE',
      error instanceof Error ? error.message : 'ML service request failed.',
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function getMlPrediction(
  request: MlPredictionRequest,
): Promise<MlCasePrediction | null> {
  const config = getMlRuntimeConfig()

  if (!config.enabled) {
    return null
  }

  if (config.serviceUrl) {
    return predictWithService(request)
  }

  if (!config.modelExists) {
    return unavailablePrediction(config.mode, 'MODEL_MISSING', 'ML model file was not found.')
  }

  return predictWithPython(request)
}
