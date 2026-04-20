export type StoryLaneId =
  | 'BASELINE_RENEWALS'
  | 'RETENTION_PROTECTION'
  | 'MARGIN_OPTIMIZATION'
  | 'GROWTH_EXPANSION'
  | 'COMPLEX_ORCHESTRATION'
  | 'STANDARD_REVIEW'

export type StoryLane = {
  id: StoryLaneId
  label: string
  description: string
  order: number
}

const STORY_LANES: Record<StoryLaneId, StoryLane> = {
  BASELINE_RENEWALS: {
    id: 'BASELINE_RENEWALS',
    label: 'Baseline Renewals',
    description: 'Low-friction renewals that preserve commercial posture and protect continuity.',
    order: 10,
  },
  RETENTION_PROTECTION: {
    id: 'RETENTION_PROTECTION',
    label: 'Retention Protection',
    description: 'Defensive and concession-led paths to protect logo retention and renew on time.',
    order: 20,
  },
  MARGIN_OPTIMIZATION: {
    id: 'MARGIN_OPTIMIZATION',
    label: 'Margin Optimization',
    description: 'Discount normalization plays that recover margin while managing churn exposure.',
    order: 30,
  },
  GROWTH_EXPANSION: {
    id: 'GROWTH_EXPANSION',
    label: 'Growth Expansion',
    description: 'Expansion and cross-sell motions that increase ARR across the account footprint.',
    order: 40,
  },
  COMPLEX_ORCHESTRATION: {
    id: 'COMPLEX_ORCHESTRATION',
    label: 'Complex AI Orchestration',
    description: 'Multi-product plans that combine actions and rely on reviewer oversight.',
    order: 50,
  },
  STANDARD_REVIEW: {
    id: 'STANDARD_REVIEW',
    label: 'Standard Review',
    description: 'Default review lane for recommendations not mapped to a specific storyline.',
    order: 90,
  },
}

const ACTION_TO_STORY_LANE: Partial<Record<string, StoryLaneId>> = {
  RENEW_AS_IS: 'BASELINE_RENEWALS',
  CONTROLLED_UPLIFT: 'BASELINE_RENEWALS',

  RENEW_WITH_CONCESSION: 'RETENTION_PROTECTION',
  DEFENSIVE_RENEWAL: 'RETENTION_PROTECTION',
  UPLIFT_RESTRAINT: 'RETENTION_PROTECTION',

  MARGIN_RECOVERY: 'MARGIN_OPTIMIZATION',

  EXPAND: 'GROWTH_EXPANSION',
  CROSS_SELL: 'GROWTH_EXPANSION',

  MIXED_ACTION_PLAN: 'COMPLEX_ORCHESTRATION',
  ESCALATE: 'COMPLEX_ORCHESTRATION',
}

export function storyLaneForAction(action: string | null | undefined): StoryLane {
  const laneId = action ? ACTION_TO_STORY_LANE[action] : null
  return laneId ? STORY_LANES[laneId] : STORY_LANES.STANDARD_REVIEW
}

export type QuoteTrack = {
  key: 'PRIMARY_RENEW_AS_IS'
  label: string
  description: string
}

export function primaryQuoteTrack(): QuoteTrack {
  return {
    key: 'PRIMARY_RENEW_AS_IS',
    label: 'Primary Quote',
    description: 'Renew-as-is baseline quote for this renewal case.',
  }
}
