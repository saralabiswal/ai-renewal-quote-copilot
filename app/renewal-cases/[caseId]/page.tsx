import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRenewalCaseById } from '@/lib/db/renewal-cases'
import { getQuoteInsightsByRenewalCaseId } from '@/lib/db/quote-insights'
import { Badge } from '@/components/ui/badge'
import { CommandCenterWorkspace } from '@/components/renewal-cases/command-center-workspace'

export default async function RenewalCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params

  const [renewalCase, quoteInsights] = await Promise.all([
    getRenewalCaseById(caseId),
    getQuoteInsightsByRenewalCaseId(caseId),
  ])

  if (!renewalCase) {
    notFound()
  }

  const casePurpose =
    'Optional explanation console for how recommendation, quote insight, and scenario quote evidence are generated.'
  const caseNextStep = quoteInsights.needsRefresh
    ? 'Regenerate the workflow only if the scenario quote evidence needs refresh.'
    : 'Review subscriptions, baseline quote, and scenario quote first; use this page when generation details are needed.'

  return (
    <div className="page">
      <section className="card renewal-workspace-hero">
        <div className="renewal-workspace-main">
          <div className="renewal-workspace-title-row">
            <div>
              <h1 className="renewal-workspace-title">Scenario Quote Generation Trace</h1>
              <p className="renewal-workspace-subtitle">
                Optional workspace for explaining and regenerating the scenario quote generation path.
              </p>
              <div className="page-header-guidance" style={{ marginTop: 10 }}>
                <p className="page-header-purpose">
                  <strong>Purpose:</strong> {casePurpose}
                </p>
                <p className="page-header-next">
                  <strong>Next:</strong> {caseNextStep}
                </p>
              </div>
            </div>

            <div className="renewal-header-badges">
              <Badge tone={renewalCase.riskTone}>{renewalCase.riskLevel}</Badge>
              <Badge tone={renewalCase.actionTone}>{renewalCase.recommendedActionLabel}</Badge>
              {quoteInsights.needsRefresh ? <Badge tone="warn">Insights Need Refresh</Badge> : null}
            </div>
          </div>

          <div className="renewal-context-grid command-hero-grid">
            <div className="renewal-context-item">
              <div className="small muted">Case</div>
              <div className="renewal-context-value">{renewalCase.caseNumber}</div>
            </div>
            <div className="renewal-context-item">
              <div className="small muted">Account</div>
              <div className="renewal-context-value">{renewalCase.account.name}</div>
            </div>
            <div className="renewal-context-item">
              <div className="small muted">Window</div>
              <div className="renewal-context-value">{renewalCase.windowLabel}</div>
            </div>
            {renewalCase.summaryCards.slice(0, 3).map((card) => (
              <div className="renewal-context-item" key={card.label}>
                <div className="small muted">{card.label}</div>
                <div className="renewal-context-value">{card.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="renewal-header-actions">
          <div className="renewal-action-panel">
            <div className="renewal-action-panel-head">
              <div className="small muted" style={{ fontWeight: 700 }}>
                Generation Trace Actions
              </div>
              <div className="small muted">
                Approval Required: {renewalCase.recalculationMeta.approvalRequired ? 'Yes' : 'No'}
              </div>
            </div>

            {renewalCase.quoteDraft ? (
              <div className="renewal-quote-link-row">
                <div>
                  <div className="small muted" style={{ fontWeight: 600 }}>
                    Linked Quote
                  </div>
                  <div className="small muted">
                    {renewalCase.quoteDraft.quoteNumber} · {renewalCase.quoteDraft.totalNetAmountFormatted}
                  </div>
                </div>
                <Link className="button-link" href={`/quote-drafts/${renewalCase.quoteDraft.id}`}>
                  Open Baseline Quote
                </Link>
              </div>
            ) : (
              <div className="small muted">
                No baseline quote draft linked yet. Apply quote insights in Quote Actions to create one.
              </div>
            )}

            <div className="small muted">
              Final approve, reject, and revision actions are completed from Baseline Quote Review.
            </div>
          </div>
        </div>
      </section>

      <CommandCenterWorkspace renewalCase={renewalCase} quoteInsights={quoteInsights} />
    </div>
  )
}
