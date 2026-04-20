import { test, expect, APIRequestContext } from '@playwright/test'
import { waitForPageStable } from './helpers'

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

  const row = page.locator('tr').filter({ hasText: 'RC-ACCT-1001' })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('UNDER REVIEW')

  await page.goto('/renewal-cases/rcase_apex_mfg')
  await waitForPageStable(page)
  await expect(page.getByText('Quote Insights may be outdated')).toBeVisible()
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

  const row = page.locator('tr').filter({ hasText: 'Q-ACCT-1011' })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('APPROVED')

  await page.goto('/renewal-cases/rcase_harbor_fin')
  await waitForPageStable(page)

  await page.getByRole('button', { name: /Review History/i }).click()

  const reviewPanel = page.locator('.card', {
    has: page.getByRole('heading', { name: 'Review History' }),
  })
  await expect(reviewPanel).toBeVisible()
  await expect(reviewPanel).toContainText('APPROVE')
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
  await expect(page.getByText('Source Quote Insight: qi_017')).toHaveCount(1)
})
