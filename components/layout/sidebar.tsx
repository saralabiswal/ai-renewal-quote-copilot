'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const navItems = [
  {
    id: 'audience_flow',
    href: '/',
    label: 'Flow Map',
    hint: 'Choose the right path by user type',
    group: 'home',
    stepLabel: 'Flow',
  },
  {
    id: 'dashboard',
    href: '/business-home',
    label: 'Business Home',
    hint: 'Portfolio queue and entry actions',
    group: 'business',
    stepLabel: 'Home',
  },
  {
    id: 'subscriptions',
    href: '/renewal-cases?view=list',
    label: 'Renewal Subscriptions',
    hint: 'Review subscription baseline',
    group: 'business',
    stepLabel: 'Step 1',
  },
  {
    id: 'quote_board',
    href: '/quote-drafts',
    label: 'Baseline Quote Review',
    hint: 'Review editable baseline quote',
    group: 'business',
    stepLabel: 'Step 2',
  },
  {
    id: 'scenario_quotes',
    href: '/scenario-quotes',
    label: 'Scenario Quote Review',
    hint: 'Review scenario quote options',
    group: 'business',
    stepLabel: 'Step 3',
  },
  {
    id: 'case_board',
    href: '/renewal-cases',
    label: 'Scenario Quote Generation Trace',
    hint: 'Optional: inspect generation steps',
    group: 'business',
    stepLabel: 'Optional',
  },
  {
    id: 'settings',
    href: '/settings',
    label: 'Decisioning Setup',
    hint: 'Runtime posture and readiness',
    group: 'architecture',
    stepLabel: 'Runtime',
  },
  {
    id: 'policies',
    href: '/policies',
    label: 'Policy Playbook',
    hint: 'Rules, guardrails, prompts',
    group: 'architecture',
    stepLabel: 'Policy',
  },
  {
    id: 'technical_review',
    href: '/technical-review',
    label: 'AI Architecture',
    hint: 'AI/ML architecture evidence',
    group: 'architecture',
    stepLabel: 'Architecture',
  },
  {
    id: 'readme_preview',
    href: '/readme-preview',
    label: 'Developer Guide',
    hint: 'Local setup and docs preview',
    group: 'developer',
    stepLabel: 'Docs',
  },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')

  function isActive(item: (typeof navItems)[number]) {
    const { href, id } = item
    if (!href) return false

    if (id === 'dashboard') {
      return pathname === '/business-home'
    }

    if (id === 'subscriptions') {
      return pathname === '/renewal-cases' && view === 'list'
    }

    if (id === 'case_board') {
      if (pathname.startsWith('/renewal-cases/')) return true
      return pathname === '/renewal-cases' && view !== 'list'
    }

    const [hrefPath] = href.split('?')
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)
  }

  return (
    <aside className="sidebar">
      <Link className="brand brand-link" href="/">
        <div className="brand-title">AI Renewal Quote Copilot</div>
        <div className="brand-subtitle">ML-assisted renewal recommendation and quote execution</div>
      </Link>
      <nav className="nav-section">
        <div className="nav-group">
          <div className="nav-group-title">Start Here</div>
          {navItems
            .filter((item) => item.group === 'home')
            .map((item) => (
              <Link
                key={item.id}
                className={`nav-link ${isActive(item) ? 'active' : ''}`}
                href={item.href}
              >
                <span className="nav-link-top">
                  <span className="nav-step-label">{item.stepLabel}</span>
                  <span className="nav-link-title">{item.label}</span>
                </span>
                <span className="nav-link-hint">{item.hint}</span>
              </Link>
            ))}
        </div>

        <div className="nav-group">
          <div className="nav-group-title">Business Workspace</div>
          {navItems
            .filter((item) => item.group === 'business')
            .map((item) => (
              <Link
                key={item.id}
                className={`nav-link ${isActive(item) ? 'active' : ''}`}
                href={item.href}
              >
                <span className="nav-link-top">
                  <span className="nav-step-label">{item.stepLabel}</span>
                  <span className="nav-link-title">{item.label}</span>
                </span>
                <span className="nav-link-hint">{item.hint}</span>
              </Link>
            ))}
        </div>

        <div className="nav-group">
          <div className="nav-group-title">Architecture Console</div>
          {navItems
            .filter((item) => item.group === 'architecture')
            .map((item) => (
              <Link
                key={item.id}
                className={`nav-link ${isActive(item) ? 'active' : ''}`}
                href={item.href}
              >
                <span className="nav-link-top">
                  <span className="nav-step-label">{item.stepLabel}</span>
                  <span className="nav-link-title">{item.label}</span>
                </span>
                <span className="nav-link-hint">{item.hint}</span>
              </Link>
            ))}
        </div>

        <div className="nav-group">
          <div className="nav-group-title">Developer Workbench</div>
          {navItems
            .filter((item) => item.group === 'developer')
            .map((item) => (
              <Link
                key={item.id}
                className={`nav-link ${isActive(item) ? 'active' : ''}`}
                href={item.href}
              >
                <span className="nav-link-top">
                  <span className="nav-step-label">{item.stepLabel}</span>
                  <span className="nav-link-title">{item.label}</span>
                </span>
                <span className="nav-link-hint">{item.hint}</span>
              </Link>
            ))}
        </div>
      </nav>
    </aside>
  )
}
