import Link from 'next/link'

const workspaceLanes = [
  {
    id: 'business',
    title: 'Business Workspace',
    user: 'Business User',
    goal: 'Operate renewals and approve quote outcomes.',
    href: '/business-home',
    action: 'Open Business Home',
    steps: [
      'Review Renewal Subscriptions',
      'Review Baseline Quote',
      'Review Scenario Quote',
      'Open Scenario Quote Generation Trace when explanation is needed',
    ],
    proof: 'Subscription scope, baseline quote, scenario quote, and optional generation trace are understood.',
  },
  {
    id: 'architecture',
    title: 'Architecture Console',
    user: 'Architecture User',
    goal: 'Review trust, governance, runtime posture, and traceability.',
    href: '/settings',
    action: 'Open AI Architecture',
    steps: [
      'Confirm runtime posture',
      'Inspect policy and guardrails',
      'Validate decision trace',
      'Inspect Scenario Quote Generation Trace',
    ],
    proof: 'Rules, ML, LLM, scenario quote generation, guardrails, and reviewer controls are explainable.',
  },
  {
    id: 'developer',
    title: 'Developer Workbench',
    user: 'Developer User',
    goal: 'Run, reset, test, and extend the local demo.',
    href: '/readme-preview',
    action: 'Open Developer Guide',
    steps: [
      'Reset clean data',
      'Run build and tests',
      'Inspect APIs and scripts',
      'Debug Scenario Quote Generation Trace',
    ],
    proof: 'Build passes, seed data loads, workflow contracts validate, and generation trace can be debugged.',
  },
]

export function AudienceFlowWorkspace() {
  return (
    <div className="audience-flow-page audience-flow-page-lean">
      <section className="flow-map-hero card">
        <div>
          <span className="audience-kicker">Start Here</span>
          <h2>Choose the workspace by the question being asked.</h2>
          <p>
            Use this page as the orientation layer. The sidebar holds the permanent structure; this
            map simply tells each audience where to start and what proof to look for.
          </p>
        </div>
        <div className="flow-map-rule">
          <strong>Simple rule</strong>
          <span>Business operates. Architecture verifies. Developer runs and extends.</span>
        </div>
      </section>

      <section className="flow-map-lanes" aria-label="Workspace lanes">
        {workspaceLanes.map((lane, laneIndex) => (
          <article key={lane.id} className={`flow-map-lane flow-map-lane-${lane.id}`}>
            <div className="flow-map-lane-head">
              <span>{lane.user}</span>
              <h3>{lane.title}</h3>
              <p>{lane.goal}</p>
            </div>

            <ol className="flow-map-steps">
              {lane.steps.map((step, stepIndex) => (
                <li key={step}>
                  <span>{stepIndex + 1}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>

            <div className="flow-map-proof">
              <span>Proof</span>
              <p>{lane.proof}</p>
            </div>

            <Link className={laneIndex === 0 ? 'button-link' : 'button-secondary'} href={lane.href as never}>
              {lane.action}
            </Link>
          </article>
        ))}
      </section>

      <section className="flow-map-shared card">
        <div>
          <h2>Shared Evidence Layer</h2>
          <p>
            All three paths meet at the same evidence story: policy input, ML output, guarded AI
            behavior, quote action, and final reviewer decision.
          </p>
        </div>
        <div className="flow-map-shared-rail" aria-label="Shared evidence sequence">
          <span>Signals</span>
          <span>Rules</span>
          <span>ML</span>
          <span>Guardrails</span>
          <span>Quote</span>
          <span>Review</span>
        </div>
      </section>
    </div>
  )
}
