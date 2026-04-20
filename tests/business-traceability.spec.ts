import { test, expect, APIRequestContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CASE_ID = 'rcase_aster_commerce'

async function postJson(
  request: APIRequestContext,
  path: string,
  body?: Record<string, unknown>,
) {
  const response = await request.post(path, {
    data: body,
    headers: { 'Content-Type': 'application/json' },
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

test.describe.serial('business traceability', () => {
  test('scenario API rejects unsupported scenario keys', async ({ request }) => {
  const { response, payload } = await postJson(
    request,
    `/api/renewal-cases/${CASE_ID}/scenario`,
    { scenarioKey: 'INVALID_SCENARIO_KEY' },
  )

  expect(response.status()).toBe(400)
  expect(payload?.ok).toBe(false)
  expect(String(payload?.error ?? '')).toContain('Invalid scenario key')
  })

  test('recalculated quote insights persist v2 business decision envelope', async ({ request }) => {
  const recalc = await request.post(`/api/renewal-cases/${CASE_ID}/recalculate-quote-insights`)
  expect(recalc.ok()).toBeTruthy()

  const insight = await prisma.quoteInsight.findFirst({
    where: {
      renewalCaseId: CASE_ID,
      status: 'SUGGESTED',
      justificationJson: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      justificationJson: true,
    },
  })

  expect(insight).not.toBeNull()
  const parsed = JSON.parse(String(insight?.justificationJson ?? '{}'))
  expect(parsed.version).toBe('v2')
  expect(typeof parsed?.decisionMeta?.decisionRunId).toBe('string')
  expect(typeof parsed?.decisionMeta?.engineVersion).toBe('string')
  expect(Array.isArray(parsed.reasonCodes)).toBeTruthy()
  expect((parsed.reasonCodes ?? []).length).toBeGreaterThan(0)
  expect(Array.isArray(parsed.ruleHits)).toBeTruthy()
  })

  test('generate-ai keeps one narrative record per narrative type', async ({ request }) => {
  const first = await request.post(`/api/renewal-cases/${CASE_ID}/generate-ai`)
  expect(first.ok()).toBeTruthy()

  const second = await request.post(`/api/renewal-cases/${CASE_ID}/generate-ai`)
  expect(second.ok()).toBeTruthy()

  const narratives = await prisma.recommendationNarrative.findMany({
    where: {
      renewalCaseId: CASE_ID,
      scopeType: 'CASE',
    },
    select: {
      narrativeType: true,
    },
  })

  const countsByType = narratives.reduce<Record<string, number>>((acc, row) => {
    acc[row.narrativeType] = (acc[row.narrativeType] ?? 0) + 1
    return acc
  }, {})

  expect(countsByType.EXECUTIVE_SUMMARY).toBe(1)
  expect(countsByType.RATIONALE).toBe(1)

  for (const [type, count] of Object.entries(countsByType)) {
    if (type.startsWith('QUOTE_INSIGHT_')) {
      expect(count).toBe(1)
    }
  }
  })

  test('adding insight to quote uses AI narrative content for line rationale', async ({ request }) => {
  await request.post(`/api/renewal-cases/${CASE_ID}/regenerate-insights-ai`)

  const insight = await prisma.quoteInsight.findFirst({
    where: {
      renewalCaseId: CASE_ID,
      status: 'SUGGESTED',
    },
    orderBy: [{ fitScore: 'desc' }, { confidenceScore: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      renewalCaseId: true,
      recommendedActionSummary: true,
    },
  })

  expect(insight).not.toBeNull()

  const endpoint = `/api/renewal-cases/${CASE_ID}/quote-insights/${insight!.id}/add-to-quote`
  const { response } = await postJson(request, endpoint)
  expect(response.ok()).toBeTruthy()

  const [line, narrative] = await Promise.all([
    prisma.quoteDraftLine.findFirst({
      where: {
        sourceQuoteInsightId: insight!.id,
      },
      select: {
        aiExplanation: true,
      },
    }),
    prisma.recommendationNarrative.findFirst({
      where: {
        scopeType: 'CASE',
        renewalCaseId: insight!.renewalCaseId,
        narrativeType: `QUOTE_INSIGHT_${insight!.id}`,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        content: true,
      },
    }),
  ])

  expect(line).not.toBeNull()
  expect(line?.aiExplanation ?? null).toBe(narrative?.content ?? null)
  if (narrative?.content) {
    expect(line?.aiExplanation ?? null).not.toBe(insight?.recommendedActionSummary ?? null)
  }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })
})
