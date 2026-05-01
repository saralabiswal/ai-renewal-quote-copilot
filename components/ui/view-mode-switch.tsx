'use client'

import { ReactNode, useState } from 'react'

type ViewMode = 'business' | 'technical'

export function ViewModeSwitch({
  business,
  technical,
  businessLabel = 'Business View',
  technicalLabel = 'Technical View',
}: {
  business: ReactNode
  technical: ReactNode
  businessLabel?: string
  technicalLabel?: string
}) {
  const [mode, setMode] = useState<ViewMode>('business')

  return (
    <div className="view-mode-shell">
      <div className="view-mode-toggle" role="tablist" aria-label="View mode">
        <button
          type="button"
          className={`view-mode-button ${mode === 'business' ? 'active' : ''}`}
          onClick={() => setMode('business')}
          aria-pressed={mode === 'business'}
        >
          {businessLabel}
        </button>
        <button
          type="button"
          className={`view-mode-button ${mode === 'technical' ? 'active' : ''}`}
          onClick={() => setMode('technical')}
          aria-pressed={mode === 'technical'}
        >
          {technicalLabel}
        </button>
      </div>

      <div className="view-mode-panel">
        {mode === 'business' ? business : technical}
      </div>
    </div>
  )
}
