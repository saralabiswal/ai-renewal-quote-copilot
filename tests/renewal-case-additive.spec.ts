import { test, expect } from '@playwright/test'
import { openCommandTab, waitForPageStable } from './helpers'

test('additive insight creates a new quote line', async ({ page }) => {
  await page.goto('/renewal-cases/rcase_quantum_grid')
  await waitForPageStable(page)
  await openCommandTab(page, /Apply Quote Actions/i)

  const additiveCard = page
    .locator('.opportunity-card')
    .filter({ hasText: /Oracle Cloud@Customer/i })
    .filter({ hasText: /Hybrid Deployment Fit/i })

  await expect(additiveCard).toHaveCount(1)

  const applyButton = additiveCard
    .getByRole('button')
    .filter({ hasText: /Add to Quote|Apply to Renewal Line/i })

  if ((await applyButton.count()) > 0) {
    await applyButton.first().click()
    await waitForPageStable(page)
  }

  await expect(additiveCard).toContainText(/Added to Quote|Applied to Renewal Line/i)

  await page.goto('/quote-drafts/qd_quantum_grid')
  await waitForPageStable(page)

  await expect(page.locator('body')).toContainText('Oracle Cloud@Customer')
  await expect(page.locator('body')).toContainText(/ai suggested/i)
  await expect(page.locator('body')).toContainText('Hybrid Deployment Fit')
  await expect(page.locator('body')).toContainText(/Source Quote Insight: qi_/i)
})
