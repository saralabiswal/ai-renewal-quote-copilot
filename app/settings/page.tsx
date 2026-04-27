import path from 'path'
import { PageHeader } from '@/components/layout/page-header'
import { MlSettingsForm } from '@/components/settings/ml-settings-form'
import { SettingsPrimaryTabs } from '@/components/settings/settings-primary-tabs'
import { Badge } from '@/components/ui/badge'
import { labelize } from '@/lib/format/risk'
import { getMlRuntimeConfig, mlModeLabel } from '@/lib/ml/config'

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
  const openAiApiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())
  const openAiModel = process.env.OPENAI_MODEL || 'gpt-5.3'
  const openAiMockModeEnabled = isEnabled(process.env.OPENAI_MOCK_MODE)
  const mlConfig = getMlRuntimeConfig()
  const localMlReady = mlConfig.modelExists && mlConfig.predictionScriptExists
  const selectedModeAffectsRecommendations = mlConfig.affectsRecommendations
  const selectedModeOperational =
    mlConfig.mode === 'RULES_ONLY' || (mlConfig.enabled && localMlReady)

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        description="Runtime controls for recommendation mode, standalone ML readiness, and optional text-generation configuration."
        purpose="Choose how recommendation and quote insight workflows behave before running case recalculation."
        nextStep="Set Recommendation Mode first, then confirm local model and runtime readiness."
      />

      <SettingsPrimaryTabs
        recommendation={
          <section className="settings-mode-hero">
            <div className="settings-mode-hero-main">
              <div className="settings-eyebrow">Recommendation Mode</div>
              <div className="settings-mode-hero-title">
                <h2>{mlModeLabel(mlConfig.mode)}</h2>
                <Badge tone={selectedModeOperational ? 'success' : 'warn'}>
                  {selectedModeOperational ? 'Operational' : 'Needs Attention'}
                </Badge>
              </div>
              <p>
                This is the control that decides whether future recalculations are rules-only,
                shadow-observed, or ML-assisted. Existing case results remain persisted until
                the workflow is recalculated.
              </p>
              <div className="settings-mode-impact-strip">
                <div>
                  <span>Recommendation</span>
                  <strong>
                    {selectedModeAffectsRecommendations
                      ? 'ML can affect risk and action'
                      : 'Rules remain authoritative'}
                  </strong>
                </div>
                <div>
                  <span>Quote Insight</span>
                  <strong>
                    {mlConfig.mode === 'RULES_ONLY'
                      ? 'No ML evidence'
                      : 'ML evidence available after recalculation'}
                  </strong>
                </div>
                <div>
                  <span>Guardrails</span>
                  <strong>Pricing policy remains final</strong>
                </div>
              </div>
            </div>

            <MlSettingsForm
              initialMode={mlConfig.mode}
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
              <div className="settings-eyebrow">Optional Text Generation</div>
              <div className="settings-mode-hero-title">
                <h2>OpenAI Narrative Runtime</h2>
                <Badge tone={openAiApiKeyConfigured || openAiMockModeEnabled ? 'success' : 'warn'}>
                  {openAiApiKeyConfigured
                    ? 'API configured'
                    : openAiMockModeEnabled
                      ? 'Mock enabled'
                      : 'Local fallback'}
                </Badge>
              </div>
              <p>
                This controls narrative and rationale generation only. The standalone renewal-risk
                ML model, recommendation scoring, and guardrails do not require OpenAI.
              </p>
            </div>

            <div className="settings-compact-grid">
              <div className="settings-compact-item">
                <span>OPENAI_API_KEY</span>
                <Badge tone={openAiApiKeyConfigured ? 'success' : 'warn'}>
                  {openAiApiKeyConfigured ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              <div className="settings-compact-item">
                <span>OPENAI_MODEL</span>
                <strong>{openAiModel}</strong>
              </div>
              <div className="settings-compact-item">
                <span>OPENAI_MOCK_MODE</span>
                <Badge tone={openAiMockModeEnabled ? 'info' : 'default'}>
                  {openAiMockModeEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>

            <div className="settings-text-generation-note">
              <strong>Fallback behavior:</strong> when no API key or mock mode is configured, quote
              insight rationales use the local deterministic rationale path and are labeled that way
              in the case UI.
            </div>
          </section>
        }
      />

      <section className="settings-ml-readiness-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Standalone ML Recommendation Readiness</h2>
            <p className="section-subtitle">
              Applies to recommendation scoring and quote insight ML evidence only. Optional text
              generation is configured in the top tab and does not use this model registry.
            </p>
          </div>
        </div>

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
      </section>
    </div>
  )
}
