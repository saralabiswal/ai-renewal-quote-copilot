import { test, expect } from '@playwright/test'
import { waitForPageStable } from './helpers'

test('modifier insight updates existing renewal line instead of creating a new line', async ({
  page,
}) => {
  await page.goto('/renewal-cases/rcase_bluepeak')
  await waitForPageStable(page)

  const modifierTitle = 'Protect NetSuite renewal with a controlled concession'
  const appliedCard = page.locator('.opportunity-card').filter({
    has: page.locator(`.opportunity-title:text-is("${modifierTitle}")`),
  })

  await expect(appliedCard).toHaveCount(1)

  const applyButton = appliedCard
    .getByRole('button')
    .filter({ hasText: /Add to Quote|Apply to Renewal Line/i })

  if ((await applyButton.count()) > 0) {
    await applyButton.first().click()
    await waitForPageStable(page)
  }

  await expect(appliedCard).toContainText(/Added to Quote|Applied to Renewal Line/i)

  await page.goto('/quote-drafts/qd_bluepeak')
  await waitForPageStable(page)

  const lineRows = page.locator('tbody > tr').filter({ hasText: 'Oracle NetSuite' })
  await expect(lineRows.first()).toBeVisible()

  await expect(page.locator('body')).toContainText(/Source Quote Insight: qi_/i)
  await expect(page.locator('body')).toContainText('Commercial Change')
  await expect(page.locator('body')).toContainText('Commercial Insight')
})
