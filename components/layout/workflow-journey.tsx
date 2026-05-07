import Link from 'next/link'

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
  const currentIndex = steps.findIndex((step) => step.state === 'current')
  const completedCount = steps.filter((step) => step.state === 'complete').length

  return (
    <section className="card workflow-journey">
      <div className="workflow-journey-head">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <div className="workflow-journey-progress">
          {currentIndex >= 0 ? `Step ${currentIndex + 1} of ${steps.length}` : `${completedCount} of ${steps.length} complete`}
        </div>
      </div>

      <ol className="workflow-journey-list">
        {steps.map((step, index) => {
          const content = (
            <>
              <span className="workflow-step-number">{index + 1}</span>
              <span className="workflow-step-copy">
                <span className="workflow-step-title">{step.label}</span>
                <span className="workflow-step-description">{step.description}</span>
              </span>
              <span className={`workflow-step-state ${step.state}`}>{stateLabel(step.state)}</span>
            </>
          )

          return (
            <li key={step.id} className={`workflow-journey-step ${step.state}`}>
              {step.href ? (
                <Link className="workflow-step-target workflow-step-link" href={step.href as never}>
                  {content}
                </Link>
              ) : (
                <div className="workflow-step-target">{content}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
