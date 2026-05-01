import { PageHeader } from '@/components/layout/page-header'
import { PoliciesWorkspace } from '@/components/policies/policies-workspace'
import { Badge } from '@/components/ui/badge'
import { ViewModeSwitch } from '@/components/ui/view-mode-switch'
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
        title="Policy Playbook"
        description="Plain-language view of how renewal recommendations and quote insights are governed."
        purpose="Start with the business explanation, then switch to Technical View for registry, prompts, data model, and change control."
        nextStep="Use Business View for demo storytelling. Use Technical View for audit and implementation detail."
      />

      <ViewModeSwitch
        business={
          <div className="business-view-stack">
            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">How the Policy Works</h2>
                  <p className="section-subtitle">
                    The policy layer converts customer signals into governed renewal actions.
                    It is designed to explain recommendations without exposing implementation
                    internals first.
                  </p>
                </div>
              </div>

              <div className="business-flow">
                <div className="business-flow-step">
                  <span>1</span>
                  <strong>Customer Signals</strong>
                  <p>Usage, adoption, support, CSAT, payment risk, and commercial context.</p>
                </div>
                <div className="business-flow-step">
                  <span>2</span>
                  <strong>Recommendation</strong>
                  <p>Rules decide renew, expand, concession, or escalation candidates.</p>
                </div>
                <div className="business-flow-step">
                  <span>3</span>
                  <strong>Quote Insight</strong>
                  <p>Recommended actions become quote guidance for each renewal line.</p>
                </div>
                <div className="business-flow-step">
                  <span>4</span>
                  <strong>Guardrail</strong>
                  <p>Discount, floor price, and escalation rules protect the deal.</p>
                </div>
                <div className="business-flow-step">
                  <span>5</span>
                  <strong>Review</strong>
                  <p>Approval-required lines are routed to the right reviewer.</p>
                </div>
                <div className="business-flow-step">
                  <span>6</span>
                  <strong>Audit</strong>
                  <p>Every decision is traceable to evidence, policy, and final output.</p>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Business Rule Summary</h2>
                  <p className="section-subtitle">
                    These are the plain-English rules to use in the demo conversation.
                  </p>
                </div>
              </div>
              <div className="business-summary-grid">
                <article className="business-summary-card">
                  <Badge tone="info">Expansion</Badge>
                  <h3>Strong adoption creates expansion motion</h3>
                  <p>
                    High usage and healthy engagement can move a renewal line toward expansion,
                    while pricing guardrails still control discount and approval.
                  </p>
                </article>
                <article className="business-summary-card">
                  <Badge tone="warn">Retention</Badge>
                  <h3>Risk creates concession or escalation motion</h3>
                  <p>
                    Weak adoption, support burden, or severe incidents can route the case toward
                    concession, defensive renewal, or review.
                  </p>
                </article>
                <article className="business-summary-card">
                  <Badge tone="success">Governed</Badge>
                  <h3>Policy protects final quote actions</h3>
                  <p>
                    Quote insights can suggest actions, but quote math, product catalog boundaries,
                    and approvals stay deterministic.
                  </p>
                </article>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">What Technical View Adds</h2>
                  <p className="section-subtitle">
                    Technical View keeps the detail for governance users without making it the
                    first thing business reviewers see.
                  </p>
                </div>
              </div>
              <div className="business-summary-grid">
                <article className="business-summary-card">
                  <Badge tone="default">Rulebook</Badge>
                  <h3>Recommendation and insight rules</h3>
                  <p>{recommendationRuleSections.length} recommendation sections and {quoteInsightRuleSections.length} insight sections.</p>
                </article>
                <article className="business-summary-card">
                  <Badge tone="default">Data</Badge>
                  <h3>Data model and source refs</h3>
                  <p>Technical users can inspect tables, source files, prompt contracts, and policy registry details.</p>
                </article>
                <article className="business-summary-card">
                  <Badge tone="default">Change Control</Badge>
                  <h3>Promotion workflow</h3>
                  <p>Policy comparison, approval workflow, and promotion packet export remain available.</p>
                </article>
              </div>
            </section>
          </div>
        }
        technical={
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
        }
      />
    </div>
  )
}
