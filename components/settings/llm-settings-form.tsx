'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  initialTimeoutMs: number
}

function clampTimeout(value: number) {
  if (!Number.isFinite(value)) return 60000
  return Math.max(1000, Math.min(300000, Math.round(value)))
}

function formatSeconds(value: number) {
  return `${Math.round(value / 1000)}s`
}

export function LlmSettingsForm({ initialTimeoutMs }: Props) {
  const router = useRouter()
  const [timeoutMs, setTimeoutMs] = useState(initialTimeoutMs)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveSettings() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const nextTimeoutMs = clampTimeout(timeoutMs)
      const response = await fetch('/api/settings/ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llmJsonTimeoutMs: nextTimeoutMs }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(body?.error ?? 'Failed to save LLM timeout.')
      }

      setTimeoutMs(nextTimeoutMs)
      setMessage(`Applied. JSON LLM calls can run for up to ${formatSeconds(nextTimeoutMs)}.`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save LLM timeout.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-llm-runtime-form">
      <div className="settings-llm-runtime-head">
        <div>
          <strong>LLM JSON Timeout</strong>
          <p>
            Maximum time allowed for guarded JSON LLM calls before deterministic fallback is used.
          </p>
        </div>
        <button className="button-link" type="button" onClick={saveSettings} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Timeout'}
        </button>
      </div>

      <label className="settings-llm-runtime-field" htmlFor="llm-json-timeout-ms">
        <span>Timeout in milliseconds</span>
        <input
          id="llm-json-timeout-ms"
          type="number"
          min={1000}
          max={300000}
          step={1000}
          value={timeoutMs}
          onChange={(event) => setTimeoutMs(Number(event.target.value))}
        />
      </label>

      <input
        aria-label="LLM JSON timeout slider"
        className="settings-llm-runtime-slider"
        type="range"
        min={1000}
        max={300000}
        step={1000}
        value={clampTimeout(timeoutMs)}
        onChange={(event) => setTimeoutMs(Number(event.target.value))}
      />

      <div className="settings-llm-runtime-summary">
        Current selection: <strong>{clampTimeout(timeoutMs).toLocaleString('en-US')}ms</strong> (
        {formatSeconds(clampTimeout(timeoutMs))})
      </div>

      {message ? <div className="small settings-save-success">{message}</div> : null}
      {error ? <div className="small settings-save-error">{error}</div> : null}
    </div>
  )
}
