'use client'

import { useState } from 'react'
import { RenewalCaseAnalysisPanel } from '@/components/renewal-cases/renewal-case-analysis-panel'
import { RenewalCaseItemsTable } from '@/components/renewal-cases/renewal-case-items-table'
import { ReviewHistoryPanel } from '@/components/renewal-cases/review-history-panel'
import { labelize } from '@/lib/format/risk'
import type {
  RecalculationMetaView,
  RecommendationNarrativeView,
  RenewalCaseAnalysisView,
  RenewalCaseItemView,
  ReviewDecisionView,
} from '@/types/renewal-case'

type LeftTab = 'analysis' | 'items' | 'history'
type RightTab = 'summary' | 'approval' | 'evidence'

export function RenewalCaseReviewWorkspace({
  analysis,
  items,
  reviewHistory,
  aiExecutiveSummary,
  aiApprovalBrief,
  narrative,
  reasoningRecommendation,
  reasoningApproval,
  reasoningWhatChanged,
  recalculationMeta,
  layout = 'side-by-side',
}: {
  analysis: RenewalCaseAnalysisView | null
  items: RenewalCaseItemView[]
  reviewHistory: ReviewDecisionView[]
  aiExecutiveSummary: RecommendationNarrativeView | null
  aiApprovalBrief: RecommendationNarrativeView | null
  narrative: RecommendationNarrativeView | null
  reasoningRecommendation: RecommendationNarrativeView | null
  reasoningApproval: RecommendationNarrativeView | null
  reasoningWhatChanged: RecommendationNarrativeView | null
  recalculationMeta: RecalculationMetaView
  layout?: 'side-by-side' | 'guidance-first'
}) {
  const [leftTab, setLeftTab] = useState<LeftTab>('analysis')
  const [rightTab, setRightTab] = useState<RightTab>('summary')

  const showApprovalBrief = recalculationMeta.approvalRequired

  return (
    <section className={`review-workspace-grid ${layout === 'guidance-first' ? 'guidance-first' : ''}`}>
      <div className="review-workspace-main">
        <div className="card workspace-shell">
          <div className="workspace-header">
            <h3 className="panel-title">Renewal Review Intelligence</h3>
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
              <h3 className="panel-title">Review Guidance</h3>
              <p className="section-subtitle">
                Concise reviewer narrative with evidence available on demand.
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
                  Approval
                </button>
              ) : null}
              <button
                type="button"
                className={`workspace-tab ${rightTab === 'evidence' ? 'active' : ''}`}
                onClick={() => setRightTab('evidence')}
                aria-pressed={rightTab === 'evidence'}
              >
                Evidence
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
              {reasoningApproval ? (
                <details className="guidance-evidence-details">
                  <summary>View Approval Evidence</summary>
                  <div className="small muted">Generated by {reasoningApproval.modelLabel}</div>
                  <div className="guidance-section-content">{reasoningApproval.content}</div>
                </details>
              ) : null}
            </div>
          ) : null}

          {rightTab === 'evidence' ? (
            <div className="card guidance-review-card">
              <section className="guidance-section">
                <div className="guidance-section-head">
                  <div className="guidance-section-title">Recommendation Explanation</div>
                  <div className="small muted">
                    Generated by {narrative?.modelLabel ?? 'Not generated'}
                  </div>
                </div>
                <div className="guidance-section-content">
                  {narrative?.content ?? <span className="muted">No rationale is available.</span>}
                </div>
              </section>

              <details className="guidance-evidence-details">
                <summary>View Evidence-Based Reasoning</summary>
                <div className="small muted">
                  Generated by {reasoningRecommendation?.modelLabel ?? 'Not generated'}
                </div>
                <div className="guidance-section-content">
                  {reasoningRecommendation?.content ?? (
                    <span className="muted">
                      No recommendation reasoning has been generated yet.
                    </span>
                  )}
                </div>
              </details>

              <details className="guidance-evidence-details">
                <summary>View What Changed Reasoning</summary>
                <div className="small muted">
                  Generated by {reasoningWhatChanged?.modelLabel ?? 'Not generated'}
                </div>
                <div className="guidance-section-content">
                  {reasoningWhatChanged?.content ?? (
                    <span className="muted">
                      No change reasoning has been generated yet.
                    </span>
                  )}
                </div>
              </details>

              <GuidanceMetadataFooter recalculationMeta={recalculationMeta} />
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  )
}

function GuidanceMetadataFooter({
  recalculationMeta,
}: {
  recalculationMeta: RecalculationMetaView
}) {
  return (
    <div className="guidance-metadata-footer">
      <span>Last recalculated: {recalculationMeta.updatedAtLabel ?? 'Not available'}</span>
      <span>Version: {recalculationMeta.analysisVersion ?? '—'}</span>
      <span>Generated by: {formatDisplayLabel(recalculationMeta.generatedBy)}</span>
      {recalculationMeta.ml ? (
        <span>
          ML: {formatDisplayLabel(recalculationMeta.ml.status)}
          {recalculationMeta.ml.bundleRiskScore != null
            ? ` / ${Math.round(recalculationMeta.ml.bundleRiskScore)}`
            : ''}
        </span>
      ) : null}
    </div>
  )
}

function formatDisplayLabel(value: string | null | undefined) {
  if (!value) return '—'
  return labelize(value)
}
