'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const navItems = [
  {
    id: 'subscriptions',
    href: '/renewal-cases?view=list',
    label: 'Renewal Subscriptions',
    hint: 'Baseline subscription context',
    group: 'flow',
    stepLabel: 'Step 1',
  },
  {
    id: 'case_board',
    href: '/renewal-cases',
    label: 'Case Decision Board',
    hint: 'Run recommendation workflow',
    group: 'flow',
    stepLabel: 'Step 2',
  },
  {
    id: 'scenario_quotes',
    href: '/scenario-quotes',
    label: 'Scenario Quotes',
    hint: 'Compare alternatives vs baseline',
    group: 'flow',
    stepLabel: 'Step 3',
  },
  {
    id: 'quote_board',
    href: '/quote-drafts',
    label: 'Quote Draft Board',
    hint: 'Submit final quote decision',
    group: 'flow',
    stepLabel: 'Step 4',
  },
  {
    id: 'policies',
    href: '/policies',
    label: 'Policy Studio',
    hint: 'Explain recommendation logic',
    group: 'support',
    stepLabel: 'Reference',
  },
  {
    id: 'settings',
    href: '/settings',
    label: 'Settings',
    hint: 'Check model and API readiness',
    group: 'support',
    stepLabel: 'Setup',
  },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')

  function isActive(item: (typeof navItems)[number]) {
    const { href, id } = item
    if (!href) return false

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
        <div className="brand-subtitle">AI-assisted renewal recommendation and quote execution</div>
      </Link>
      <nav className="nav-section">
        <div className="nav-group">
          <div className="nav-group-title">Primary Flow</div>
          {navItems
            .filter((item) => item.group === 'flow')
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
          <div className="nav-group-title">Support</div>
          {navItems
            .filter((item) => item.group === 'support')
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
