export type WorkflowStepState = 'complete' | 'current' | 'upcoming'

export type WorkflowJourneyStep = {
  id: string
  label: string
  description: string
  href?: string
  state: WorkflowStepState
}

function stateLabel(state: WorkflowStepState) {
  if (state === 'complete') return 'Complete'
  if (state === 'current') return 'Current'
  return 'Upcoming'
}

export function WorkflowJourney({
  title = 'Workflow Journey',
  subtitle = 'Follow this order for the fastest end-to-end renewal review.',
  steps,
}: {
  title?: string
  subtitle?: string
  steps: WorkflowJourneyStep[]
}) {
  return (
    <section className="card workflow-journey">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
      </div>

      <ol className="workflow-journey-list">
        {steps.map((step, index) => (
          <li key={step.id} className={`workflow-journey-step ${step.state}`}>
            <div className="workflow-step-row">
              <span className="workflow-step-number">{index + 1}</span>
              <span className={`workflow-step-state ${step.state}`}>{stateLabel(step.state)}</span>
            </div>
            <div className="workflow-step-title">{step.label}</div>
            <p className="workflow-step-description">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
