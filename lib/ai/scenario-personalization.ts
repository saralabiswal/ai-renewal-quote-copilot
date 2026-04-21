import type { QuoteScenarioWorkspaceView } from '@/lib/db/quote-scenarios'
import type { RenewalCaseDetailView } from '@/types/renewal-case'

type FocusProfile = {
  label: string
  reason: string
  arrWeight: number
  marginWeight: number
  riskWeight: number
}

export type ScenarioPersonalizationView = {
  personaSummary: string
  strategyFocus: {
    label: string
    reason: string
  }
  topDrivers: string[]
  recommendation: {
    scenarioId: string | null
    scenarioKey: string | null
    strategyLabel: string | null
    title: string | null
    personalizedScore: number | null
    explanation: string
  }
  rankings: Array<{
    scenarioId: string
    scenarioKey: string
    rank: number
    strategyLabel: string
    title: string
    baseScore: number | null
    personalizedScore: number
    arrImpact: number
    marginImpact: number
    riskReduction: number
    highlight: string
  }>
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function normalize(value: number, min: number, max: number) {
  if (max - min < 0.00001) return 0.5
  return (value - min) / (max - min)
}

function minMax(values: number[]) {
  if (values.length === 0) {
    return { min: 0, max: 0 }
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function buildFocusProfile(caseView: RenewalCaseDetailView): FocusProfile {
  const risk = caseView.riskLevel.toLowerCase()
  const segment = caseView.account.segment.toLowerCase()
  const action = caseView.recommendedActionLabel.toLowerCase()

  if (risk.includes('critical') || risk.includes('high') || action.includes('retention')) {
    return {
      label: 'Retention-first',
      reason: 'High risk posture favors risk reduction with controlled concessions.',
      arrWeight: 0.22,
      marginWeight: 0.23,
      riskWeight: 0.55,
    }
  }

  if (segment.includes('enterprise')) {
    return {
      label: 'Margin-disciplined',
      reason: 'Enterprise renewals prioritize margin consistency and defensible pricing.',
      arrWeight: 0.24,
      marginWeight: 0.52,
      riskWeight: 0.24,
    }
  }

  if (action.includes('expand') || action.includes('upsell') || segment.includes('mid')) {
    return {
      label: 'Growth-leaning',
      reason: 'Growth posture emphasizes ARR expansion while preserving acceptable risk.',
      arrWeight: 0.5,
      marginWeight: 0.2,
      riskWeight: 0.3,
    }
  }

  return {
    label: 'Balanced',
    reason: 'Balanced posture blends ARR, margin, and risk in equal measure.',
    arrWeight: 0.34,
    marginWeight: 0.33,
    riskWeight: 0.33,
  }
}

function makePersonaSummary(caseView: RenewalCaseDetailView) {
  const industry = caseView.account.industry ? ` · ${caseView.account.industry}` : ''
  return `${caseView.account.name} · ${caseView.account.segment}${industry} · Risk ${caseView.riskLevel} · Action ${caseView.recommendedActionLabel}`
}

function driverText(key: 'arr' | 'margin' | 'risk', weight: number) {
  if (key === 'arr') {
    return `ARR impact weighted at ${Math.round(weight * 100)}% for this account posture.`
  }
  if (key === 'margin') {
    return `Margin impact weighted at ${Math.round(weight * 100)}% to protect commercial quality.`
  }
  return `Risk reduction weighted at ${Math.round(weight * 100)}% due to retention sensitivity.`
}

function highlightForScenario(values: {
  arrImpact: number
  marginImpact: number
  riskReduction: number
  arrWeight: number
  marginWeight: number
  riskWeight: number
}) {
  const weighted = [
    { key: 'arr' as const, score: values.arrImpact * values.arrWeight },
    { key: 'margin' as const, score: values.marginImpact * values.marginWeight },
    { key: 'risk' as const, score: values.riskReduction * values.riskWeight },
  ].sort((a, b) => b.score - a.score)

  if (weighted[0]?.key === 'arr') return 'Best aligned for ARR expansion.'
  if (weighted[0]?.key === 'margin') return 'Best aligned for margin protection.'
  return 'Best aligned for risk reduction.'
}

export function buildScenarioPersonalizationView(
  caseView: RenewalCaseDetailView,
  workspace: QuoteScenarioWorkspaceView,
): ScenarioPersonalizationView {
  const focus = buildFocusProfile(caseView)
  const topDrivers = [
    { key: 'arr' as const, weight: focus.arrWeight },
    { key: 'margin' as const, weight: focus.marginWeight },
    { key: 'risk' as const, weight: focus.riskWeight },
  ]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((item) => driverText(item.key, item.weight))

  const baselineNet = workspace.baselineQuote?.totalNetAmount ?? 0
  const baselineDiscount = workspace.baselineQuote?.totalDiscountPercent ?? 0

  const raw = workspace.scenarios.map((scenario) => {
    const arrImpact =
      scenario.expectedArrImpact ??
      (scenario.quote ? scenario.quote.totalNetAmount - baselineNet : 0)
    const marginImpact =
      scenario.expectedMarginImpact ??
      (scenario.quote ? baselineDiscount - scenario.quote.totalDiscountPercent : 0)
    const riskReduction = scenario.expectedRiskReduction ?? 0
    const baseScore = scenario.rankingScore ?? 0

    return {
      scenarioId: scenario.id,
      scenarioKey: scenario.scenarioKey,
      rank: scenario.rank,
      strategyLabel: scenario.strategyLabel,
      title: scenario.title,
      arrImpact,
      marginImpact,
      riskReduction,
      baseScore,
    }
  })

  if (raw.length === 0) {
    return {
      personaSummary: makePersonaSummary(caseView),
      strategyFocus: {
        label: focus.label,
        reason: focus.reason,
      },
      topDrivers,
      recommendation: {
        scenarioId: null,
        scenarioKey: null,
        strategyLabel: null,
        title: null,
        personalizedScore: null,
        explanation:
          'No scenarios are currently available. Regenerate quote scenarios to produce personalized recommendations.',
      },
      rankings: [],
    }
  }

  const arrRange = minMax(raw.map((item) => item.arrImpact))
  const marginRange = minMax(raw.map((item) => item.marginImpact))
  const riskRange = minMax(raw.map((item) => item.riskReduction))
  const baseRange = minMax(raw.map((item) => item.baseScore))

  const rankings = raw
    .map((item) => {
      const arrNorm = normalize(item.arrImpact, arrRange.min, arrRange.max)
      const marginNorm = normalize(item.marginImpact, marginRange.min, marginRange.max)
      const riskNorm = normalize(item.riskReduction, riskRange.min, riskRange.max)
      const baseNorm = normalize(item.baseScore, baseRange.min, baseRange.max)

      const personalizedScore =
        (baseNorm * 0.35 +
          (arrNorm * focus.arrWeight + marginNorm * focus.marginWeight + riskNorm * focus.riskWeight) *
            0.65) *
        100

      return {
        ...item,
        personalizedScore: round1(personalizedScore),
        highlight: highlightForScenario({
          arrImpact: arrNorm,
          marginImpact: marginNorm,
          riskReduction: riskNorm,
          arrWeight: focus.arrWeight,
          marginWeight: focus.marginWeight,
          riskWeight: focus.riskWeight,
        }),
      }
    })
    .sort((a, b) => {
      const delta = b.personalizedScore - a.personalizedScore
      if (delta !== 0) return delta
      return a.rank - b.rank
    })

  const top = rankings[0]

  return {
    personaSummary: makePersonaSummary(caseView),
    strategyFocus: {
      label: focus.label,
      reason: focus.reason,
    },
    topDrivers,
    recommendation: {
      scenarioId: top.scenarioId,
      scenarioKey: top.scenarioKey,
      strategyLabel: top.strategyLabel,
      title: top.title,
      personalizedScore: top.personalizedScore,
      explanation: `Recommended based on ${focus.label.toLowerCase()} weighting and strongest combined score for ARR, margin, and risk.`,
    },
    rankings,
  }
}
