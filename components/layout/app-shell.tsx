import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-grid">
      <Suspense fallback={<aside className="sidebar" />}>
        <Sidebar />
      </Suspense>
      <div className="main">
        <Topbar />
        {children}
      </div>
    </div>
  )
}
