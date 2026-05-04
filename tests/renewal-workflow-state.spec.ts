import { test, expect, APIRequestContext } from '@playwright/test'
import { openCommandTab, waitForPageStable } from './helpers'

const GENERATED_SCENARIO_CASE_IDS = [
  'rcase_aster_commerce',
  'rcase_helio_mfg',
  'rcase_lumina_commerce',
  'rcase_summitone',
]

type ScenarioGenerationResponse = {
  ok: boolean
  caseId: string
  generatedCount: number
  suppressedReason: string | null
  scenarioKeys: string[]
}

async function postJson(
  request: APIRequestContext,
  path: string,
  body?: Record<string, unknown>,
) {
  const response = await request.post(path, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok()) {
    const errorText = await response.text()
    throw new Error(`POST ${path} failed (${response.status()}): ${errorText}`)
  }
  return response.json()
}

async function generateScenariosForCase(
  request: APIRequestContext,
  caseId: string,
): Promise<ScenarioGenerationResponse> {
  await postJson(request, `/api/renewal-cases/${caseId}/recalculate-quote-insights`)
  const generation = await postJson(request, `/api/renewal-cases/${caseId}/generate-quote-scenarios`)
  return generation as ScenarioGenerationResponse
}

async function findCaseByScenarioExpectation(
  request: APIRequestContext,
  caseIds: string[],
) {
  for (const caseId of caseIds) {
    const generation = await generateScenariosForCase(request, caseId)

    if (generation.generatedCount > 0) {
      return {
        caseId,
        generation,
      }
    }
  }

  throw new Error(
    `No generated scenario case found in candidates: ${caseIds.join(', ')}`,
  )
}

test('recalculate endpoint returns structured recommendation payload', async ({ request }) => {
  const recalcBody = await postJson(request, '/api/renewal-cases/rcase_vertex_industrial/recalculate')

  expect(recalcBody.ok).toBe(true)
  expect(recalcBody.quoteInsightsNeedRefresh).toBe(true)
  expect(typeof recalcBody.result.bundleResult.riskScore).toBe('number')
  expect(typeof recalcBody.result.bundleResult.recommendedAction).toBe('string')
  expect(Array.isArray(recalcBody.result.itemResults)).toBe(true)
  expect(recalcBody.result.itemResults.length).toBeGreaterThan(0)
})

test('recalculate recommendation sets case under review and marks insights stale', async ({
  page,
  request,
}) => {
  const recalcBody = await postJson(request, '/api/renewal-cases/rcase_apex_mfg/recalculate')

  expect(recalcBody.ok).toBe(true)
  expect(recalcBody.quoteInsightsNeedRefresh).toBe(true)

  await page.goto('/renewal-cases')
  await waitForPageStable(page)

  const row = page.locator('tr').filter({
    has: page.locator('a[href="/renewal-cases/rcase_apex_mfg"]'),
  })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(/Under Review/i)

  await page.goto('/renewal-cases/rcase_apex_mfg')
  await waitForPageStable(page)
  await openCommandTab(page, /Apply Quote Actions/i)
  await expect(page.getByText('Quote Insights may be outdated')).toBeVisible()
})

test('decision trace logs rules-only recalculation metadata', async ({ page, request }) => {
  await postJson(request, '/api/settings/ml', {
    mlRecommendationMode: 'RULES_ONLY',
  })

  const recalcBody = await postJson(request, '/api/renewal-cases/rcase_apex_mfg/recalculate')
  expect(recalcBody.ok).toBe(true)

  await page.goto('/renewal-cases/rcase_apex_mfg')
  await waitForPageStable(page)
  await openCommandTab(page, /Decision Trace|Inspect Evidence/i)

  const tracePanel = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: 'Decision Trace' }),
  })
  await expect(tracePanel).toBeVisible()
  await expect(tracePanel).toContainText('Recommendation Recalculation')
  await expect(tracePanel).toContainText('Rule Engine')
  await expect(tracePanel).toContainText('renewal-features-v1')
  await expect(tracePanel).toContainText('Rules: recommendation-engine-v1')
})

test('ML shadow mode records ML status without changing recommendation result', async ({
  request,
}) => {
  await postJson(request, '/api/settings/ml', {
    mlRecommendationMode: 'RULES_ONLY',
  })
  const rulesOnlyBody = await postJson(
    request,
    '/api/renewal-cases/rcase_vertex_industrial/recalculate',
  )

  await postJson(request, '/api/settings/ml', {
    mlRecommendationMode: 'ML_SHADOW',
  })
  const shadowBody = await postJson(
    request,
    '/api/renewal-cases/rcase_vertex_industrial/recalculate',
  )

  expect(shadowBody.ok).toBe(true)
  expect(shadowBody.result.bundleResult.riskScore).toBe(
    rulesOnlyBody.result.bundleResult.riskScore,
  )
  expect(shadowBody.result.bundleResult.recommendedAction).toBe(
    rulesOnlyBody.result.bundleResult.recommendedAction,
  )

  await postJson(request, '/api/settings/ml', {
    mlRecommendationMode: 'RULES_ONLY',
  })
})

test('recalculate quote insights clears stale warning and shows regenerated timestamp', async ({
  page,
  request,
}) => {
  const preconditionBody = await postJson(
    request,
    '/api/renewal-cases/rcase_northstar_telecom/recalculate',
  )
  expect(preconditionBody.ok).toBe(true)

  await page.goto('/renewal-cases/rcase_northstar_telecom')
  await waitForPageStable(page)
  await openCommandTab(page, /Apply Quote Actions/i)
  await expect(page.getByText('Quote Insights may be outdated')).toBeVisible()

  const insightsResponse = await request.post(
    '/api/renewal-cases/rcase_northstar_telecom/recalculate-quote-insights',
  )
  expect(insightsResponse.ok()).toBeTruthy()
  const insightsBody = await insightsResponse.json()
  expect(insightsBody.ok).toBe(true)
  expect(typeof insightsBody.regeneratedCount).toBe('number')

  await page.reload()
  await waitForPageStable(page)
  await openCommandTab(page, /Apply Quote Actions/i)

  await expect(page.getByText('Quote Insights may be outdated')).toHaveCount(0)
  await expect(page.getByText(/Last regenerated:/i)).toBeVisible()
  const evidenceSummary = page.getByText('Structured Evidence (Read-only)').first()
  await expect(evidenceSummary).toBeVisible()
  await evidenceSummary.click()
  await expect(page.getByText(/Source:/).first()).toBeVisible()
})

test('generate-ai reports approval brief only when approval is required', async ({ request }) => {
  const approvalRequiredBody = await postJson(
    request,
    '/api/renewal-cases/rcase_summitone/generate-ai',
  )

  expect(approvalRequiredBody.ok).toBe(true)
  expect(approvalRequiredBody.generated.caseExecutiveSummary).toBe(true)
  expect(approvalRequiredBody.generated.caseRationale).toBe(true)
  expect(approvalRequiredBody.generated.approvalBrief).toBe(true)
  expect(approvalRequiredBody.generated.quoteInsightNarratives).toBeGreaterThan(0)

  const noApprovalBody = await postJson(
    request,
    '/api/renewal-cases/rcase_lumina_commerce/generate-ai',
  )

  expect(noApprovalBody.ok).toBe(true)
  expect(noApprovalBody.generated.caseExecutiveSummary).toBe(true)
  expect(noApprovalBody.generated.caseRationale).toBe(true)
  expect(noApprovalBody.generated.approvalBrief).toBe(false)
  expect(noApprovalBody.generated.quoteInsightNarratives).toBeGreaterThan(0)
})

test('quote review decision updates quote status and review history', async ({ page, request }) => {
  const comment = `automation-approve-${Date.now()}`

  const reviewBody = await postJson(request, '/api/quote-drafts/qd_harbor_fin/review', {
    decision: 'APPROVE',
    comment,
  })

  expect(reviewBody.ok).toBe(true)
  expect(reviewBody.quoteDraft.status).toBe('APPROVED')

  await page.goto('/quote-drafts')
  await waitForPageStable(page)

  const row = page.locator('tr').filter({
    has: page.locator('a[href="/quote-drafts/qd_harbor_fin"]'),
  })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(/Approved/i)

  await page.goto('/renewal-cases/rcase_harbor_fin')
  await waitForPageStable(page)
  await openCommandTab(page, /AI Review Guidance/i)

  await page.getByRole('button', { name: /Review History/i }).click()

  const reviewPanel = page.locator('.card', {
    has: page.getByRole('heading', { name: 'Review History' }),
  })
  await expect(reviewPanel).toBeVisible()
  await expect(reviewPanel).toContainText('Approve')
  await expect(reviewPanel).toContainText(comment)
})

test('reapplying the same quote insight is idempotent and does not duplicate quote lines', async ({
  page,
  request,
}) => {
  const endpoint =
    '/api/renewal-cases/rcase_crestview_health/quote-insights/qi_017/add-to-quote'

  const firstBody = await postJson(request, endpoint)
  expect(firstBody.ok).toBe(true)

  const secondBody = await postJson(request, endpoint)
  expect(secondBody.ok).toBe(true)
  expect(secondBody.result.mode).toBe('EXISTING')
  expect(secondBody.result.alreadyAdded).toBe(true)
  expect(secondBody.result.quoteDraftLineId).toBe(firstBody.result.quoteDraftLineId)

  await page.goto('/quote-drafts/qd_crestview_health')
  await waitForPageStable(page)
  await expect(page.getByText(/Source Quote Insight:\s*qi_017/i)).toHaveCount(1)
})

test('quote scenario generation is deterministic and idempotent', async ({ request, page }) => {
  const caseId = 'rcase_lumina_commerce'
  await postJson(request, `/api/renewal-cases/${caseId}/recalculate-quote-insights`)

  const first = await postJson(request, `/api/renewal-cases/${caseId}/generate-quote-scenarios`)
  const second = await postJson(request, `/api/renewal-cases/${caseId}/generate-quote-scenarios`)

  expect(first.caseId).toBe(caseId)
  expect(second.caseId).toBe(caseId)
  expect(second.generatedCount).toBe(first.generatedCount)
  expect(second.scenarioKeys).toEqual(first.scenarioKeys)

  await page.goto(`/scenario-quotes/${caseId}`)
  await waitForPageStable(page)
  const scenarioPanel = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: /Scenario Comparison/i }),
  })
  await expect(scenarioPanel).toBeVisible()
  await expect(page.getByRole('heading', { name: /AI Scenario Coach/i })).toBeVisible()
  expect(first.generatedCount).toBeGreaterThan(0)
  await expect(scenarioPanel.getByText(/Scenario Quote Navigator/i)).toBeVisible()
  await expect(scenarioPanel.getByText(/Read-only/i).first()).toBeVisible()
})

test('quote scenario comparison supports preferred scenario workflow', async ({ request, page }) => {
  const caseId = 'rcase_lumina_commerce'
  await postJson(request, `/api/renewal-cases/${caseId}/recalculate-quote-insights`)
  const generation = await postJson(request, `/api/renewal-cases/${caseId}/generate-quote-scenarios`)

  await page.goto(`/scenario-quotes/${caseId}`)
  await waitForPageStable(page)

  const scenarioPanel = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: /Scenario Comparison/i }),
  })
  await expect(scenarioPanel).toBeVisible()
  await expect(page.getByRole('heading', { name: /AI Scenario Coach/i })).toBeVisible()
  expect(generation.generatedCount).toBeGreaterThan(0)

  const firstScenarioButton = scenarioPanel.locator('button', { hasText: '#1' }).first()
  await firstScenarioButton.click()

  await expect(scenarioPanel.getByText(/Compare vs Baseline/i)).toBeVisible()
  await expect(scenarioPanel.getByText(/What Changed Commercially/i)).toBeVisible()
  await expect(scenarioPanel.getByText(/Line-Level Comparison/i)).toBeVisible()

  const markPreferredButton = scenarioPanel
    .getByRole('button', { name: /Mark as Preferred Scenario/i })
    .first()
  if (await markPreferredButton.isVisible()) {
    await markPreferredButton.click()
    await waitForPageStable(page)
  }

  await expect(
    scenarioPanel.getByRole('button', { name: /Preferred Scenario|Baseline is Preferred/i }).first(),
  ).toBeVisible()
})

test('baseline scenario indicator reflects generated count for first-run scenarios', async ({
  page,
  request,
}) => {
  const generated = await findCaseByScenarioExpectation(
    request,
    GENERATED_SCENARIO_CASE_IDS,
  )
  await page.goto(`/scenario-quotes/${generated.caseId}`)
  await waitForPageStable(page)

  const generatedPanel = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: /Scenario Comparison/i }),
  })
  await expect(generatedPanel).toBeVisible()
  const generatedBaselineButton = generatedPanel
    .locator('button', { hasText: 'Baseline Quote' })
    .first()
  await expect(generatedBaselineButton).toContainText(
    `System generated scenarios: ${generated.generation.generatedCount}`,
  )
})

test('scenario index shows scenario quote counts before opening studio', async ({
  page,
  request,
}) => {
  const generated = await findCaseByScenarioExpectation(
    request,
    GENERATED_SCENARIO_CASE_IDS,
  )

  await page.goto('/scenario-quotes')
  await waitForPageStable(page)

  await expect(page.getByText('With Scenarios', { exact: true })).toBeVisible()
  await expect(page.getByText('Generated Scenarios', { exact: true })).toBeVisible()

  const generatedRow = page.locator('tr').filter({
    has: page.locator(`a[href="/scenario-quotes/${generated.caseId}"]`),
  })
  await expect(generatedRow).toHaveCount(1)
  await expect(generatedRow).toContainText(
    `${generated.generation.generatedCount} scenario${
      generated.generation.generatedCount === 1 ? '' : 's'
    }`,
  )

  const horizonRow = page.locator('tr').filter({
    has: page.locator('a[href="/scenario-quotes/rcase_horizon_util"]'),
  })
  await expect(horizonRow).toHaveCount(1)
  await expect(horizonRow).toContainText(/\d+ scenarios?/)
})

test('scenario workspace auto-regenerates when marked stale', async ({ page, request }) => {
  const generated = await findCaseByScenarioExpectation(
    request,
    GENERATED_SCENARIO_CASE_IDS,
  )
  const caseId = generated.caseId

  const staleResponse = await postJson(request, `/api/renewal-cases/${caseId}/scenario`, {
    scenarioKey: 'ADOPTION_DECLINE',
  })
  expect(staleResponse.ok).toBe(true)

  await page.goto(`/scenario-quotes/${caseId}`)
  await waitForPageStable(page)

  const scenarioPanel = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: /Scenario Comparison/i }),
  })
  await expect(scenarioPanel).toBeVisible()
  await expect(scenarioPanel.getByText(/Quote scenarios may be outdated/i)).toHaveCount(0)
  await expect(scenarioPanel.getByText(/Last generated:/i)).toBeVisible()
  await expect(
    scenarioPanel.locator('button', { hasText: 'Baseline Quote' }).first(),
  ).toContainText(/System generated scenarios:\s*\d+/i)
})

test('preferred scenario remains coherent after regeneration', async ({ page, request }) => {
  const generated = await findCaseByScenarioExpectation(
    request,
    GENERATED_SCENARIO_CASE_IDS,
  )
  const caseId = generated.caseId
  const initialPreferredKey = generated.generation.scenarioKeys[0]

  expect(initialPreferredKey).toBeTruthy()
  const setPreferredResponse = await postJson(
    request,
    `/api/renewal-cases/${caseId}/preferred-quote-scenario`,
    { scenarioKey: initialPreferredKey },
  )
  expect(setPreferredResponse.ok).toBe(true)

  const regenerated = (await postJson(
    request,
    `/api/renewal-cases/${caseId}/generate-quote-scenarios`,
  )) as ScenarioGenerationResponse
  await page.goto(`/scenario-quotes/${caseId}`)
  await waitForPageStable(page)

  const scenarioPanel = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: /Scenario Comparison/i }),
  })
  await expect(scenarioPanel).toBeVisible()
  const preferredSummary = scenarioPanel.locator('.scenario-preferred-summary')
  await expect(preferredSummary).toBeVisible()

  if (regenerated.generatedCount > 0 && regenerated.scenarioKeys.includes(initialPreferredKey)) {
    await expect(preferredSummary).not.toContainText('Baseline Quote')
    await expect(
      scenarioPanel.getByRole('button', { name: /Preferred Scenario/i }).first(),
    ).toBeVisible()
    return
  }

  await expect(preferredSummary).toContainText('Baseline Quote')
  await expect(
    scenarioPanel.getByRole('button', { name: /Baseline is Preferred/i }).first(),
  ).toBeVisible()
})
