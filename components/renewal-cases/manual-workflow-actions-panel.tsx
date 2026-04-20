'use client'

import { useState } from 'react'
import { GenerateAiButton } from '@/components/renewal-cases/generate-ai-button'
import { RecalculateButton } from '@/components/renewal-cases/recalculate-button'
import { RegenerateInsightsAiButton } from '@/components/renewal-cases/regenerate-insights-ai-button'

export function ManualWorkflowActionsPanel({ caseId }: { caseId: string }) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="manual-workflow-shell">
      <div className="manual-workflow-head">
        <div className="small muted" style={{ fontWeight: 600 }}>
          Workflow Actions
        </div>
        <button
          type="button"
          className="button-secondary manual-panel-toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded ? (
        <div className="manual-workflow-grid">
          <div className="manual-workflow-step-card">
            <div className="small muted" style={{ marginBottom: 4 }}>
              Step 1
            </div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Recommendation</div>
            <RecalculateButton
              caseId={caseId}
              label="Regenerate Recommendation"
              loadingLabel="Regenerating Recommendation..."
              buttonClassName="button-link"
            />
          </div>

          <div className="manual-workflow-step-card">
            <div className="small muted" style={{ marginBottom: 4 }}>
              Step 2
            </div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Insights + AI</div>
            <RegenerateInsightsAiButton
              caseId={caseId}
              label="Regenerate Insights + AI Rationale"
              loadingLabel="Regenerating Insights + AI Rationale..."
              buttonClassName="button-link"
            />
          </div>

          <div className="manual-workflow-step-card">
            <div className="small muted" style={{ marginBottom: 4 }}>
              Step 3
            </div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Full AI Guidance (Optional)</div>
            <GenerateAiButton
              caseId={caseId}
              label="Generate Full AI Review Guidance"
              loadingLabel="Generating Full AI Review Guidance..."
              buttonClassName="button-secondary"
            />
          </div>
        </div>
      ) : (
        <div className="small muted">
          Expand to run the manual step-by-step workflow actions.
        </div>
      )}
    </div>
  )
}
