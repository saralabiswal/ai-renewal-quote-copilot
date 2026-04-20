import { test, expect } from '@playwright/test'
import { clickInsightAction, getSummaryValue, waitForPageStable } from './helpers'

test('quote header totals reflect updated line pricing after applying an insight', async ({
  page,
}) => {
  await page.goto('/quote-drafts/qd_orion_revenue')
  await waitForPageStable(page)

  const beforeTotalNet = await getSummaryValue(page, 'Total Net Amount')

  await page.goto('/renewal-cases/rcase_orion_revenue')
  await waitForPageStable(page)

  const modifierTitle = 'Normalize discounting on Subscription Management'
  const action = await clickInsightAction(page, modifierTitle, {
    allowAlreadyApplied: true,
  })

  await page.goto('/quote-drafts/qd_orion_revenue')
  await waitForPageStable(page)

  const afterTotalNet = await getSummaryValue(page, 'Total Net Amount')

  if (action.actionTaken) {
    expect(afterTotalNet).not.toEqual(beforeTotalNet)
  } else {
    expect(afterTotalNet).toEqual(beforeTotalNet)
  }

  await expect(page.locator('body')).toContainText('Source Quote Insight: qi_007')
  await expect(page.locator('body')).toContainText('Commercial Change')
})
