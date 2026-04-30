import { expect, Page } from '@playwright/test'

export async function getSummaryValue(page: Page, label: string) {
  const legacyCard = page.locator('.summary-card').filter({
    has: page.locator(`.summary-label:text-is("${label}")`),
  })

  if ((await legacyCard.count()) > 0) {
    await expect(legacyCard).toHaveCount(1)
    return (await legacyCard.locator('.summary-value').textContent())?.trim() ?? ''
  }

  const modernPrimaryCard = page.locator('.quote-summary-primary-card').filter({
    has: page.locator(`.stat-label:text-is("${label}")`),
  })

  if ((await modernPrimaryCard.count()) > 0) {
    await expect(modernPrimaryCard).toHaveCount(1)
    const primaryValueLocator = modernPrimaryCard.locator('.quote-summary-value')
    await expect(primaryValueLocator).toBeVisible()
    return (await primaryValueLocator.textContent())?.trim() ?? ''
  }

  const modernCard = page.locator('.card').filter({
    has: page.locator(`.stat-label:text-is("${label}")`),
  })
  await expect(modernCard).toHaveCount(1)
  const modernValueLocator = modernCard.locator('.stat-value, .quote-summary-value').first()
  await expect(modernValueLocator).toBeVisible()
  return (await modernValueLocator.textContent())?.trim() ?? ''
}

export async function waitForPageStable(page: Page) {
  await page.waitForLoadState('networkidle')
}

export async function openCommandTab(page: Page, tabName: string | RegExp) {
  const tab = page.getByRole('button', { name: tabName })
  if ((await tab.count()) > 0) {
    await tab.first().click()
    await waitForPageStable(page)
  }
}

type ClickInsightActionOptions = {
  allowAlreadyApplied?: boolean
}

export async function clickInsightAction(
  page: Page,
  titleText: string,
  options: ClickInsightActionOptions = {},
) {
  await openCommandTab(page, /Apply Quote Actions/i)

  const card = page.locator('.opportunity-card').filter({
    has: page.locator(`.opportunity-title:text-is("${titleText}")`),
  })

  await expect(card).toHaveCount(1)

  const button = card.getByRole('button').filter({
    hasText: /Add to Quote|Apply to Renewal Line/i,
  })

  if ((await button.count()) > 0) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/renewal-cases/') &&
          response.url().includes('/add-to-quote') &&
          response.ok(),
      ),
      button.first().click(),
    ])

    await expect(card).toContainText(/Added to Quote|Applied to Renewal Line/i)
    return { card, actionTaken: true as const }
  }

  if (options.allowAlreadyApplied) {
    await expect(card).toContainText(/Added to Quote|Applied to Renewal Line/i)
    return { card, actionTaken: false as const }
  }

  await expect(button).toBeVisible()
  await button.first().click()
  await waitForPageStable(page)

  return { card, actionTaken: true as const }
}
