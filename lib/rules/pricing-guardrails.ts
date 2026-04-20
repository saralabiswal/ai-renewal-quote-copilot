import { roundMoney, toNumber } from './helpers'
import type { GuardrailResult, RuleCaseItemInput } from './types'

export interface GuardrailEvaluation {
  recommendedDiscountPercent: number
  proposedQuantity: number
  proposedNetUnitPrice: number
  proposedArr: number
  approvalRequired: boolean
  guardrailResult: GuardrailResult
}

export function applyPricingGuardrails(
  input: RuleCaseItemInput,
  proposedDiscountPercent: number,
  proposedQuantity: number,
): GuardrailEvaluation {
  const subscription = input.subscription
  const policy = input.pricingPolicy
  const listUnitPrice = toNumber(subscription.listUnitPrice)
  const maxAutoDiscount = toNumber(policy?.maxAutoDiscountPercent, 12)
  const approvalDiscount = toNumber(policy?.approvalDiscountPercent, 15)
  const floorPricePercentOfList = toNumber(policy?.floorPricePercentOfList, 80)
  const sev1EscalationThreshold = toNumber(policy?.requiresEscalationIfSev1Count, 99)
  const sev1Count = toNumber(input.metricSnapshot?.sev1Count90d, 0)

  let approvalRequired = false
  let guardrailResult: GuardrailResult = 'WITHIN_POLICY'

  let effectiveDiscount = proposedDiscountPercent
  if (proposedDiscountPercent > maxAutoDiscount) {
    approvalRequired = true
    guardrailResult = 'APPROVAL_REQUIRED'
  }
  if (proposedDiscountPercent >= approvalDiscount) {
    approvalRequired = true
    guardrailResult = 'APPROVAL_REQUIRED'
  }

  const proposedNetUnitPrice = roundMoney(listUnitPrice * (1 - effectiveDiscount / 100))
  const priceAsPercentOfList = listUnitPrice === 0 ? 0 : (proposedNetUnitPrice / listUnitPrice) * 100

  if (priceAsPercentOfList < floorPricePercentOfList) {
    approvalRequired = true
    guardrailResult = 'FLOOR_PRICE_EXCEPTION'
  }

  if (sev1Count >= sev1EscalationThreshold) {
    approvalRequired = true
    guardrailResult = 'SEV1_ESCALATION'
  }

  const proposedArr = roundMoney(proposedQuantity * proposedNetUnitPrice)

  return {
    recommendedDiscountPercent: effectiveDiscount,
    proposedQuantity,
    proposedNetUnitPrice,
    proposedArr,
    approvalRequired,
    guardrailResult,
  }
}
