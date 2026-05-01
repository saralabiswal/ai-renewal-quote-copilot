'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  GuardedDecisioningMode,
  MlRecommendationMode,
} from '@/lib/settings/runtime-settings'
import type { GovernanceRole } from '@/lib/auth/role-controls'

type Props = {
  initialMode: MlRecommendationMode
  initialGuardedMode: GuardedDecisioningMode
  initialGovernanceRole: GovernanceRole
  shadowApproved: boolean
  hybridApproved: boolean
  modelExists: boolean
  predictionScriptExists: boolean
}

type SettingsStep = 'recommendation' | 'role' | 'guarded'

const modeOptions: Array<{
  value: MlRecommendationMode
  label: string
  summary: string
  whenToUse: string
  dependency: string
}> = [
  {
    value: 'RULES_ONLY',
    label: 'Rules Only',
    summary: 'Deterministic engine only.',
    whenToUse: 'Use for baseline demos, deterministic testing, or when ML is unavailable.',
    dependency: 'Always available.',
  },
  {
    value: 'ML_SHADOW',
    label: 'Shadow Mode',
    summary: 'Rules stay final; ML is logged for comparison.',
    whenToUse: 'Use to prove model readiness without changing the recommendation.',
    dependency: 'Requires local model, prediction script, and shadow approval.',
  },
  {
    value: 'HYBRID_RULES_ML',
    label: 'ML-Assisted Rules',
    summary: 'ML can influence risk/action; guardrails stay final.',
    whenToUse: 'Use for the main demo posture when ML artifacts are ready.',
    dependency: 'Requires local model, prediction script, and ML-assist approval.',
  },
]

const guardedModeOptions: Array<{
  value: GuardedDecisioningMode
  label: string
  summary: string
  whenToUse: string
  dependency: string
}> = [
  {
    value: 'RULES_ONLY',
    label: 'Rules Only',
    summary: 'No LLM critique or ranking in the decision run.',
    whenToUse: 'Use for fully deterministic runs.',
    dependency: 'No LLM provider needed.',
  },
  {
    value: 'LLM_CRITIC_SHADOW',
    label: 'LLM Critic Shadow',
    summary: 'LLM critiques the rule result, but cannot change it.',
    whenToUse: 'Use when you want an explanation quality check.',
    dependency: 'Needs Ollama/OpenAI for live output; deterministic fallback is available.',
  },
  {
    value: 'LLM_RANKING_SHADOW',
    label: 'LLM Ranking Shadow',
    summary: 'LLM ranks allowed candidates in shadow mode.',
    whenToUse: 'Use to compare LLM preference against rule output.',
    dependency: 'Needs LLM provider; validator keeps it shadow-only.',
  },
  {
    value: 'LLM_ASSISTED_GUARDED',
    label: 'LLM-Assisted Guarded',
    summary: 'LLM can influence the selected candidate only if validation passes.',
    whenToUse: 'Use for future enterprise guarded decisioning demos.',
    dependency: 'Requires AI Governance Admin or Revenue Ops Admin role.',
  },
  {
    value: 'HUMAN_APPROVAL_REQUIRED',
    label: 'Human Approval Required',
    summary: 'LLM supports the decision, but exception handling routes to humans.',
    whenToUse: 'Use when deal desk or governance should approve exceptions.',
    dependency: 'Requires AI Governance Admin or Deal Desk Admin role.',
  },
]

const governanceRoleOptions: Array<{
  value: GovernanceRole
  label: string
  description: string
}> = [
  {
    value: 'AI_GOVERNANCE_ADMIN',
    label: 'AI Governance Admin',
    description: 'Can enable guarded LLM influence and human approval routing.',
  },
  {
    value: 'REVENUE_OPERATIONS_ADMIN',
    label: 'Revenue Ops Admin',
    description: 'Can enable guarded LLM influence for renewal decisioning.',
  },
  {
    value: 'DEAL_DESK_ADMIN',
    label: 'Deal Desk Admin',
    description: 'Can route decisions to human approval mode.',
  },
  {
    value: 'TECHNICAL_REVIEWER',
    label: 'Technical Reviewer',
    description: 'Can inspect traces, but cannot enable restricted modes.',
  },
  {
    value: 'RENEWAL_MANAGER',
    label: 'Renewal Manager',
    description: 'Can use approved modes, but cannot enable restricted modes.',
  },
]

function modeReadinessLabel({
  mode,
  shadowApproved,
  hybridApproved,
  modelExists,
  predictionScriptExists,
}: {
  mode: MlRecommendationMode
  shadowApproved: boolean
  hybridApproved: boolean
  modelExists: boolean
  predictionScriptExists: boolean
}) {
  if (mode === 'RULES_ONLY') return 'Always available'
  if (!modelExists || !predictionScriptExists) return 'Blocked: local artifact missing'
  if (mode === 'ML_SHADOW') return shadowApproved ? 'Shadow approved' : 'Shadow blocked'
  return hybridApproved ? 'ML assist approved' : 'ML assist blocked'
}

function modeReadinessTone(label: string) {
  if (label.toLowerCase().includes('approved') || label === 'Always available') return 'ready'
  return 'blocked'
}

function guardedModeSaveState(mode: GuardedDecisioningMode, role: GovernanceRole) {
  if (mode === 'LLM_ASSISTED_GUARDED') {
    return role === 'AI_GOVERNANCE_ADMIN' || role === 'REVENUE_OPERATIONS_ADMIN'
      ? 'Role can save'
      : 'Role cannot save'
  }

  if (mode === 'HUMAN_APPROVAL_REQUIRED') {
    return role === 'AI_GOVERNANCE_ADMIN' || role === 'DEAL_DESK_ADMIN'
      ? 'Role can save'
      : 'Role cannot save'
  }

  return 'Role can save'
}

export function MlSettingsForm({
  initialMode,
  initialGuardedMode,
  initialGovernanceRole,
  shadowApproved,
  hybridApproved,
  modelExists,
  predictionScriptExists,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<MlRecommendationMode>(initialMode)
  const [guardedMode, setGuardedMode] = useState<GuardedDecisioningMode>(initialGuardedMode)
  const [governanceRole, setGovernanceRole] = useState<GovernanceRole>(initialGovernanceRole)
  const [activeStep, setActiveStep] = useState<SettingsStep>('recommendation')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedOption = modeOptions.find((option) => option.value === mode) ?? modeOptions[0]
  const selectedGuardedOption =
    guardedModeOptions.find((option) => option.value === guardedMode) ?? guardedModeOptions[1]
  const selectedRoleOption =
    governanceRoleOptions.find((option) => option.value === governanceRole) ??
    governanceRoleOptions[0]
  const selectedRecommendationReadiness = modeReadinessLabel({
    mode,
    shadowApproved,
    hybridApproved,
    modelExists,
    predictionScriptExists,
  })
  const selectedGuardedSaveState = guardedModeSaveState(guardedMode, governanceRole)

  async function saveMode() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/settings/ml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-user-role': governanceRole,
        },
        body: JSON.stringify({
          mlRecommendationMode: mode,
          guardedDecisioningMode: guardedMode,
        }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to save ML settings.')
      }

      setMessage('Applied. Future recalculations will use these decisioning modes.')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save ML settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-mode-control">
      <div className="settings-mode-apply-row settings-mode-apply-row-top settings-wizard-apply">
        <div>
          <strong>Set modes for future recalculations</strong>
          <p>Choose one step at a time. The selected settings below are what will be applied.</p>
          <div className="settings-top-dependencies">
            <span>Recommendation: {selectedRecommendationReadiness}</span>
            <span>LLM permission: {selectedGuardedSaveState}</span>
          </div>
        </div>
        <button className="button-link" type="button" onClick={saveMode} disabled={isSaving}>
          {isSaving ? 'Applying...' : 'Apply Settings'}
        </button>
      </div>

      <div className="settings-step-tabs" role="tablist" aria-label="Decisioning setting steps">
        <button
          type="button"
          className={`settings-step-tab ${activeStep === 'recommendation' ? 'active' : ''}`}
          onClick={() => setActiveStep('recommendation')}
        >
          <span>1</span>
          Recommendation
        </button>
        <button
          type="button"
          className={`settings-step-tab ${activeStep === 'role' ? 'active' : ''}`}
          onClick={() => setActiveStep('role')}
        >
          <span>2</span>
          Role
        </button>
        <button
          type="button"
          className={`settings-step-tab ${activeStep === 'guarded' ? 'active' : ''}`}
          onClick={() => setActiveStep('guarded')}
        >
          <span>3</span>
          Guarded LLM
        </button>
      </div>

      <select
        id="ml-recommendation-mode"
        className="settings-mode-select"
        value={mode}
        onChange={(event) => setMode(event.target.value as MlRecommendationMode)}
      >
        {modeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        id="governance-role"
        className="settings-mode-select"
        value={governanceRole}
        onChange={(event) => setGovernanceRole(event.target.value as GovernanceRole)}
      >
        {governanceRoleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        id="guarded-decisioning-mode"
        className="settings-mode-select"
        value={guardedMode}
        onChange={(event) => setGuardedMode(event.target.value as GuardedDecisioningMode)}
      >
        {guardedModeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="settings-step-panel">
        {activeStep === 'recommendation' ? (
          <>
            <div className="settings-step-panel-head">
              <div>
                <div className="settings-eyebrow">Step 1</div>
                <h3>Choose recommendation calculation</h3>
                <p>Decides whether future recalculations are rules-only, ML shadow, or ML-assisted.</p>
              </div>
            </div>
            <div className="settings-choice-grid" role="radiogroup" aria-label="Recommendation Mode">
              {modeOptions.map((option) => {
                const readiness = modeReadinessLabel({
                  mode: option.value,
                  shadowApproved,
                  hybridApproved,
                  modelExists,
                  predictionScriptExists,
                })
                const isSelected = option.value === mode

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`settings-mode-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setMode(option.value)}
                    aria-pressed={isSelected}
                  >
                    <span className="settings-mode-option-head">
                      <span>
                        <strong>{option.label}</strong>
                        <span>{option.summary}</span>
                      </span>
                      <span className={`settings-mode-readiness ${modeReadinessTone(readiness)}`}>
                        {readiness}
                      </span>
                    </span>
                    <span className="settings-mode-option-copy">{option.whenToUse}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        {activeStep === 'role' ? (
          <>
            <div className="settings-step-panel-head">
              <div>
                <div className="settings-eyebrow">Step 2</div>
                <h3>Confirm governance role</h3>
                <p>The role only matters when a restricted guarded LLM mode is selected.</p>
              </div>
            </div>
            <div className="settings-role-grid" role="radiogroup" aria-label="Governance Role">
              {governanceRoleOptions.map((option) => {
                const isSelected = option.value === governanceRole

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`settings-role-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setGovernanceRole(option.value)}
                    aria-pressed={isSelected}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        {activeStep === 'guarded' ? (
          <>
            <div className="settings-step-panel-head">
              <div>
                <div className="settings-eyebrow">Step 3</div>
                <h3>Choose guarded LLM behavior</h3>
                <p>Controls whether LLM is off, shadow-only, validator-gated, or routed to human approval.</p>
              </div>
            </div>
            <div className="settings-choice-list" role="radiogroup" aria-label="Guarded Decisioning Mode">
              {guardedModeOptions.map((option) => {
                const isSelected = option.value === guardedMode
                const saveState = guardedModeSaveState(option.value, governanceRole)

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`settings-mode-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setGuardedMode(option.value)}
                    aria-pressed={isSelected}
                  >
                    <span className="settings-mode-option-head">
                      <span>
                        <strong>{option.label}</strong>
                        <span>{option.summary}</span>
                      </span>
                      <span
                        className={`settings-mode-readiness ${
                          saveState === 'Role can save' ? 'ready' : 'blocked'
                        }`}
                      >
                        {saveState}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
      </div>

      <div className="settings-selected-summary">
        <div>
          <span>Selected Recommendation</span>
          <strong>{selectedOption.label}</strong>
          <p>{selectedOption.summary}</p>
        </div>
        <div>
          <span>Selected Governance Role</span>
          <strong>{selectedRoleOption.label}</strong>
          <p>{selectedRoleOption.description}</p>
        </div>
        <div>
          <span>Selected Guarded LLM</span>
          <strong>{selectedGuardedOption.label}</strong>
          <p>{selectedGuardedOption.summary}</p>
        </div>
      </div>

      {message ? <div className="small settings-save-success">{message}</div> : null}
      {error ? <div className="small settings-save-error">{error}</div> : null}
    </div>
  )
}
