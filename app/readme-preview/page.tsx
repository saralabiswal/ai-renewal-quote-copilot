'use client'

import { useEffect } from 'react'

const mermaidArchitecture = `flowchart LR
  U[Business User]

  subgraph WEB["Next.js App Router"]
    PAGES["Pages + Server Components"]
    CLIENT["Client Actions\\n(recalculate, regenerate, apply, review)"]
    API["Route Handlers\\n/app/api/renewal-cases/..."]
  end

  subgraph DOMAIN["Domain Layer"]
    DB["lib/db/*\\nworkflow orchestration + persistence"]
    RULES["lib/rules/*\\nrisk + recommendation + pricing guardrails"]
    AI["lib/ai/*\\nprompting + model/fallback generation"]
  end

  subgraph DATA["Data Layer"]
    PRISMA["Prisma Client"]
    SQLITE[("SQLite\\nprisma/dev.db")]
  end

  OAI["OpenAI API (optional)"]

  U --> PAGES
  U --> CLIENT
  CLIENT --> API
  PAGES --> DB
  API --> DB
  DB --> RULES
  DB --> AI
  DB --> PRISMA --> SQLITE
  AI --> OAI`

const asciiArchitecture = `+--------------------+
| Business User      |
+--------------------+
          |
          v
+----------------------------------------------+
| Next.js App Router                            |
| - Pages + Server Components                   |
| - Client Actions                              |
| - Route Handlers (/app/api/renewal-cases/...) |
+----------------------------------------------+
          |
          v
+----------------------------------------------+
| Domain Layer                                  |
| - lib/db    (workflow orchestration)          |
| - lib/rules (risk + recommendations)          |
| - lib/ai    (AI generation + fallback)        |
+----------------------------------------------+
      |                           |
      v                           v
+---------------------+      +----------------------+
| Prisma Client       |      | OpenAI API (optional)|
+---------------------+      +----------------------+
      |
      v
+---------------------+
| SQLite (prisma/dev.db) |
+---------------------+`

export default function ReadmePreviewPage() {
  useEffect(() => {
    function runMermaid() {
      const mermaid = (window as any).mermaid
      if (!mermaid) return
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'neutral',
      })
      mermaid.run({
        querySelector: '.mermaid',
      })
    }

    if ((window as any).mermaid) {
      runMermaid()
      return
    }

    const existing = document.querySelector(
      'script[data-mermaid-preview="true"]',
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', runMermaid, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    script.async = true
    script.dataset.mermaidPreview = 'true'
    script.addEventListener('load', runMermaid, { once: true })
    document.body.appendChild(script)
  }, [])

  return (
    <div className="page">
      <section className="card" style={{ display: 'grid', gap: 14 }}>
        <header>
          <h1 style={{ marginBottom: 6 }}>README Preview</h1>
          <p className="section-subtitle" style={{ marginTop: 0 }}>
            Visual preview of the architecture diagrams used in <code>README.md</code>.
          </p>
        </header>

        <div>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Mermaid Diagram
          </h2>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: '#ffffff',
              padding: 12,
              overflowX: 'auto',
            }}
          >
            <pre className="mermaid" style={{ margin: 0 }}>
              {mermaidArchitecture}
            </pre>
          </div>
        </div>

        <div>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            ASCII Fallback
          </h2>
          <pre
            style={{
              margin: 0,
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: '#f8fafc',
              padding: 12,
              overflowX: 'auto',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {asciiArchitecture}
          </pre>
        </div>
      </section>
    </div>
  )
}
