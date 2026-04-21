import Link from 'next/link'
import { GenerateQuoteScenariosButton } from '@/components/renewal-cases/generate-quote-scenarios-button'
import { QuoteScenariosNavigator } from '@/components/renewal-cases/quote-scenarios-navigator'
import type { QuoteScenarioWorkspaceView } from '@/lib/db/quote-scenarios'

export function QuoteScenariosPanel({
  caseId,
  workspace,
}: {
  caseId: string
  workspace: QuoteScenarioWorkspaceView
}) {
  return (
    <section className="card">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="panel-title">Baseline Quote and Quote Scenarios</h3>
          <p className="section-subtitle">
            Baseline quote remains the primary editable draft. Compare ranked scenarios against
            baseline and mark a preferred scenario while keeping scenario quotes read-only.
          </p>
        </div>
      </div>

      <div className="scenario-panel-actions">
        <div className="small muted">
          {workspace.generatedAtLabel
            ? `Last generated: ${workspace.generatedAtLabel}`
            : 'Scenarios not generated yet.'}
        </div>

        <div className="scenario-state-actions">
          <GenerateQuoteScenariosButton
            caseId={caseId}
            label="Regenerate Quote Scenarios"
            loadingLabel="Regenerating Quote Scenarios..."
            buttonClassName="button-link"
          />
          <Link className="button-tertiary" href={`/renewal-cases/${caseId}`}>
            Open Decision Workspace
          </Link>
        </div>
      </div>

      {workspace.needsRefresh ? (
        <div className="scenario-state-callout scenario-state-callout-warn">
          <div style={{ fontWeight: 600 }}>Quote scenarios may be outdated</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Recommendation or quote insights changed. Regenerate scenarios to align with latest
            decision state.
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Next step: click <strong>Regenerate Quote Scenarios</strong> before comparing options.
          </div>
        </div>
      ) : null}

      {workspace.baselineQuote ? (
        <QuoteScenariosNavigator workspace={workspace} />
      ) : (
        <div className="scenario-state-callout scenario-state-callout-neutral" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>No baseline quote draft is linked to this case yet.</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Next step: open Decision Workspace and apply quote insights to create the baseline quote.
          </div>
          <div className="scenario-state-actions" style={{ marginTop: 8 }}>
            <Link className="button-link" href={`/renewal-cases/${caseId}`}>
              Open Decision Workspace
            </Link>
          </div>
        </div>
      )}
      {workspace.baselineQuote && workspace.scenarios.length === 0 ? (
        <div className="scenario-state-callout scenario-state-callout-neutral">
          <div style={{ fontWeight: 600 }}>No scenarios generated yet.</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {workspace.lastRunSummary?.suppressedReason
              ? `No scenarios generated: ${workspace.lastRunSummary.suppressedReason}`
              : 'No quote scenarios generated yet.'}
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Next step: regenerate scenarios after confirming recommendation and insights are up to date.
          </div>
        </div>
      ) : null}
    </section>
  )
}
