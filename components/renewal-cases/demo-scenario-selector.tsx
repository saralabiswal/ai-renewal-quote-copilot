'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DEMO_SCENARIO_KEYS, DEMO_SCENARIOS, type DemoScenarioKey } from '@/lib/scenarios/demo-scenarios'

const SCENARIOS = DEMO_SCENARIO_KEYS.map((key) => ({
  key,
  label: DEMO_SCENARIOS[key].label,
}))

export function DemoScenarioSelector({
  caseId,
  selectedScenarioKey,
  embedded = false,
}: {
  caseId: string
  selectedScenarioKey: string
  embedded?: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState<DemoScenarioKey>(
    (SCENARIOS.find((scenario) => scenario.key === selectedScenarioKey)?.key ?? 'BASE_CASE') as DemoScenarioKey,
  )
  const [isSaving, setIsSaving] = useState(false)

  async function handleChange(nextValue: DemoScenarioKey) {
    setValue(nextValue)
    setIsSaving(true)

    try {
      await fetch(`/api/renewal-cases/${caseId}/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioKey: nextValue }),
      })
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  const selector = (
    <div className={`scenario-selector-shell${isSaving ? ' is-saving' : ''}`}>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value as DemoScenarioKey)}
        disabled={isSaving}
        aria-busy={isSaving}
        className={`input scenario-selector-input${isSaving ? ' is-saving' : ''}`}
        style={embedded ? { width: '100%' } : { minWidth: 260 }}
      >
        {SCENARIOS.map((scenario) => (
          <option key={scenario.key} value={scenario.key}>
            {scenario.label}
          </option>
        ))}
      </select>
      <span className={`scenario-selector-state${isSaving ? ' is-visible' : ''}`}>
        {isSaving ? 'Saving scenario...' : 'Scenario ready'}
      </span>
    </div>
  )

  if (embedded) {
    return selector
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-header" style={{ marginBottom: 10 }}>
        <div>
          <h3 className="panel-title">Demo Scenario</h3>
          <p className="section-subtitle">
            Change commercial signals, then regenerate recommendation and insights.
          </p>
        </div>
      </div>

      {selector}
    </div>
  )
}
