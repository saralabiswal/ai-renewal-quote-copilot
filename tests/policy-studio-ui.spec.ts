import { test, expect } from '@playwright/test'
import { waitForPageStable } from './helpers'

test('policy studio renders seeded context and under-the-hood guidance', async ({ page }) => {
  await page.goto('/policies')
  await waitForPageStable(page)

  await expect(
    page.getByRole('heading', { name: /Policy Intelligence Workspace/i }),
  ).toBeVisible()

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

  await expect(
    page.getByText(/How the engine works under the hood \(business view\)/i),
  ).toBeVisible()
})

test('policy studio example selector updates selected subscription context', async ({ page }) => {
  await page.goto('/policies')
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

test('policy studio end-to-end visual flow tab renders a self-explanatory journey', async ({
  page,
}) => {
  await page.goto('/policies')
  await waitForPageStable(page)

  await page.getByRole('button', { name: /End-to-End Visual Flow/i }).click()
  await waitForPageStable(page)

  await expect(page.getByRole('heading', { name: /End-to-End Flow:/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Subscription Signals Ingested/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Risk Scoring Rules Applied/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Recommendation Rule Selected/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Quote Insight Generated/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Reviewer Action Outcome/i })).toBeVisible()
})
