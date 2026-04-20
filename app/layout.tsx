import './globals.css'
import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'

export const metadata: Metadata = {
  title: 'AI Renewal Quote Copilot',
  description: 'AI-powered workflow for enterprise SaaS renewal recommendations and quote execution.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
