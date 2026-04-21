export function PageHeader({
  title,
  description,
  purpose,
  nextStep,
  actions,
}: {
  title: string
  description?: string
  purpose?: string
  nextStep?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        <h1>{title}</h1>
        {description ? <p className="page-header-description">{description}</p> : null}
        {purpose || nextStep ? (
          <div className="page-header-guidance">
            {purpose ? (
              <p className="page-header-purpose">
                <strong>Purpose:</strong> {purpose}
              </p>
            ) : null}
            {nextStep ? (
              <p className="page-header-next">
                <strong>Next:</strong> {nextStep}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  )
}
