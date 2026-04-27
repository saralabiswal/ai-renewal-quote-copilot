import type { RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'

export type MlItemPrediction = {
  itemId: string
  riskScore: number | null
  riskProbability: number | null
  expansionScore: number | null
  expansionProbability: number | null
  topFeatures: string[]
}

export type MlCasePrediction = {
  status: 'OK' | 'DISABLED' | 'MODEL_MISSING' | 'UNAVAILABLE' | 'ERROR'
  mode: string
  modelName: string | null
  modelVersion: string | null
  generatedAt: string
  error?: string | null
  bundleRiskScore: number | null
  itemPredictions: MlItemPrediction[]
}

export type MlPredictionRequest = {
  caseId: string
  mode?: string
  demoScenarioKey?: string | null
  account: RenewalCaseEngineInput['account'] & {
    industry?: string | null
  }
  items: Array<
    RenewalCaseEngineInput['items'][number] & {
      ruleRiskScore?: number | null
      ruleRiskLevel?: string | null
      ruleDisposition?: string | null
    }
  >
  ruleBundle: RenewalCaseEngineOutput['bundleResult']
}
