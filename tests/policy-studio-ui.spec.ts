import { test, expect } from '@playwright/test'
import { waitForPageStable } from './helpers'

test('policy playbook renders seeded context and under-the-hood guidance', async ({ page }) => {
  await page.goto('/policies')
  await waitForPageStable(page)

  await expect(
    page.getByRole('heading', { name: /^Policy Playbook$/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /How the Policy Works/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Technical View' }).click()
  await waitForPageStable(page)

  const seedContext = page.locator('section.policy-step-card').filter({
    has: page.getByRole('heading', { name: /Seed Data Context/i }),
  })
  await expect(seedContext).toBeVisible()
  await expect(seedContext).toContainText(/Subscriptions Loaded/i)
  await expect(seedContext).toContainText(/Signal Snapshots/i)
  await expect(seedContext).toContainText(/Snapshot Window/i)

  const trajectorySection = page.locator('section.policy-step-card').filter({
    has: page.getByRole('heading', { name: /Signal Trajectory/i }),
  })
  await expect(trajectorySection).toBeVisible()
  const trajectoryRows = trajectorySection.locator('tbody tr')
  await expect(trajectoryRows.first()).toBeVisible()
})

test('policy playbook example selector updates selected subscription context', async ({ page }) => {
  await page.goto('/policies')
  await waitForPageStable(page)
  await page.getByRole('button', { name: 'Technical View' }).click()
  await waitForPageStable(page)

  const exampleSelect = page.locator('#worked-policy-product')
  await expect(exampleSelect).toBeVisible()

  const optionCount = await exampleSelect.locator('option').count()
  expect(optionCount).toBeGreaterThan(0)
  if (optionCount < 2) return

  const contextBadge = page.locator('.policy-example-badges').getByText(/SUB-/).first()
  await expect(contextBadge).toBeVisible()
  const beforeContext = (await contextBadge.textContent())?.trim() ?? ''

  await exampleSelect.selectOption({ index: 1 })
  await waitForPageStable(page)

  const afterContext = (await contextBadge.textContent())?.trim() ?? ''
  expect(afterContext).not.toEqual(beforeContext)
})

test('policy playbook end-to-end visual flow tab renders a self-explanatory journey', async ({
  page,
}) => {
  await page.goto('/policies')
  await waitForPageStable(page)
  await page.getByRole('button', { name: 'Technical View' }).click()
  await waitForPageStable(page)

  await page.getByRole('button', { name: /End-to-End Visual Flow/i }).click()
  await waitForPageStable(page)

  await expect(page.getByRole('heading', { name: /Explainable Renewal Decision Flow/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Recommendation Engine/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Quote Insight Engine/i })).toBeVisible()
  await expect(page.getByText(/Read case signals/i)).toBeVisible()
  await expect(page.getByText(/Score each renewal line/i)).toBeVisible()
  await expect(page.getByText(/Map disposition to insight type/i)).toBeVisible()
  await expect(page.getByText(/Create quote actions and scenarios/i)).toBeVisible()
})

test('policy playbook prompt governance tab shows versioned prompt packs and guardrails', async ({
  page,
}) => {
  await page.goto('/policies')
  await waitForPageStable(page)
  await page.getByRole('button', { name: 'Technical View' }).click()
  await waitForPageStable(page)

  await page.getByRole('button', { name: /Prompt Governance/i }).click()
  await waitForPageStable(page)

  await expect(page.getByRole('heading', { name: /Current LLM Prompts/i })).toBeVisible()
  await expect(page.getByText(/System Prompt \(Exact\)/i).first()).toBeVisible()
  await expect(page.getByText(/Input Sent To LLM/i).first()).toBeVisible()
  await expect(page.getByText(/Step 2: Quote Insights, then AI Rationales/i)).toBeVisible()
  await expect(page.getByText(/Prompt Sources/i)).toBeVisible()
  await expect(page.getByText(/Access & Guardrails/i)).toBeVisible()
})
