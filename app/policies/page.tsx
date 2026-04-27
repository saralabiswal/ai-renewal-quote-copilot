import { PageHeader } from '@/components/layout/page-header'
import { PoliciesWorkspace } from '@/components/policies/policies-workspace'
import {
  getPolicyStudioExampleSeeds,
  getPolicyStudioSeedProfile,
  getPricingPolicies,
} from '@/lib/db/policies'
import {
  insightFlowSteps,
  quoteInsightRuleSections,
  quoteInsightRuleSources,
  recommendationFlowSteps,
  recommendationRuleSections,
  recommendationRuleSources,
} from '@/lib/policies/rule-reference'
import {
  buildDefaultWorkedExamples,
  buildWorkedExampleOptionsFromSeeds,
  buildWorkedPolicyExamplesFromSeeds,
} from '@/lib/policies/worked-example'
import { getMlRuntimeConfig } from '@/lib/ml/config'

export const dynamic = 'force-dynamic'

export default async function PoliciesPage() {
  const pricingPolicies = await getPricingPolicies()
  const mlConfig = getMlRuntimeConfig()
  const [seedProfile, policyStudioSeeds] = await Promise.all([
    getPolicyStudioSeedProfile(),
    getPolicyStudioExampleSeeds(6),
  ])

  const workedExamples =
    policyStudioSeeds.length > 0
      ? buildWorkedPolicyExamplesFromSeeds(pricingPolicies, policyStudioSeeds)
      : buildDefaultWorkedExamples(pricingPolicies)
  const workedExampleOptions = buildWorkedExampleOptionsFromSeeds(policyStudioSeeds)

  return (
    <div className="page">
      <PageHeader
        title="Policy Studio"
        description="Transparent read-only rulebook for how recommendations and quote insights are generated."
        purpose="Understand the business logic behind recommendation and quote insight outputs."
        nextStep="Use worked examples to explain why a case was scored and routed a certain way."
      />

      <PoliciesWorkspace
        mlMode={mlConfig.mode}
        mlEnabled={mlConfig.enabled}
        mlAffectsRecommendations={mlConfig.affectsRecommendations}
        mlModelName={mlConfig.registryModelName}
        mlModelVersion={mlConfig.registryModelVersion}
        pricingPolicies={pricingPolicies}
        recommendationSections={recommendationRuleSections}
        recommendationSources={recommendationRuleSources}
        recommendationFlowSteps={recommendationFlowSteps}
        insightSections={quoteInsightRuleSections}
        insightSources={quoteInsightRuleSources}
        insightFlowSteps={insightFlowSteps}
        workedExamples={workedExamples}
        workedExampleOptions={workedExampleOptions}
        seedProfile={seedProfile}
      />
    </div>
  )
}
