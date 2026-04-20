import type { ItemRiskResult } from './types'

export function buildItemAnalysisSummary(item: ItemRiskResult): string {
  const lead = item.recommendedDisposition === 'EXPAND'
    ? 'Expansion opportunity identified.'
    : item.recommendedDisposition === 'RENEW_WITH_CONCESSION'
      ? 'Retention-oriented concession recommended.'
      : item.recommendedDisposition === 'ESCALATE'
        ? 'Leadership or deal-desk review required.'
        : 'Renewal posture remains stable.'

  const topDrivers = item.drivers.slice(0, 2).join(' ')
  return `${lead} ${topDrivers}`.trim()
}

export function buildCaseNarrative(accountName: string, summaryText: string, primaryDrivers: string[]): string {
  const driverText = primaryDrivers.slice(0, 3).join(' ')
  return `${summaryText} Key signals for ${accountName}: ${driverText}`.trim()
}
