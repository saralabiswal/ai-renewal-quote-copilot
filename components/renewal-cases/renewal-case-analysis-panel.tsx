import { Badge } from '@/components/ui/badge'
import { RenewalCaseAnalysisView } from '@/types/renewal-case'

export function RenewalCaseAnalysisPanel({ analysis }: { analysis: RenewalCaseAnalysisView | null }) {
  if (!analysis) {
    return (
      <div className="card">
        <h3 className="panel-title">Bundle Analysis</h3>
        <p className="muted">No analysis available.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="panel-title">Bundle Analysis</h3>
      <div className="actions" style={{ marginBottom: 12 }}>
        <Badge tone={analysis.actionTone}>{analysis.recommendedActionLabel}</Badge>
        <Badge tone={analysis.riskTone}>{analysis.riskLevel}</Badge>
        {analysis.approvalRequired ? <Badge tone="warn">Approval Required</Badge> : null}
      </div>
      <div className="kv"><div className="muted">Pricing posture</div><div>{analysis.pricingPostureLabel}</div></div>
      <div className="kv"><div className="muted">Summary</div><div>{analysis.bundleSummaryText ?? 'No summary available.'}</div></div>
      <div style={{ marginTop: 16 }}>
        <div className="stat-label">Primary drivers</div>
        <ul className="list">
          {analysis.primaryDrivers.length > 0 ? analysis.primaryDrivers.map((driver) => (
            <li key={driver}>{driver}</li>
          )) : <li className="muted">No primary drivers available.</li>}
        </ul>
      </div>
    </div>
  )
}
