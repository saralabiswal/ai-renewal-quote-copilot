'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DemoScenarioSelector } from '@/components/renewal-cases/demo-scenario-selector'
import { labelize } from '@/lib/format/risk'
import {
  buildRedactedVariablePreview,
  getPromptArtifactsForStage,
  getPromptStageMeta,
} from '@/lib/policies/prompt-governance'

type StepKey = 'recalculate' | 'insights_ai' | 'full_ai'
type StepStatus = 'pending' | 'running' | 'done' | 'error'

type WorkflowStep = {
  key: StepKey
  title: string
  subtitle: string
  status: StepStatus
  detail: string | null
}

type RunLogItem = {
  id: string
  atLabel: string
  message: string
  tone: 'default' | 'success' | 'danger'
}

type WorkflowSummary = {
  totalMs: number
  regeneratedCount: number
  addedCount: number
  modifiedCount: number
  removedCount: number
  quoteInsightNarratives: number
  caseNarratives: number
  reasoningNarratives: number
  approvalBriefGenerated: boolean
}

type StreamLine = {
  id: string
  atLabel: string
  stepTitle: string
  text: string
  tone: 'default' | 'success' | 'danger'
  typing: boolean
}

const DEFAULT_STEPS: WorkflowStep[] = [
  {
    key: 'recalculate',
    title: 'Recalculate Recommendation',
    subtitle: 'Runs risk, disposition, and bundle recommendation logic.',
    status: 'pending',
    detail: null,
  },
  {
    key: 'insights_ai',
    title: 'Generate Quote Insights, then AI Rationales',
    subtitle: 'Finalizes quote insights first, then writes separate explanation narratives.',
    status: 'pending',
    detail: null,
  },
  {
    key: 'full_ai',
    title: 'Generate Full AI Review Guidance',
    subtitle: 'Creates executive summary, rationale, evidence reasoning, and approval brief.',
    status: 'pending',
    detail: null,
  },
]

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function nowLabel() {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}

function minStepDelay(startedAt: number, minimumMs = 700) {
  const elapsed = Date.now() - startedAt
  const waitMs = Math.max(0, minimumMs - elapsed)
  if (waitMs === 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, waitMs))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildStagePromptContext(stage: StepKey, caseId: string, selectedScenarioKey: string) {
  if (stage === 'insights_ai') {
    return {
      renewal_case_id: caseId,
      scenario_key: selectedScenarioKey,
      quote_insight_scope: 'ALL_OPEN_INSIGHTS',
      actor: 'SYSTEM_WORKFLOW',
    }
  }

  if (stage === 'full_ai') {
    return {
      renewal_case_id: caseId,
      scenario_key: selectedScenarioKey,
      guidance_pack: 'EXECUTIVE_SUMMARY|RATIONALE|APPROVAL_BRIEF_IF_REQUIRED',
      actor: 'SYSTEM_WORKFLOW',
    }
  }

  return {
    renewal_case_id: caseId,
    scenario_key: selectedScenarioKey,
    evaluation_scope: 'RECOMMENDATION_ENGINE',
    actor: 'SYSTEM_WORKFLOW',
  }
}

export function AiWorkflowRunner({
  caseId,
  selectedScenarioKey,
}: {
  caseId: string
  selectedScenarioKey: string
}) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(true)
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [steps, setSteps] = useState<WorkflowStep[]>(DEFAULT_STEPS)
  const [logs, setLogs] = useState<RunLogItem[]>([])
  const [streamLines, setStreamLines] = useState<StreamLine[]>([])
  const [selectedPromptStage, setSelectedPromptStage] = useState<StepKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<WorkflowSummary | null>(null)
  const [lastRunFinishedAt, setLastRunFinishedAt] = useState<string | null>(null)

  const completedCount = steps.filter((step) => step.status === 'done').length
  const progressPercent = Math.round((completedCount / steps.length) * 100)
  const selectedPromptStageMeta = selectedPromptStage
    ? getPromptStageMeta(selectedPromptStage)
    : null
  const selectedPromptArtifacts = selectedPromptStage
    ? getPromptArtifactsForStage(selectedPromptStage)
    : []
  const selectedPromptContextPreview = useMemo(() => {
    if (!selectedPromptStage) return []
    return buildRedactedVariablePreview(
      buildStagePromptContext(selectedPromptStage, caseId, selectedScenarioKey),
    )
  }, [caseId, selectedPromptStage, selectedScenarioKey])

  const statusLabel = useMemo(() => {
    if (isRunning) return 'AI workflow in progress'
    if (error) return 'AI workflow failed'
    if (summary) return 'AI workflow completed'
    return 'Ready to run'
  }, [isRunning, error, summary])

  function appendLog(message: string, tone: RunLogItem['tone']) {
    setLogs((prev) => [
      {
        id: `log_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        atLabel: nowLabel(),
        message,
        tone,
      },
      ...prev.slice(0, 7),
    ])
  }

  async function appendTypedStreamLine(params: {
    stepTitle: string
    text: string
    tone?: 'default' | 'success' | 'danger'
    typingDelayMs?: number
  }) {
    const id = `stream_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
    const tone = params.tone ?? 'default'
    const typingDelayMs = params.typingDelayMs ?? 11
    const atLabel = nowLabel()

    setStreamLines((prev) => [
      ...prev.slice(-11),
      {
        id,
        atLabel,
        stepTitle: params.stepTitle,
        text: '',
        tone,
        typing: true,
      },
    ])

    for (const char of params.text) {
      setStreamLines((prev) =>
        prev.map((line) =>
          line.id === id
            ? {
                ...line,
                text: `${line.text}${char}`,
              }
            : line,
        ),
      )
      await sleep(typingDelayMs)
    }

    setStreamLines((prev) =>
      prev.map((line) =>
        line.id === id
          ? {
              ...line,
              typing: false,
            }
          : line,
      ),
    )
  }

  async function streamStepReasoning(stepTitle: string, messages: string[]) {
    for (const message of messages) {
      await appendTypedStreamLine({
        stepTitle,
        text: message,
      })
      await sleep(120)
    }
  }

  function updateStep(
    key: StepKey,
    patch: Pick<WorkflowStep, 'status' | 'detail'>,
  ) {
    setSteps((prev) =>
      prev.map((step) =>
        step.key === key
          ? {
              ...step,
              ...patch,
            }
          : step,
      ),
    )
  }

  async function postJson<T>(path: string) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        body && typeof body.error === 'string'
          ? body.error
          : `Request failed (${response.status}).`
      throw new Error(message)
    }

    return body as T
  }

  async function runWorkflow() {
    const runStartedAt = Date.now()
    setIsRunning(true)
    setError(null)
    setSummary(null)
    setLogs([])
    setStreamLines([])
    setSteps(DEFAULT_STEPS)

    appendLog('AI run started. Preparing recommendation engine.', 'default')

    try {
      const recalcStarted = Date.now()
      const recalcStepTitle = 'Recalculate Recommendation'
      updateStep('recalculate', { status: 'running', detail: 'Scoring risk and pricing posture...' })
      const recalcReasoning = streamStepReasoning(recalcStepTitle, [
        'Ingesting subscription metrics, account health, and policy guardrails.',
        'Scoring bundle risk and selecting the most defensible renewal action.',
      ])
      const recalcBody = await postJson<{
        ok: boolean
        result?: {
          bundleResult?: {
            riskLevel?: string
            recommendedAction?: string
          }
          itemResults?: unknown[]
        }
      }>(`/api/renewal-cases/${caseId}/recalculate`)
      await Promise.all([minStepDelay(recalcStarted), recalcReasoning])

      const riskLevel = labelize(recalcBody?.result?.bundleResult?.riskLevel)
      const recommendedAction = labelize(recalcBody?.result?.bundleResult?.recommendedAction)
      const itemResults = recalcBody?.result?.itemResults
      const itemCount = Array.isArray(itemResults)
        ? itemResults.length
        : 0
      const recalcDetail = `${riskLevel} risk · ${recommendedAction} · ${itemCount} items analyzed`
      updateStep('recalculate', { status: 'done', detail: recalcDetail })
      await appendTypedStreamLine({
        stepTitle: recalcStepTitle,
        text: `Decision finalized: ${recalcDetail}.`,
        tone: 'success',
      })
      appendLog(`Recommendation updated: ${recalcDetail}.`, 'success')

      const insightsStarted = Date.now()
      const insightsStepTitle = 'Generate Quote Insights, then AI Rationales'
      updateStep('insights_ai', {
        status: 'running',
        detail: 'Generating quote insights, then AI rationale narratives...',
      })
      const insightsReasoning = streamStepReasoning(insightsStepTitle, [
        'Generating guarded quote insight dispositions from deterministic candidate envelopes.',
        'Validating products, pricing math, discounts, quantities, ARR impact, and policy citations.',
        'Drafting separate AI rationales for each accepted insight so reviewer intent is explicit.',
      ])
      const insightsBody = await postJson<{
        ok: boolean
        quoteInsights?: {
          regeneratedCount?: number
          diffSummary?: {
            added?: number
            removed?: number
            modified?: number
          }
        }
        ai?: {
          quoteInsightNarratives?: number
        }
      }>(`/api/renewal-cases/${caseId}/regenerate-insights-ai`)
      await Promise.all([minStepDelay(insightsStarted), insightsReasoning])

      const regeneratedCount = Number(insightsBody?.quoteInsights?.regeneratedCount ?? 0)
      const addedCount = Number(insightsBody?.quoteInsights?.diffSummary?.added ?? 0)
      const removedCount = Number(insightsBody?.quoteInsights?.diffSummary?.removed ?? 0)
      const modifiedCount = Number(insightsBody?.quoteInsights?.diffSummary?.modified ?? 0)
      const quoteInsightNarratives = Number(insightsBody?.ai?.quoteInsightNarratives ?? 0)
      const insightsDetail = `${regeneratedCount} insights · +${addedCount} / ~${modifiedCount} / -${removedCount} · ${quoteInsightNarratives} AI narratives`
      updateStep('insights_ai', { status: 'done', detail: insightsDetail })
      await appendTypedStreamLine({
        stepTitle: insightsStepTitle,
        text: `Insight generation complete: ${insightsDetail}.`,
        tone: 'success',
      })
      appendLog(`Insights + rationale generated: ${insightsDetail}.`, 'success')

      const fullAiStarted = Date.now()
      const fullAiStepTitle = 'Generate Full AI Review Guidance'
      updateStep('full_ai', {
        status: 'running',
        detail: 'Generating executive summary, reviewer guidance, and evidence reasoning...',
      })
      const fullAiReasoning = streamStepReasoning(fullAiStepTitle, [
        'Composing executive summary and reviewer narrative from latest case signals.',
        'Building a reasoning layer that explains rules, ML scoring, guardrails, and final output.',
        'Generating approval brief when approval posture requires explicit justification.',
      ])
      const fullAiBody = await postJson<{
        ok: boolean
        generated?: {
          caseExecutiveSummary?: boolean
          caseRationale?: boolean
          approvalBrief?: boolean
          reasoningNarratives?: number
          quoteInsightNarratives?: number
        }
      }>(`/api/renewal-cases/${caseId}/generate-ai`)
      await Promise.all([minStepDelay(fullAiStarted), fullAiReasoning])

      const executiveDone = Boolean(fullAiBody?.generated?.caseExecutiveSummary)
      const rationaleDone = Boolean(fullAiBody?.generated?.caseRationale)
      const approvalBriefGenerated = Boolean(fullAiBody?.generated?.approvalBrief)
      const reasoningNarratives = Number(fullAiBody?.generated?.reasoningNarratives ?? 0)
      const fullNarrativeCount = Number(fullAiBody?.generated?.quoteInsightNarratives ?? 0)
      const caseNarrativeCount = Number(executiveDone) + Number(rationaleDone)
      const fullAiDetail = `${caseNarrativeCount} case narratives · ${reasoningNarratives} reasoning narratives · ${fullNarrativeCount} insight narratives · approval brief ${approvalBriefGenerated ? 'generated' : 'not required'}`
      updateStep('full_ai', { status: 'done', detail: fullAiDetail })
      await appendTypedStreamLine({
        stepTitle: fullAiStepTitle,
        text: `Review guidance pack ready: ${fullAiDetail}.`,
        tone: 'success',
      })
      appendLog(`AI review pack generated: ${fullAiDetail}.`, 'success')

      const totalMs = Date.now() - runStartedAt
      setSummary({
        totalMs,
        regeneratedCount,
        addedCount,
        modifiedCount,
        removedCount,
        quoteInsightNarratives: fullNarrativeCount,
        caseNarratives: caseNarrativeCount,
        reasoningNarratives,
        approvalBriefGenerated,
      })
      setLastRunFinishedAt(nowLabel())
      await appendTypedStreamLine({
        stepTitle: 'Workflow',
        text: `End-to-end AI workflow completed in ${formatDuration(totalMs)}.`,
        tone: 'success',
      })
      appendLog(`Workflow complete in ${formatDuration(totalMs)}.`, 'success')

      router.refresh()
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : 'Unexpected workflow error.'
      setError(message)
      await appendTypedStreamLine({
        stepTitle: 'Workflow',
        text: `Execution failed: ${message}`,
        tone: 'danger',
        typingDelayMs: 8,
      })
      appendLog(`Run failed: ${message}`, 'danger')
      setSteps((prev) =>
        prev.map((step) =>
          step.status === 'running'
            ? {
                ...step,
                status: 'error',
                detail: message,
              }
            : step,
        ),
      )
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <section className="ai-workflow-runner">
      <div className="ai-workflow-head">
        <div>
          <h4 className="ai-workflow-title">AI Live Run Console</h4>
          <p className="ai-workflow-subtitle">
            Use this during demos to show visible AI execution, not just page refresh.
          </p>
        </div>
        <div className="ai-workflow-head-actions">
          <button
            type="button"
            className="button-secondary ai-panel-toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            disabled={isRunning}
            aria-expanded={isExpanded}
            aria-controls="ai-workflow-panel"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            type="button"
            className={`button-link action-feedback-button${isRunning ? ' is-loading' : ''}`}
            onClick={runWorkflow}
            disabled={isRunning}
            aria-busy={isRunning}
          >
            {isRunning ? 'AI Working...' : 'Run End-to-End AI Workflow'}
          </button>
        </div>
      </div>

      <div className="ai-workflow-status-row">
        <div className="ai-workflow-status">
          <span className={`ai-status-dot ${isRunning ? 'running' : error ? 'error' : 'idle'}`} />
          <span>{statusLabel}</span>
        </div>
        <div className="small muted">
          Progress {progressPercent}%{lastRunFinishedAt ? ` · Last run ${lastRunFinishedAt}` : ''}
        </div>
      </div>

      <div
        id="ai-workflow-panel"
        className={`ai-workflow-panel ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
        aria-hidden={!isExpanded}
      >
        <div className="ai-workflow-panel-inner">
          <div className="ai-scenario-shell">
            <div className="small muted" style={{ fontWeight: 700 }}>
              Scenario Selection
            </div>
            <div className="small muted">
              Scenario selection is shared across AI Live and Manual controls.
            </div>
            <DemoScenarioSelector
              caseId={caseId}
              selectedScenarioKey={selectedScenarioKey}
              embedded
            />
          </div>

          <div className="ai-progress-track" aria-hidden>
            <div className="ai-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="ai-step-list">
            {steps.map((step, index) => (
              <div className={`ai-step-item ${step.status}`} key={step.key}>
                <div className="ai-step-index">{index + 1}</div>
                <div>
                  <div className="ai-step-title">{step.title}</div>
                  <div className="small muted">{step.subtitle}</div>
                  <div className="ai-step-detail">{step.detail ?? 'Waiting to run.'}</div>
                  <div className="ai-step-actions">
                    <button
                      type="button"
                      className={`button-tertiary ai-prompt-button${
                        selectedPromptStage === step.key ? ' active' : ''
                      }`}
                      onClick={() =>
                        setSelectedPromptStage((current) => (current === step.key ? null : step.key))
                      }
                    >
                      {selectedPromptStage === step.key ? 'Hide Prompt' : 'View Prompt Used'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedPromptStage ? (
            <div className="ai-prompt-drawer">
              <div className="ai-prompt-drawer-head">
                <div>
                  <div className="small muted" style={{ fontWeight: 700 }}>
                    Prompt Used in AI Live
                  </div>
                  <div style={{ fontWeight: 700 }}>{selectedPromptStageMeta?.label}</div>
                  <div className="small muted">{selectedPromptStageMeta?.subtitle}</div>
                </div>
              </div>

              <div className="ai-prompt-context-grid">
                {selectedPromptContextPreview.map((preview) => (
                  <div key={`${selectedPromptStage}-${preview.key}`} className="ai-prompt-context-item">
                    <span>{preview.label}</span>
                    <strong>
                      {preview.displayValue}
                      {preview.redacted ? ' (masked)' : ''}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="ai-prompt-card-stack">
                {selectedPromptArtifacts.map((artifact) => (
                  <article key={artifact.id} className="ai-prompt-card">
                    <div className="ai-prompt-card-head">
                      <div>
                        <h5>{artifact.name}</h5>
                        <p>{artifact.purpose}</p>
                      </div>
                      <div className="ai-prompt-meta-tags">
                        <span className="scenario-chip">{artifact.version}</span>
                        <span className="scenario-chip">{artifact.fingerprint}</span>
                      </div>
                    </div>

                    <div className="ai-prompt-technical-body">
                      <div>
                        <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                          System Prompt (Exact)
                        </div>
                        <pre className="ai-prompt-code">{artifact.systemPrompt}</pre>
                      </div>
                      <div>
                        <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                          Input Sent To LLM (Current Template)
                        </div>
                        <pre className="ai-prompt-code">{artifact.inputTemplate}</pre>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="ai-stream-shell">
            <div className="ai-stream-head">
              <div className="small muted" style={{ fontWeight: 700 }}>
                Typed AI Reasoning Stream
              </div>
              <button
                type="button"
                className="button-secondary ai-panel-toggle"
                onClick={() => setIsReasoningExpanded((prev) => !prev)}
                aria-expanded={isReasoningExpanded}
                aria-controls="ai-stream-body"
              >
                {isReasoningExpanded ? 'Collapse Stream' : 'Expand Stream'}
              </button>
            </div>

            <div
              id="ai-stream-body"
              className={`ai-stream-body ${isReasoningExpanded ? 'is-expanded' : 'is-collapsed'}`}
              aria-hidden={!isReasoningExpanded}
            >
              <div className="ai-stream-body-inner">
                <div className="ai-stream-output">
                  {streamLines.length > 0 ? (
                    streamLines.map((line) => (
                      <div className={`ai-stream-line ${line.tone}`} key={line.id}>
                        <div className="ai-stream-meta">
                          {line.atLabel} · {line.stepTitle}
                        </div>
                        <div className="ai-stream-text">
                          {line.text}
                          {line.typing ? <span className="ai-typing-caret">▍</span> : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="small muted">
                      Run the workflow to show typed AI reasoning during each step.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!isReasoningExpanded ? (
              <div className="small muted">
                Expand stream to show live typed AI reasoning text.
              </div>
            ) : null}
          </div>

          {summary ? (
            <div className="ai-summary-grid">
              <div className="ai-summary-item">
                <div className="small muted">Run Time</div>
                <div className="ai-summary-value">{formatDuration(summary.totalMs)}</div>
              </div>
              <div className="ai-summary-item">
                <div className="small muted">Insights Regenerated</div>
                <div className="ai-summary-value">{summary.regeneratedCount}</div>
              </div>
              <div className="ai-summary-item">
                <div className="small muted">Insight Diff</div>
                <div className="ai-summary-value">
                  +{summary.addedCount} / ~{summary.modifiedCount} / -{summary.removedCount}
                </div>
              </div>
              <div className="ai-summary-item">
                <div className="small muted">Narratives</div>
                <div className="ai-summary-value">
                  {summary.caseNarratives} case + {summary.reasoningNarratives} reasoning +{' '}
                  {summary.quoteInsightNarratives} insight
                </div>
              </div>
              <div className="ai-summary-item">
                <div className="small muted">Approval Brief</div>
                <div className="ai-summary-value">
                  {summary.approvalBriefGenerated ? 'Generated' : 'Not Required'}
                </div>
              </div>
            </div>
          ) : null}

          {logs.length > 0 ? (
            <div className="ai-log">
              {logs.map((log) => (
                <div className={`ai-log-item ${log.tone}`} key={log.id}>
                  <span className="ai-log-time">{log.atLabel}</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {!isExpanded ? (
        <div className="small muted">
          Expand to view per-step status, typed reasoning stream, and output summary.
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" style={{ marginTop: 4 }}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
