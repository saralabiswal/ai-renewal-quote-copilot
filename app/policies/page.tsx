import { PageHeader } from '@/components/layout/page-header'
import { PoliciesWorkspace } from '@/components/policies/policies-workspace'
import { getPricingPolicies } from '@/lib/db/policies'
import {
  quoteInsightRuleSections,
  quoteInsightRuleSources,
  recommendationRuleSections,
  recommendationRuleSources,
} from '@/lib/policies/rule-reference'
import {
  buildWorkedPolicyExamples,
  WORKED_EXAMPLE_PRODUCT_OPTIONS,
} from '@/lib/policies/worked-example'

export default async function PoliciesPage() {
  const pricingPolicies = await getPricingPolicies()
  const workedExamples = buildWorkedPolicyExamples(pricingPolicies)

  return (
    <div className="page">
      <PageHeader
        title="Policy Studio"
        description="Transparent read-only rulebook for how recommendations and quote insights are generated."
      />

      <PoliciesWorkspace
        pricingPolicies={pricingPolicies}
        recommendationSections={recommendationRuleSections}
        recommendationSources={recommendationRuleSources}
        insightSections={quoteInsightRuleSections}
        insightSources={quoteInsightRuleSources}
        workedExamples={workedExamples}
        workedExampleOptions={WORKED_EXAMPLE_PRODUCT_OPTIONS}
      />
    </div>
  )
}
