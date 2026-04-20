export const DEMO_SCENARIO_KEYS = [
  'BASE_CASE',
  'ADOPTION_DECLINE',
  'MARGIN_RECOVERY',
  'EXPANSION_UPSIDE',
  'CUSTOMER_RISK_ESCALATION',
] as const

export type DemoScenarioKey = (typeof DEMO_SCENARIO_KEYS)[number]

export type MetricOverride = {
  usagePercentOfEntitlementDelta?: number
  activeUserPercentDelta?: number
  loginTrend30dDelta?: number
  ticketCount90dDelta?: number
  sev1Count90dDelta?: number
  csatScoreDelta?: number
  tagNotes?: string[]
}

export type DemoScenarioDefinition = {
  label: string
  description: string
  overrides: MetricOverride
}

export const DEMO_SCENARIOS: Record<DemoScenarioKey, DemoScenarioDefinition> = {
  BASE_CASE: {
    label: 'Base Case',
    description: 'Use seeded baseline signals with no overrides.',
    overrides: {},
  },
  ADOPTION_DECLINE: {
    label: 'Adoption Decline',
    description: 'Push usage down, worsen login trend, and increase support burden.',
    overrides: {
      usagePercentOfEntitlementDelta: -18,
      activeUserPercentDelta: -12,
      loginTrend30dDelta: -14,
      ticketCount90dDelta: 4,
      sev1Count90dDelta: 1,
      csatScoreDelta: -0.7,
      tagNotes: ['usage decline'],
    },
  },
  MARGIN_RECOVERY: {
    label: 'Margin Recovery',
    description: 'Improve commercial confidence while preserving healthy adoption.',
    overrides: {
      usagePercentOfEntitlementDelta: 4,
      activeUserPercentDelta: 3,
      loginTrend30dDelta: 3,
      ticketCount90dDelta: -1,
      csatScoreDelta: 0.2,
    },
  },
  EXPANSION_UPSIDE: {
    label: 'Expansion Upside',
    description: 'Push adoption near capacity and strengthen adjacent fit.',
    overrides: {
      usagePercentOfEntitlementDelta: 12,
      activeUserPercentDelta: 10,
      loginTrend30dDelta: 8,
      ticketCount90dDelta: -1,
      csatScoreDelta: 0.3,
      tagNotes: ['adjacent whitespace', 'data modernization fit', 'hybrid deployment preference'],
    },
  },
  CUSTOMER_RISK_ESCALATION: {
    label: 'Customer Risk Escalation',
    description: 'Combine weak usage, support stress, and satisfaction decline.',
    overrides: {
      usagePercentOfEntitlementDelta: -25,
      activeUserPercentDelta: -18,
      loginTrend30dDelta: -18,
      ticketCount90dDelta: 6,
      sev1Count90dDelta: 1,
      csatScoreDelta: -1.0,
      tagNotes: ['customer risk escalation'],
    },
  },
}

export function isDemoScenarioKey(value: string): value is DemoScenarioKey {
  return (DEMO_SCENARIO_KEYS as readonly string[]).includes(value)
}

export function toDemoScenarioKey(
  value: string | null | undefined,
  fallback: DemoScenarioKey = 'BASE_CASE',
): DemoScenarioKey {
  if (!value) return fallback
  return isDemoScenarioKey(value) ? value : fallback
}
