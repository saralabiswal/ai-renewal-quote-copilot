import type { ScenarioPersonalizationView } from '@/lib/ai/scenario-personalization'
import type { QuoteScenarioWorkspaceView } from '@/lib/db/quote-scenarios'

function toneForDelta(value: number) {
  if (value > 0) return 'delta-positive'
  if (value < 0) return 'delta-negative'
  return 'delta-neutral'
}

function signedNumber(value: number, suffix = '') {
  if (value > 0) return `+${value.toFixed(1)}${suffix}`
  if (value < 0) return `${value.toFixed(1)}${suffix}`
  return `0.0${suffix}`
}

export function ScenarioStrategyCoachPanel({
  coach,
  workspace,
}: {
  coach: ScenarioPersonalizationView
  workspace: QuoteScenarioWorkspaceView
}) {
  return (
    <section className="card coach-shell">
      <div className="section-header">
        <div>
          <h3 className="panel-title">Phase 3 AI Personalization Coach</h3>
          <p className="section-subtitle">
            Account-aware scenario recommendation using weighted ARR, margin, and risk posture.
          </p>
        </div>
      </div>

      <div className="coach-chip-row">
        <span className="scenario-chip">{coach.personaSummary}</span>
        <span className="scenario-chip">Focus: {coach.strategyFocus.label}</span>
        {workspace.preferredScenarioKey ? (
          <span className="scenario-chip">Current Preferred: {workspace.preferredScenarioKey}</span>
        ) : (
          <span className="scenario-chip">Current Preferred: Baseline</span>
        )}
      </div>

      <div className="coach-grid">
        <div className="coach-card">
          <div className="small muted" style={{ fontWeight: 700 }}>
            Recommended Scenario
          </div>
          <div className="coach-recommendation-title">
            {coach.recommendation.scenarioKey
              ? `${coach.recommendation.strategyLabel} · ${coach.recommendation.title}`
              : 'No scenario recommendation available'}
          </div>
          <p className="coach-narrative">{coach.recommendation.explanation}</p>
          <div className="small muted">
            Personalized Score:{' '}
            {coach.recommendation.personalizedScore != null
              ? coach.recommendation.personalizedScore.toFixed(1)
              : '—'}
          </div>
          <p className="coach-narrative" style={{ marginTop: 8 }}>
            {coach.strategyFocus.reason}
          </p>
        </div>

        <div className="coach-card">
          <div className="small muted" style={{ fontWeight: 700 }}>
            Top Decision Drivers
          </div>
          <ul className="coach-list">
            {coach.topDrivers.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
          <p className="coach-narrative">
            Suggested flow: open the recommended scenario below, validate line-level deltas, then
            mark preferred.
          </p>
        </div>
      </div>

      <div className="coach-table-wrap">
        <table className="coach-table">
          <thead>
            <tr>
              <th>Personalized Rank</th>
              <th>Scenario</th>
              <th>Base Score</th>
              <th>Personalized Score</th>
              <th>ARR</th>
              <th>Margin</th>
              <th>Risk</th>
              <th>Highlight</th>
            </tr>
          </thead>
          <tbody>
            {coach.rankings.map((item, index) => (
              <tr key={item.scenarioId}>
                <td>{index + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    #{item.rank} {item.strategyLabel}
                  </div>
                  <div className="small muted">{item.scenarioKey}</div>
                </td>
                <td>{item.baseScore != null ? item.baseScore.toFixed(1) : '—'}</td>
                <td style={{ fontWeight: 700 }}>{item.personalizedScore.toFixed(1)}</td>
                <td className={toneForDelta(item.arrImpact)}>{signedNumber(item.arrImpact)}</td>
                <td className={toneForDelta(item.marginImpact)}>
                  {signedNumber(item.marginImpact, ' pts')}
                </td>
                <td className={toneForDelta(item.riskReduction)}>{signedNumber(item.riskReduction)}</td>
                <td>{item.highlight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
