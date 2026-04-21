import type { ReactNode } from 'react'

export function ActionRail({
  primary,
  secondary,
  tertiary,
  hint,
}: {
  primary?: ReactNode
  secondary?: ReactNode
  tertiary?: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="action-rail">
      <div className="action-rail-buttons">
        {primary ? <div className="action-rail-slot action-rail-slot-primary">{primary}</div> : null}
        {secondary ? (
          <div className="action-rail-slot action-rail-slot-secondary">{secondary}</div>
        ) : null}
        {tertiary ? <div className="action-rail-slot action-rail-slot-tertiary">{tertiary}</div> : null}
      </div>
      {hint ? <div className="action-rail-hint small muted">{hint}</div> : null}
    </div>
  )
}
