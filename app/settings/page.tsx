import path from 'path'
import { WorkspaceNav } from '@/components/layout/workspace-nav'
import { MlSettingsForm } from '@/components/settings/ml-settings-form'
import { SettingsPrimaryTabs } from '@/components/settings/settings-primary-tabs'
import { Badge } from '@/components/ui/badge'
import { ViewModeSwitch } from '@/components/ui/view-mode-switch'
import { normalizeGovernanceRole } from '@/lib/auth/role-controls'
import { getAiModel, getAiProvider } from '@/lib/ai/client'
import { labelize } from '@/lib/format/risk'
import { getMlRuntimeConfig, mlModeLabel } from '@/lib/ml/config'
import { getRuntimeSettings } from '@/lib/settings/runtime-settings'

export const dynamic = 'force-dynamic'

const ROOT = process.cwd()

function isEnabled(raw: string | undefined) {
  const value = raw?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

function formatMetricKey(key: string) {
  return labelize(key)
}

function formatMetricValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 3,
  })
}

function readinessTone(isReady: boolean): 'success' | 'warn' {
  return isReady ? 'success' : 'warn'
}

function displayRuntimePath(value: string | null | undefined) {
  if (!value) return 'Not configured'
  if (/^https?:\/\//.test(value)) return value
  if (!path.isAbsolute(value)) return value

  const relativePath = path.relative(ROOT, value)
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath || '.'
  }

  return `${path.basename(value)} (external runtime)`
}

export default function SettingsPage() {
  const aiProvider = getAiProvider()
  const selectedAiModel = getAiModel()
  const openAiApiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1'
  const openAiMockModeEnabled = isEnabled(process.env.OPENAI_MOCK_MODE)
  const liveTextGenerationConfigured =
    aiProvider === 'OLLAMA' || (aiProvider === 'OPENAI' && openAiApiKeyConfigured)
  const mlConfig = getMlRuntimeConfig()
  const runtimeSettings = getRuntimeSettings()
  const governanceRole = normalizeGovernanceRole(process.env.DEMO_USER_ROLE)
  const localMlReady = mlConfig.modelExists && mlConfig.predictionScriptExists
  const selectedModeAffectsRecommendations = mlConfig.affectsRecommendations
  const selectedModeOperational =
    mlConfig.mode === 'RULES_ONLY' || (mlConfig.enabled && localMlReady)

  return (
    <div className="page">
      <WorkspaceNav
        title="Architecture Console"
        subtitle="Review runtime posture, policy boundaries, AI architecture, and audit evidence."
        activeHref="/settings"
        items={[
          {
            label: 'Decisioning Setup',
            href: '/settings',
            description: 'Runtime posture',
          },
          {
            label: 'Policy Playbook',
            href: '/policies',
            description: 'Rules and guardrails',
          },
          {
            label: 'AI Architecture',
            href: '/technical-review',
            description: 'Model and trace evidence',
          },
          {
            label: 'Generation Trace',
            href: '/renewal-cases',
            description: 'Scenario quote steps',
          },
          {
            label: 'Flow Map',
            href: '/',
            description: 'Audience paths',
          },
        ]}
      />

      <ViewModeSwitch
        business={
          <div className="business-view-stack">
            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Current Operating Posture</h2>
                  <p className="section-subtitle">
                    These are the controls that matter for a business demo. Rules remain final for
                    pricing, approval routing, and quote math.
                  </p>
                </div>
              </div>

              <div className="business-summary-grid">
                <article className="business-summary-card">
                  <Badge tone={selectedModeOperational ? 'success' : 'warn'}>
                    {selectedModeOperational ? 'Ready' : 'Needs Attention'}
                  </Badge>
                  <h3>Recommendation Engine</h3>
                  <p>
                    Running in {mlModeLabel(mlConfig.mode)}.{' '}
                    {selectedModeAffectsRecommendations
                      ? 'ML can assist risk and action selection after recalculation.'
                      : 'Rules remain the final recommendation authority.'}
                  </p>
                </article>

                <article className="business-summary-card">
                  <Badge tone={liveTextGenerationConfigured || openAiMockModeEnabled ? 'success' : 'warn'}>
                    {openAiMockModeEnabled
                      ? 'Mock Ready'
                      : liveTextGenerationConfigured
                        ? 'Ready'
                        : 'Fallback'}
                  </Badge>
                  <h3>LLM Runtime</h3>
                  <p>
                    {aiProvider === 'OLLAMA'
                      ? `Ollama is selected with ${selectedAiModel}.`
                      : `OpenAI is selected with ${openAiApiKeyConfigured ? 'an API key configured' : 'fallback behavior active'}.`}
                  </p>
                </article>

                <article className="business-summary-card">
                  <Badge
                    tone={
                      runtimeSettings.guardedDecisioningMode === 'LLM_ASSISTED_GUARDED'
                        ? 'success'
                        : 'info'
                    }
                  >
                    {labelize(runtimeSettings.guardedDecisioningMode)}
                  </Badge>
                  <h3>Guarded LLM</h3>
                  <p>
                    LLM reasoning stays inside validated candidates. It cannot invent products,
                    bypass approvals, or change deterministic pricing math.
                  </p>
                </article>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Business Readiness Checklist</h2>
                  <p className="section-subtitle">
                    Use this quick check before running the demo workflow.
                  </p>
                </div>
              </div>
              <div className="business-flow">
                <div className="business-flow-step">
                  <span>1</span>
                  <strong>Recommendation Mode</strong>
                  <p>{mlModeLabel(mlConfig.mode)} is active for future recalculations.</p>
                </div>
                <div className="business-flow-step">
                  <span>2</span>
                  <strong>LLM Provider</strong>
                  <p>{aiProvider === 'OLLAMA' ? 'Local Ollama first.' : 'OpenAI selected.'}</p>
                </div>
                <div className="business-flow-step">
                  <span>3</span>
                  <strong>ML Artifact</strong>
                  <p>{localMlReady ? 'Local model and script are ready.' : 'ML artifact needs attention.'}</p>
                </div>
                <div className="business-flow-step">
                  <span>4</span>
                  <strong>Guardrails</strong>
                  <p>Pricing and approvals remain deterministic.</p>
                </div>
                <div className="business-flow-step">
                  <span>5</span>
                  <strong>Audit</strong>
                  <p>Decision runs can be exported and replay-checked.</p>
                </div>
                <div className="business-flow-step">
                  <span>6</span>
                  <strong>Next</strong>
                  <p>Open a renewal case and run the workflow.</p>
                </div>
              </div>
            </section>

            <div className="business-callout">
              Technical mode contains provider environment values, model registry details,
              governance role gates, and evaluation metrics.
            </div>
          </div>
        }
        technical={
          <>
      <SettingsPrimaryTabs
        recommendation={
          <section className="settings-mode-hero settings-mode-hero-wizard">
            <MlSettingsForm
              initialMode={mlConfig.mode}
              initialGuardedMode={runtimeSettings.guardedDecisioningMode}
              initialGovernanceRole={governanceRole}
              shadowApproved={mlConfig.registryApprovedForShadow}
              hybridApproved={mlConfig.registryApprovedForHybrid}
              modelExists={mlConfig.modelExists}
              predictionScriptExists={mlConfig.predictionScriptExists}
            />
          </section>
        }
        textGeneration={
          <section className="settings-text-generation-panel">
            <div>
              <div className="settings-eyebrow">LLM Provider</div>
              <div className="settings-mode-hero-title">
                <h2>LLM Runtime</h2>
                <Badge tone={liveTextGenerationConfigured || openAiMockModeEnabled ? 'success' : 'warn'}>
                  {openAiMockModeEnabled
                    ? 'Mock enabled'
                    : liveTextGenerationConfigured
                      ? `${aiProvider} selected`
                      : 'Local fallback'}
                </Badge>
              </div>
              <p>
                This configures the LLM provider for AI-assisted workflows. Rules, ML scoring, and
                pricing guardrails remain governed controls as LLM usage evolves.
              </p>
            </div>

            <div className="settings-compact-grid">
              <div className="settings-compact-item">
                <span>AI_PROVIDER</span>
                <strong>{aiProvider.toLowerCase()}</strong>
              </div>
              <div className="settings-compact-item">
                <span>OPENAI_API_KEY</span>
                <Badge tone={openAiApiKeyConfigured ? 'success' : 'warn'}>
                  {openAiApiKeyConfigured ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              <div className="settings-compact-item">
                <span>{aiProvider === 'OLLAMA' ? 'OLLAMA_MODEL' : 'OPENAI_MODEL'}</span>
                <strong>{selectedAiModel}</strong>
              </div>
              <div className="settings-compact-item">
                <span>OLLAMA_BASE_URL</span>
                <strong>{aiProvider === 'OLLAMA' ? ollamaBaseUrl : 'Not active'}</strong>
              </div>
              <div className="settings-compact-item">
                <span>OPENAI_MOCK_MODE</span>
                <Badge tone={openAiMockModeEnabled ? 'info' : 'default'}>
                  {openAiMockModeEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>

            <div className="settings-text-generation-note">
              <strong>Fallback behavior:</strong> when OpenAI is selected without an API key, quote
              insight rationales use the local deterministic rationale path. When Ollama is selected,
              make sure the local Ollama service is running and the selected model has been pulled.
            </div>
          </section>
        }
      />

      <details className="settings-ml-readiness-section settings-technical-details">
        <summary className="settings-technical-details-head">
          <div>
            <h2 className="section-title">Standalone ML Recommendation Readiness</h2>
            <p className="section-subtitle">
              Model artifact, registry, approval gates, and evaluation metrics.
            </p>
          </div>
          <Badge tone={localMlReady ? 'success' : 'warn'}>
            {localMlReady ? 'Ready' : 'Needs Attention'}
          </Badge>
        </summary>

        <div className="settings-technical-details-body">
        <div className="settings-readiness-grid">
          <div className="settings-readiness-card">
            <div className="settings-readiness-card-head">
              <h3>Local ML Artifact</h3>
              <Badge tone={readinessTone(localMlReady)}>
                {localMlReady ? 'Ready' : 'Incomplete'}
              </Badge>
            </div>
            <div className="settings-readiness-list">
              <div>
                <span>Model file</span>
                <strong>{mlConfig.modelExists ? 'Found' : 'Missing'}</strong>
              </div>
              <div>
                <span>Prediction script</span>
                <strong>{mlConfig.predictionScriptExists ? 'Found' : 'Missing'}</strong>
              </div>
              <div>
                <span>Python runtime</span>
                <strong>{displayRuntimePath(mlConfig.pythonBin)}</strong>
              </div>
              <div>
                <span>Serving path</span>
                <strong>{mlConfig.serviceUrl ?? 'Python subprocess fallback'}</strong>
              </div>
            </div>
          </div>

          <div className="settings-readiness-card">
            <div className="settings-readiness-card-head">
              <h3>Model Registry</h3>
              <Badge tone={mlConfig.registryModelName ? 'success' : 'warn'}>
                {mlConfig.registryModelName ? 'Registered' : 'Missing'}
              </Badge>
            </div>
            <div className="settings-readiness-list">
              <div>
                <span>Model</span>
                <strong>{mlConfig.registryModelName ?? 'Not registered'}</strong>
              </div>
              <div>
                <span>Version</span>
                <strong>{mlConfig.registryModelVersion ?? '—'}</strong>
              </div>
              <div>
                <span>Feature schema</span>
                <strong>{mlConfig.registryFeatureSchemaVersion ?? '—'}</strong>
              </div>
              <div>
                <span>Checksum</span>
                <strong>
                  {mlConfig.registryArtifactSha256
                    ? `${mlConfig.registryArtifactSha256.slice(0, 16)}...`
                    : 'Not recorded'}
                </strong>
              </div>
            </div>
          </div>

          <div className="settings-readiness-card">
            <div className="settings-readiness-card-head">
              <h3>Approval Gates</h3>
              <Badge
                tone={
                  mlConfig.registryApprovedForShadow && mlConfig.registryApprovedForHybrid
                    ? 'success'
                    : 'warn'
                }
              >
                Governed
              </Badge>
            </div>
            <div className="settings-approval-row">
              <Badge tone={mlConfig.registryApprovedForShadow ? 'success' : 'warn'}>
                Shadow {mlConfig.registryApprovedForShadow ? 'Approved' : 'Blocked'}
              </Badge>
              <Badge tone={mlConfig.registryApprovedForHybrid ? 'success' : 'warn'}>
                ML Assist {mlConfig.registryApprovedForHybrid ? 'Approved' : 'Blocked'}
              </Badge>
            </div>
            <p className="small muted">
              The selected mode only invokes ML when the local artifact exists and the registry
              approval gate allows that mode.
            </p>
          </div>
        </div>

        <div className="settings-evaluation-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">ML Evaluation Snapshot</h2>
              <p className="section-subtitle">
                Local synthetic holdout metrics for the registered recommendation model. Use this
                for demo explainability, not production predictive claims.
              </p>
            </div>
          </div>

          {mlConfig.registryLatestMetrics ? (
            <div className="settings-metric-grid">
              {Object.entries(mlConfig.registryLatestMetrics).map(([key, value]) => (
                <div key={key} className="settings-metric-card">
                  <span>{formatMetricKey(key)}</span>
                  <strong>{formatMetricValue(value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Badge tone="warn">No Report</Badge>
          )}
          {mlConfig.registryEvaluationReport ? (
            <div className="settings-path-block">
              <span>Evaluation report</span>
              <strong>{mlConfig.registryEvaluationReport}</strong>
            </div>
          ) : null}
        </div>
        </div>
      </details>
          </>
        }
      />
    </div>
  )
}
