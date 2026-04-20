'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const navItems = [
  { href: '/renewal-cases?view=list', label: 'Renewal Subscriptions' },
  { href: '/renewal-cases', label: 'Renewal Queue' },
  { href: '/quote-drafts', label: 'Renewal Quotes' },
  { href: '/policies', label: 'Policy Studio' },
  { href: '/settings', label: 'Settings' },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')

  function isActive(href: string | null, label: string) {
    if (!href) return false

    if (label === 'Renewal Subscriptions') {
      return pathname === '/renewal-cases' && view === 'list'
    }

    if (label === 'Renewal Queue') {
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
        {navItems.map((item, index) => (
          <Link
            key={`${item.label}-${index}`}
            className={`nav-link ${isActive(item.href, item.label) ? 'active' : ''}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
