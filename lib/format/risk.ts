import { Tone } from '@/types/renewal-case'

export function toneForRisk(risk: string | null | undefined): Tone {
  switch (risk) {
    case 'LOW':
      return 'success'
    case 'MEDIUM':
      return 'warn'
    case 'HIGH':
      return 'danger'
    default:
      return 'default'
  }
}

export function toneForAction(action: string | null | undefined): Tone {
  switch (action) {
    case 'RENEW_AS_IS':
    case 'RENEW':
      return 'success'
    case 'CONTROLLED_UPLIFT':
      return 'info'
    case 'RENEW_WITH_CONCESSION':
    case 'DEFENSIVE_RENEWAL':
    case 'UPLIFT_RESTRAINT':
      return 'warn'
    case 'EXPAND':
    case 'CROSS_SELL':
    case 'MARGIN_RECOVERY':
      return 'info'
    case 'MIXED_ACTION_PLAN':
      return 'warn'
    case 'ESCALATE':
      return 'danger'
    default:
      return 'default'
  }
}

export function toneForStatus(status: string | null | undefined): Tone {
  switch (status) {
    case 'READY_FOR_REVIEW':
      return 'info'
    case 'UNDER_REVIEW':
      return 'warn'
    case 'REVISED':
    case 'REQUEST_REVISION':
      return 'warn'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'danger'
    case 'DRAFT':
    default:
      return 'default'
  }
}

export function labelize(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}
