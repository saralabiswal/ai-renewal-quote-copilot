import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export function Topbar() {
  return (
    <header className="topbar">
      <Link href="/" className="topbar-home">
        <strong>AI Renewal Quote Copilot</strong>
      </Link>
      <div className="topbar-meta">
        <span>SQLite + Prisma demo</span>
        <Badge tone="info">Local Demo</Badge>
      </div>
    </header>
  )
}
