'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

function currentWorkspaceLabel(pathname: string, isRenewalListView: boolean) {
  if (pathname === '/' || pathname.startsWith('/audience-flow')) return 'Flow Map'
  if (pathname.startsWith('/business-home')) return 'Business Home'
  if (pathname.startsWith('/readme-preview')) return 'Developer Workbench'
  if (pathname.startsWith('/renewal-cases/')) return 'Scenario Quote Generation Trace'
  if (pathname.startsWith('/renewal-cases') && isRenewalListView) return 'Renewal Subscriptions'
  if (pathname.startsWith('/renewal-cases')) return 'Scenario Quote Generation Trace'
  if (pathname.startsWith('/quote-drafts/')) return 'Baseline Quote Review'
  if (pathname.startsWith('/quote-drafts')) return 'Baseline Quote Review'
  if (pathname.startsWith('/scenario-quotes/')) return 'Scenario Quote Review'
  if (pathname.startsWith('/scenario-quotes')) return 'Scenario Quote Review'
  if (pathname.startsWith('/policies')) return 'Policy Playbook'
  if (pathname.startsWith('/technical-review')) return 'AI Decision Flow'
  if (pathname.startsWith('/settings')) return 'Decisioning Setup'
  return 'Business Home'
}

function currentAudienceLabel(pathname: string) {
  if (pathname === '/' || pathname.startsWith('/audience-flow')) return 'Start Here'
  if (pathname.startsWith('/business-home')) return 'Business Workspace'
  if (pathname.startsWith('/settings')) return 'Architecture Console'
  if (pathname.startsWith('/policies')) return 'Architecture Console'
  if (pathname.startsWith('/technical-review')) return 'Architecture Console'
  if (pathname.startsWith('/readme-preview')) return 'Developer Workbench'
  return 'Business Workspace'
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

function nextStepHint(pathname: string, isRenewalListView: boolean) {
  if (pathname === '/' || pathname.startsWith('/audience-flow')) {
    return 'Choose Business, Architecture, or Developer based on the review goal.'
  }
  if (pathname.startsWith('/business-home')) {
    return 'Triage renewal risk, start with subscription review, then move through baseline and scenario quote review with optional generation trace when needed.'
  }
  if (pathname.startsWith('/readme-preview')) {
    return 'Use local commands, reset the database, then validate the workflow.'
  }
  if (pathname.startsWith('/renewal-cases/')) {
    return 'Inspect the step-by-step trace behind scenario quote generation.'
  }
  if (pathname.startsWith('/renewal-cases') && isRenewalListView) {
    return 'Review subscription scope first, then continue to Baseline Quote Review.'
  }
  if (pathname.startsWith('/renewal-cases')) {
    return 'Use after reviewing subscriptions, baseline quote, and scenario quote.'
  }
  if (pathname.startsWith('/quote-drafts/')) {
    return 'Review the editable baseline quote before comparing scenario quotes.'
  }
  if (pathname.startsWith('/quote-drafts')) {
    return 'Open a baseline quote to review commercial lines and quote status.'
  }
  if (pathname.startsWith('/scenario-quotes/')) {
    return 'Compare scenario quote options against the baseline quote.'
  }
  if (pathname.startsWith('/scenario-quotes')) {
    return 'Choose a renewal case to review scenario quote options.'
  }
  if (pathname.startsWith('/policies')) {
    return 'Explain policy logic, guardrails, prompt governance, and change control.'
  }
  if (pathname.startsWith('/technical-review')) {
    return 'Review standalone ML architecture, serving, evaluation, and decision trace evidence.'
  }
  if (pathname.startsWith('/settings')) {
    return 'Confirm recommendation mode, guarded LLM posture, and runtime readiness.'
  }
  return 'Start with Business Flow, or switch to Architecture Console for trust review.'
}

export function Topbar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isRenewalListView = pathname.startsWith('/renewal-cases') && searchParams.get('view') === 'list'
  const workspace = currentWorkspaceLabel(pathname, isRenewalListView)
  const audience = currentAudienceLabel(pathname)
  const entity = currentEntityLabel(pathname)
  const nextStep = nextStepHint(pathname, isRenewalListView)

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="topbar-home">
          <strong>AI Renewal Quote Copilot</strong>
        </Link>
        <div className="topbar-context">
          <span className="topbar-context-label">{audience}</span>
          <h1 className="topbar-context-value">{workspace}</h1>
          {entity ? (
            <>
              <span className="topbar-context-divider">•</span>
              <span className="topbar-context-entity">{entity}</span>
            </>
          ) : null}
        </div>
        <p className="topbar-next-step">{nextStep}</p>
      </div>
      <div className="topbar-meta">
        <Badge tone="info">Self-Serve Demo</Badge>
      </div>
    </header>
  )
}
