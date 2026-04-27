'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

function currentWorkspaceLabel(pathname: string) {
  if (pathname.startsWith('/renewal-cases/')) return 'Renewal Command Center'
  if (pathname.startsWith('/renewal-cases')) return 'Renewal Command Center'
  if (pathname.startsWith('/quote-drafts/')) return 'Quote Review Center'
  if (pathname.startsWith('/quote-drafts')) return 'Quote Review Center'
  if (pathname.startsWith('/scenario-quotes/')) return 'Scenario Studio'
  if (pathname.startsWith('/scenario-quotes')) return 'Scenario Studio'
  if (pathname.startsWith('/policies')) return 'Policy Studio'
  if (pathname.startsWith('/technical-review')) return 'AI Architecture'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Dashboard'
}

function currentEntityLabel(pathname: string) {
  const [rawPath] = pathname.split('?')
  const segments = rawPath.split('/').filter(Boolean)

  if (segments[0] === 'renewal-cases' && segments[1]) {
    return `Case ${decodeURIComponent(segments[1])}`
  }

  if (segments[0] === 'scenario-quotes' && segments[1]) {
    return `Case ${decodeURIComponent(segments[1])}`
  }

  if (segments[0] === 'quote-drafts' && segments[1]) {
    return `Quote ${decodeURIComponent(segments[1])}`
  }

  return null
}

function nextStepHint(pathname: string) {
  if (pathname.startsWith('/renewal-cases/')) {
    return 'Set scenario, run workflow, then apply quote insights.'
  }
  if (pathname.startsWith('/renewal-cases')) {
    return 'Open a case with high risk or approval required first.'
  }
  if (pathname.startsWith('/quote-drafts/')) {
    return 'Validate commercial changes, then submit the quote review decision.'
  }
  if (pathname.startsWith('/quote-drafts')) {
    return 'Open a quote to review line-level impact and status.'
  }
  if (pathname.startsWith('/scenario-quotes/')) {
    return 'Compare against baseline and mark preferred scenario in Scenario Studio.'
  }
  if (pathname.startsWith('/scenario-quotes')) {
    return 'Choose a renewal case to open scenario comparison.'
  }
  if (pathname.startsWith('/policies')) {
    return 'Use this page to explain policy logic and ML-assisted recommendation behavior.'
  }
  if (pathname.startsWith('/technical-review')) {
    return 'Review standalone ML architecture, serving, evaluation, and decision trace evidence.'
  }
  if (pathname.startsWith('/settings')) {
    return 'Set Recommendation Mode, then confirm local ML and optional AI readiness.'
  }
  return 'Start in Renewal Command Center or Renewal Subscriptions.'
}

export function Topbar() {
  const pathname = usePathname()
  const workspace = currentWorkspaceLabel(pathname)
  const entity = currentEntityLabel(pathname)
  const nextStep = nextStepHint(pathname)

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="topbar-home">
          <strong>AI Renewal Quote Copilot</strong>
        </Link>
        <div className="topbar-context">
          <span className="topbar-context-label">Area</span>
          <span className="topbar-context-value">{workspace}</span>
          {entity ? (
            <>
              <span className="topbar-context-divider">•</span>
              <span className="topbar-context-entity">{entity}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="topbar-meta">
        <span className="topbar-next-step">{nextStep}</span>
        <Badge tone="info">Self-Serve Demo</Badge>
      </div>
    </header>
  )
}
