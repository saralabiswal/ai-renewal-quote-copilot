'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MlRecommendationMode } from '@/lib/settings/runtime-settings'

type Props = {
  initialMode: MlRecommendationMode
  shadowApproved: boolean
  hybridApproved: boolean
  modelExists: boolean
  predictionScriptExists: boolean
}

const modeOptions: Array<{
  value: MlRecommendationMode
  label: string
  stance: string
  description: string
  outcome: string
}> = [
  {
    value: 'RULES_ONLY',
    label: 'Rules Only',
    stance: 'Deterministic baseline',
    description: 'Use the deterministic recommendation engine only.',
    outcome: 'Rules produce recommendation, risk, pricing posture, and approval state.',
  },
  {
    value: 'ML_SHADOW',
    label: 'Shadow Mode',
    stance: 'Audit and compare',
    description: 'Run ML scoring and show metadata without changing recommendations.',
    outcome: 'Rules stay final; ML evidence is logged for Decision Trace and Quote Insights.',
  },
  {
    value: 'HYBRID_RULES_ML',
    label: 'ML-Assisted Rules',
    stance: 'ML-assisted decisioning',
    description: 'Blend ML risk scores into recommendations while keeping guardrails final.',
    outcome: 'ML can influence risk/action after recalculation; pricing guardrails remain final.',
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

export function MlSettingsForm({
  initialMode,
  shadowApproved,
  hybridApproved,
  modelExists,
  predictionScriptExists,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<MlRecommendationMode>(initialMode)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedOption = modeOptions.find((option) => option.value === mode) ?? modeOptions[0]

  async function saveMode() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/settings/ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mlRecommendationMode: mode }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to save ML settings.')
      }

      setMessage('Applied. Future recalculations will use this ML mode.')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save ML settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-mode-control">
      <label className="policy-select-label" htmlFor="ml-recommendation-mode">
        Select Recommendation Mode
      </label>
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

      <div className="settings-mode-card-grid" role="radiogroup" aria-label="Recommendation Mode">
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
                  <span>{option.stance}</span>
                </span>
                <span className={`settings-mode-readiness ${modeReadinessTone(readiness)}`}>
                  {readiness}
                </span>
              </span>
              <span className="settings-mode-option-copy">{option.description}</span>
              <span className="settings-mode-option-outcome">{option.outcome}</span>
            </button>
          )
        })}
      </div>

      <div className="settings-mode-selected-summary">
        <div>
          <div className="small muted">Selected behavior</div>
          <strong>{selectedOption.label}</strong>
          <p>{selectedOption.outcome}</p>
        </div>
        <button className="button-link" type="button" onClick={saveMode} disabled={isSaving}>
          {isSaving ? 'Applying...' : 'Apply ML Mode'}
        </button>
      </div>

      {message ? <div className="small settings-save-success">{message}</div> : null}
      {error ? <div className="small settings-save-error">{error}</div> : null}
    </div>
  )
}
