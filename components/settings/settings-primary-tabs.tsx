'use client'

import { useState, type ReactNode } from 'react'

type SettingsTab = 'recommendation' | 'text-generation'

export function SettingsPrimaryTabs({
  recommendation,
  textGeneration,
}: {
  recommendation: ReactNode
  textGeneration: ReactNode
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('recommendation')

  return (
    <section className="settings-primary-tabs">
      <div className="settings-tabbar" role="tablist" aria-label="Settings focus">
        <button
          type="button"
          className={`settings-tab ${activeTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendation')}
          role="tab"
          aria-selected={activeTab === 'recommendation'}
        >
          Recommendation Mode
        </button>
        <button
          type="button"
          className={`settings-tab ${activeTab === 'text-generation' ? 'active' : ''}`}
          onClick={() => setActiveTab('text-generation')}
          role="tab"
          aria-selected={activeTab === 'text-generation'}
        >
          LLM Provider
        </button>
      </div>

      <div className="settings-tab-panel" role="tabpanel">
        {activeTab === 'recommendation' ? recommendation : textGeneration}
      </div>
    </section>
  )
}
