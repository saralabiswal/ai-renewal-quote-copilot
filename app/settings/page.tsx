import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'

function isEnabled(raw: string | undefined) {
  const value = raw?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export default function SettingsPage() {
  const openAiApiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())
  const openAiModel = process.env.OPENAI_MODEL || 'gpt-5.3'
  const openAiMockModeEnabled = isEnabled(process.env.OPENAI_MOCK_MODE)

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        description="Runtime configuration for this app. The only required integration setting is OPENAI_API_KEY."
        purpose="Confirm runtime readiness and AI mode before users run workflow actions."
        nextStep="Verify API key status and selected model."
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">OpenAI Configuration</h2>
            <p className="section-subtitle">
              Keep secrets out of source control. Use environment variables only.
            </p>
          </div>
        </div>

        <div className="kv">
          <div className="muted">OPENAI_API_KEY</div>
          <div>
            <Badge tone={openAiApiKeyConfigured ? 'success' : 'warn'}>
              {openAiApiKeyConfigured ? 'Configured' : 'Not Configured'}
            </Badge>
          </div>
        </div>

        <div className="kv">
          <div className="muted">OPENAI_MODEL</div>
          <div>{openAiModel}</div>
        </div>

        <div className="kv">
          <div className="muted">OPENAI_MOCK_MODE</div>
          <div>
            <Badge tone={openAiMockModeEnabled ? 'info' : 'default'}>
              {openAiMockModeEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>
      </section>
    </div>
  )
}
