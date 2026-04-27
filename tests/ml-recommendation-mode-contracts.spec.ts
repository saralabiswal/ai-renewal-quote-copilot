import { existsSync } from 'fs'
import path from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { waitForPageStable } from './helpers'

const prisma = new PrismaClient()
const CASE_ID = 'rcase_vertex_industrial'
const INSIGHT_CASE_ID = 'rcase_aster_commerce'
const DEFAULT_MODE = 'HYBRID_RULES_ML'

type MlRecommendationMode = 'RULES_ONLY' | 'ML_SHADOW' | 'HYBRID_RULES_ML'

async function postJson(
  request: APIRequestContext,
  url: string,
  body?: Record<string, unknown>,
) {
  const response = await request.post(url, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

async function applyMode(request: APIRequestContext, mode: MlRecommendationMode | string) {
  const { response, payload } = await postJson(request, '/api/settings/ml', {
    mlRecommendationMode: mode,
  })

  expect(response.ok()).toBeTruthy()
  return payload as { settings?: { mlRecommendationMode?: string } }
}

async function latestDecisionRun(caseId: string) {
  return prisma.decisionRun.findFirst({
    where: {
      renewalCaseId: caseId,
      runType: 'RECOMMENDATION_RECALCULATION',
    },
    orderBy: { createdAt: 'desc' },
  })
}

function parseJsonObject<T = Record<string, unknown>>(raw: string | null | undefined): T {
  expect(raw).toBeTruthy()
  return JSON.parse(String(raw)) as T
}

function signalValue(
  parsed: { signals?: Array<{ label?: string; value?: unknown }> },
  label: string,
) {
  return parsed.signals?.find((item) => item.label === label)?.value
}

async function waitForHealth(url: string) {
  const deadline = Date.now() + 15_000
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`)
}

function stopProcess(child: ChildProcess) {
  if (!child.killed) child.kill()
}

test.describe.serial('ML recommendation mode contracts', () => {
  test.afterAll(async ({ request }) => {
    await applyMode(request, DEFAULT_MODE)
    await prisma.$disconnect()
  })

  test('settings API persists supported modes and normalizes unknown modes', async ({ request }) => {
    for (const mode of ['RULES_ONLY', 'ML_SHADOW', 'HYBRID_RULES_ML'] as const) {
      const payload = await applyMode(request, mode)
      expect(payload.settings?.mlRecommendationMode).toBe(mode)
    }

    const invalidPayload = await applyMode(request, 'not-a-real-mode')
    expect(invalidPayload.settings?.mlRecommendationMode).toBe('HYBRID_RULES_ML')
  })

  test('ML-assisted recalculation records ML output and final decision metadata', async ({
    request,
  }) => {
    await applyMode(request, 'HYBRID_RULES_ML')

    const recalc = await postJson(request, `/api/renewal-cases/${CASE_ID}/recalculate`)
    expect(recalc.response.ok()).toBeTruthy()
    expect(recalc.payload?.ok).toBe(true)

    const run = await latestDecisionRun(CASE_ID)
    expect(run).not.toBeNull()
    expect(run?.mode).toBe('HYBRID_RULES_ML')
    expect(run?.mlMode).toBe('HYBRID_RULES_ML')
    expect(run?.featureSchemaVersion).toBe('renewal-features-v1')
    expect(run?.mlModelName).toContain('renewal_risk')

    const mlOutput = parseJsonObject<{
      status?: string
      mode?: string
      bundleRiskScore?: number | null
      itemPredictions?: Array<{ riskScore?: number | null; topFeatures?: string[] }>
    }>(run?.mlOutputJson)
    const finalOutput = parseJsonObject<{ riskScore?: number; recommendedAction?: string }>(
      run?.finalOutputJson,
    )

    expect(mlOutput.status).toBe('OK')
    expect(mlOutput.mode).toBe('HYBRID_RULES_ML')
    expect(typeof mlOutput.bundleRiskScore).toBe('number')
    expect(mlOutput.itemPredictions?.length).toBeGreaterThan(0)
    expect(
      mlOutput.itemPredictions?.some(
        (item) => typeof item.riskScore === 'number' && (item.topFeatures?.length ?? 0) > 0,
      ),
    ).toBe(true)
    expect(typeof finalOutput.riskScore).toBe('number')
    expect(typeof finalOutput.recommendedAction).toBe('string')
  })

  test('shadow mode records ML evidence without changing rules-only recommendation', async ({
    request,
  }) => {
    await applyMode(request, 'RULES_ONLY')
    const rulesOnly = await postJson(request, `/api/renewal-cases/${CASE_ID}/recalculate`)
    expect(rulesOnly.response.ok()).toBeTruthy()

    await applyMode(request, 'ML_SHADOW')
    const shadow = await postJson(request, `/api/renewal-cases/${CASE_ID}/recalculate`)
    expect(shadow.response.ok()).toBeTruthy()

    expect(shadow.payload?.result?.bundleResult?.riskScore).toBe(
      rulesOnly.payload?.result?.bundleResult?.riskScore,
    )
    expect(shadow.payload?.result?.bundleResult?.recommendedAction).toBe(
      rulesOnly.payload?.result?.bundleResult?.recommendedAction,
    )

    const run = await latestDecisionRun(CASE_ID)
    expect(run?.mode).toBe('RULE_ENGINE_WITH_ML_SHADOW')
    expect(run?.mlMode).toBe('ML_SHADOW')

    const mlOutput = parseJsonObject<{ status?: string; itemPredictions?: unknown[] }>(
      run?.mlOutputJson,
    )
    expect(mlOutput.status).toBe('OK')
    expect(mlOutput.itemPredictions?.length).toBeGreaterThan(0)
  })

  test('quote insights persist ML evidence signals after ML-assisted recalculation', async ({
    request,
  }) => {
    await applyMode(request, 'HYBRID_RULES_ML')

    const recalc = await postJson(request, `/api/renewal-cases/${INSIGHT_CASE_ID}/recalculate`)
    expect(recalc.response.ok()).toBeTruthy()

    const insights = await request.post(
      `/api/renewal-cases/${INSIGHT_CASE_ID}/recalculate-quote-insights`,
    )
    expect(insights.ok()).toBeTruthy()

    const rows = await prisma.quoteInsight.findMany({
      where: {
        renewalCaseId: INSIGHT_CASE_ID,
        justificationJson: { not: null },
      },
      orderBy: [{ createdAt: 'desc' }, { fitScore: 'desc' }],
      select: {
        id: true,
        justificationJson: true,
      },
    })

    const insightWithMl = rows
      .map((row) => ({
        id: row.id,
        parsed: JSON.parse(String(row.justificationJson ?? '{}')) as {
          ml?: {
            affectsRecommendation?: boolean
            riskScore?: number | null
            expansionScore?: number | null
            topFeatures?: string[]
          } | null
          signals?: Array<{ label?: string; value?: unknown }>
        },
      }))
      .find((row) => row.parsed.ml?.riskScore != null)

    expect(insightWithMl, 'expected at least one quote insight with ML evidence').toBeTruthy()
    expect(insightWithMl?.parsed.ml?.affectsRecommendation).toBe(true)
    expect(typeof insightWithMl?.parsed.ml?.riskScore).toBe('number')
    expect(typeof insightWithMl?.parsed.ml?.expansionScore).toBe('number')
    expect((insightWithMl?.parsed.ml?.topFeatures?.length ?? 0)).toBeGreaterThan(0)
    expect(signalValue(insightWithMl!.parsed, 'ML Risk Score')).toBe(
      insightWithMl?.parsed.ml?.riskScore,
    )
    expect(signalValue(insightWithMl!.parsed, 'ML Expansion Score')).toBe(
      insightWithMl?.parsed.ml?.expansionScore,
    )
    expect(String(signalValue(insightWithMl!.parsed, 'ML Top Features') ?? '')).not.toBe('')
  })

  test('settings and AI Architecture pages expose mode controls without local absolute paths', async ({
    page,
  }) => {
    await page.goto('/settings')
    await waitForPageStable(page)

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Recommendation Mode').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /ML-Assisted Rules/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Optional Text Generation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Apply ML Mode' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/\/Users\/|\/home\/|\/Volumes\//)

    await page.goto('/technical-review')
    await waitForPageStable(page)

    await expect(page.getByRole('heading', { name: 'AI Architecture' })).toBeVisible()
    await expect(page.getByText('Model Registry').first()).toBeVisible()
    await expect(page.getByText('Shadow and ML-Assisted Behavior')).toBeVisible()
    await expect(page.getByText('Evaluation', { exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/\/Users\/|\/home\/|\/Volumes\//)
  })

  test('standalone ML health endpoint returns relative artifact path', async () => {
    const pythonBin = process.env.ML_PYTHON_BIN || path.join('.venv-ml', 'bin', 'python')
    test.skip(!existsSync(pythonBin), `Python runtime not found at ${pythonBin}`)

    const port = String(18_110 + test.info().workerIndex)
    const child = spawn(pythonBin, ['ml/serve.py'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ML_SERVICE_HOST: '127.0.0.1',
        ML_SERVICE_PORT: port,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    try {
      const response = await waitForHealth(`http://127.0.0.1:${port}/health`)
      const payload = (await response.json()) as {
        status?: string
        service?: string
        modelPath?: string
        riskModelExists?: boolean
        riskMetadataExists?: boolean
      }

      expect(payload.status).toBe('OK')
      expect(payload.service).toBe('renewal-ml-service')
      expect(payload.riskModelExists).toBe(true)
      expect(payload.riskMetadataExists).toBe(true)
      expect(payload.modelPath).toMatch(/^ml\/models\//)
      expect(payload.modelPath).not.toMatch(/^\/|^[A-Za-z]:\\/)
    } finally {
      stopProcess(child)
    }
  })
})
