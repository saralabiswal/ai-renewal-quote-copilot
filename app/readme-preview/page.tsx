import { WorkspaceNav } from '@/components/layout/workspace-nav'

function DiagramBox({
  x,
  y,
  width,
  height,
  title,
  lines,
  accent = '#0f766e',
}: {
  x: number
  y: number
  width: number
  height: number
  title: string
  lines: string[]
  accent?: string
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="10"
        fill="#ffffff"
        stroke="#cbd5e1"
      />
      <rect x={x} y={y} width="6" height={height} rx="3" fill={accent} />
      <text x={x + 18} y={y + 26} fill="#172033" fontSize="16" fontWeight="700">
        {title}
      </text>
      <text x={x + 18} y={y + 50} fill="#52677f" fontSize="13">
        {lines.map((line, index) => (
          <tspan key={line} x={x + 18} dy={index === 0 ? 0 : 18}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}

function ArchitectureDiagramSvg() {
  return (
    <svg
      className="architecture-svg"
      viewBox="0 0 1180 360"
      role="img"
      aria-labelledby="architecture-diagram-title architecture-diagram-desc"
    >
      <title id="architecture-diagram-title">Backend renewal workflow architecture</title>
      <desc id="architecture-diagram-desc">
        Backend workflow from API trigger through orchestration, evidence loading, deterministic
        policy, ML and LLM assistance, validation, quote outputs, audit trace, and persistence.
      </desc>
      <defs>
        <marker
          id="diagram-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
        </marker>
      </defs>

      <rect width="1180" height="360" rx="16" fill="#f8fafc" />

      <DiagramBox
        x={30}
        y={54}
        width={170}
        height={102}
        title="API Trigger"
        lines={['Route handler', 'Scenario key', 'Reviewer action']}
        accent="#1d4ed8"
      />
      <DiagramBox
        x={250}
        y={54}
        width={210}
        height={102}
        title="Workflow Orchestrator"
        lines={['Load renewal case', 'Select mode', 'Coordinate steps']}
      />
      <DiagramBox
        x={510}
        y={54}
        width={210}
        height={102}
        title="Evidence Snapshot"
        lines={['Account signals', 'Subscription lines', 'Baseline quote']}
        accent="#334155"
      />
      <DiagramBox
        x={770}
        y={54}
        width={210}
        height={102}
        title="Policy Engine"
        lines={['Recommendation rules', 'Pricing guardrails', 'Approval routing']}
        accent="#0f766e"
      />
      <DiagramBox
        x={510}
        y={224}
        width={210}
        height={92}
        title="ML Assistance"
        lines={['Feature vector', 'Local predictor', 'Registry evidence']}
        accent="#7c3aed"
      />
      <DiagramBox
        x={770}
        y={224}
        width={210}
        height={92}
        title="Guarded AI"
        lines={['Prompt pack', 'Narrative output', 'Validator finalizer']}
        accent="#c2410c"
      />
      <DiagramBox
        x={1024}
        y={44}
        width={126}
        height={122}
        title="Outputs"
        lines={['Scenario quote', 'Quote insight', 'Review status']}
        accent="#3858d8"
      />
      <DiagramBox
        x={1024}
        y={214}
        width={126}
        height={102}
        title="Audit Store"
        lines={['Decision run', 'Trace JSON', 'SQLite']}
        accent="#334155"
      />

      <path className="architecture-svg-edge" d="M 200 105 L 250 105" />
      <path className="architecture-svg-edge" d="M 460 105 L 510 105" />
      <path className="architecture-svg-edge" d="M 720 105 L 770 105" />
      <path className="architecture-svg-edge" d="M 980 105 L 1024 105" />
      <path className="architecture-svg-edge" d="M 615 156 L 615 224" />
      <path className="architecture-svg-edge" d="M 720 270 L 770 270" />
      <path className="architecture-svg-edge" d="M 875 224 L 875 156" />
      <path className="architecture-svg-edge" d="M 980 270 L 1024 265" />
      <path className="architecture-svg-edge" d="M 1087 166 L 1087 214" />
    </svg>
  )
}

export default function ReadmePreviewPage() {
  return (
    <div className="page">
      <WorkspaceNav
        title="Developer Workbench"
        subtitle="Run, reset, inspect, and validate the local demo implementation."
        activeHref="/readme-preview"
        items={[
          {
            label: 'Developer Guide',
            href: '/readme-preview',
            description: 'Docs and diagrams',
          },
          {
            label: 'Decisioning Setup',
            href: '/settings',
            description: 'Runtime values',
          },
          {
            label: 'AI Architecture',
            href: '/technical-review',
            description: 'Model evidence',
          },
          {
            label: 'Generation Trace',
            href: '/renewal-cases',
            description: 'Workflow debug path',
          },
          {
            label: 'Flow Map',
            href: '/',
            description: 'Audience paths',
          },
        ]}
      />

      <section className="card readme-preview-card">
        <header>
          <h1>Developer Guide Preview</h1>
          <p className="section-subtitle">
            Backend workflow view of how scenario quotes, guidance, validation, and audit evidence are generated.
          </p>
        </header>

        <div>
          <h2 className="section-title">Backend Workflow Design</h2>
          <div className="readme-diagram-panel">
            <ArchitectureDiagramSvg />
          </div>
        </div>
      </section>
    </div>
  )
}
