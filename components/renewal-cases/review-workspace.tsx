'use client'

import { useState } from 'react'
import { RenewalCaseAnalysisPanel } from '@/components/renewal-cases/renewal-case-analysis-panel'
import { RenewalCaseItemsTable } from '@/components/renewal-cases/renewal-case-items-table'
import { ReviewHistoryPanel } from '@/components/renewal-cases/review-history-panel'
import type {
  RecalculationMetaView,
  RecommendationNarrativeView,
  RenewalCaseAnalysisView,
  RenewalCaseItemView,
  ReviewDecisionView,
} from '@/types/renewal-case'

type LeftTab = 'analysis' | 'items' | 'history'
type RightTab = 'summary' | 'approval' | 'rationale' | 'metadata'

export function RenewalCaseReviewWorkspace({
  analysis,
  items,
  reviewHistory,
  aiExecutiveSummary,
  aiApprovalBrief,
  narrative,
  recalculationMeta,
}: {
  analysis: RenewalCaseAnalysisView | null
  items: RenewalCaseItemView[]
  reviewHistory: ReviewDecisionView[]
  aiExecutiveSummary: RecommendationNarrativeView | null
  aiApprovalBrief: RecommendationNarrativeView | null
  narrative: RecommendationNarrativeView | null
  recalculationMeta: RecalculationMetaView
}) {
  const [leftTab, setLeftTab] = useState<LeftTab>('analysis')
  const [rightTab, setRightTab] = useState<RightTab>('summary')

  const showApprovalBrief = recalculationMeta.approvalRequired

  return (
    <section className="review-workspace-grid">
      <div className="review-workspace-main">
        <div className="card workspace-shell">
          <div className="workspace-header">
            <h3 className="panel-title">Case Review Workspace</h3>
            <p className="section-subtitle">
              Switch tabs to focus on one section at a time and reduce page scrolling.
            </p>
          </div>

          <div className="workspace-tabbar" role="tablist" aria-label="Case review sections">
            <button
              type="button"
              className={`workspace-tab ${leftTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setLeftTab('analysis')}
              aria-pressed={leftTab === 'analysis'}
            >
              Bundle Analysis
            </button>
            <button
              type="button"
              className={`workspace-tab ${leftTab === 'items' ? 'active' : ''}`}
              onClick={() => setLeftTab('items')}
              aria-pressed={leftTab === 'items'}
            >
              Subscription Items ({items.length})
            </button>
            <button
              type="button"
              className={`workspace-tab ${leftTab === 'history' ? 'active' : ''}`}
              onClick={() => setLeftTab('history')}
              aria-pressed={leftTab === 'history'}
            >
              Review History ({reviewHistory.length})
            </button>
          </div>
        </div>

        {leftTab === 'analysis' ? (
          <RenewalCaseAnalysisPanel analysis={analysis} />
        ) : leftTab === 'items' ? (
          <RenewalCaseItemsTable items={items} />
        ) : (
          <ReviewHistoryPanel reviewHistory={reviewHistory} />
        )}
      </div>

      <aside className="review-workspace-side">
        <div className="workspace-side-sticky">
          <div className="card workspace-shell">
            <div className="workspace-header">
              <h3 className="panel-title">AI Review Guidance</h3>
              <p className="section-subtitle">
                Narrative and metadata insights for fast reviewer decisions.
              </p>
            </div>

            <div className="workspace-tabbar" role="tablist" aria-label="Guidance sections">
              <button
                type="button"
                className={`workspace-tab ${rightTab === 'summary' ? 'active' : ''}`}
                onClick={() => setRightTab('summary')}
                aria-pressed={rightTab === 'summary'}
              >
                Summary
              </button>
              {showApprovalBrief ? (
                <button
                  type="button"
                  className={`workspace-tab ${rightTab === 'approval' ? 'active' : ''}`}
                  onClick={() => setRightTab('approval')}
                  aria-pressed={rightTab === 'approval'}
                >
                  Approval Brief
                </button>
              ) : null}
              <button
                type="button"
                className={`workspace-tab ${rightTab === 'rationale' ? 'active' : ''}`}
                onClick={() => setRightTab('rationale')}
                aria-pressed={rightTab === 'rationale'}
              >
                Rationale
              </button>
              <button
                type="button"
                className={`workspace-tab ${rightTab === 'metadata' ? 'active' : ''}`}
                onClick={() => setRightTab('metadata')}
                aria-pressed={rightTab === 'metadata'}
              >
                Metadata
              </button>
            </div>
          </div>

          {rightTab === 'summary' ? (
            <div className="card guidance-review-card">
              <section className="guidance-section">
                <div className="guidance-section-head">
                  <div className="guidance-section-title">Executive Summary</div>
                  <div className="small muted">
                    Generated by {aiExecutiveSummary?.modelLabel ?? 'Not generated'}
                  </div>
                </div>
                <div className="guidance-section-content">
                  {aiExecutiveSummary?.content ?? (
                    <span className="muted">No AI executive summary has been generated yet.</span>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {rightTab === 'approval' ? (
            <div className="card guidance-review-card">
              <section className="guidance-section">
                <div className="guidance-section-head">
                  <div className="guidance-section-title">Approval Brief</div>
                  <div className="small muted">
                    Generated by {aiApprovalBrief?.modelLabel ?? 'Not generated'}
                  </div>
                </div>
                <div className="guidance-section-content">
                  {aiApprovalBrief?.content ?? (
                    <span className="muted">No approval brief has been generated.</span>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {rightTab === 'rationale' ? (
            <div className="card guidance-review-card">
              <section className="guidance-section">
                <div className="guidance-section-head">
                  <div className="guidance-section-title">Rationale</div>
                  <div className="small muted">
                    Generated by {narrative?.modelLabel ?? 'Not generated'}
                  </div>
                </div>
                <div className="guidance-section-content">
                  {narrative?.content ?? <span className="muted">No rationale is available.</span>}
                </div>
              </section>
            </div>
          ) : null}

          {rightTab === 'metadata' ? (
            <div className="card guidance-metadata-card">
              <div className="guidance-metadata-grid">
                <div className="guidance-metadata-item">
                  <div className="small muted">Last Recalculated</div>
                  <div>{recalculationMeta.updatedAtLabel ?? 'Not available'}</div>
                </div>
                <div className="guidance-metadata-item">
                  <div className="small muted">Analysis Version</div>
                  <div>{recalculationMeta.analysisVersion ?? '—'}</div>
                </div>
                <div className="guidance-metadata-item">
                  <div className="small muted">Generated By</div>
                  <div>{recalculationMeta.generatedBy ?? '—'}</div>
                </div>
                <div className="guidance-metadata-item">
                  <div className="small muted">Approval Required</div>
                  <div>{recalculationMeta.approvalRequired ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div className="guidance-drivers">
                <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                  Top Drivers
                </div>
                {recalculationMeta.drivers.length > 0 ? (
                  <div className="guidance-driver-list">
                    {recalculationMeta.drivers.slice(0, 4).map((driver, index) => (
                      <span className="guidance-driver-chip" key={`${index}-${driver}`}>
                        {driver}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="small muted">No drivers available.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  )
}
