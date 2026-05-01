import { existsSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { ViewModeSwitch } from '@/components/ui/view-mode-switch'
import { labelize } from '@/lib/format/risk'
import { getMlRuntimeConfig, mlModeLabel } from '@/lib/ml/config'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type RegistryModel = {
  activeVersion?: string
  modelName?: string
  modelPath?: string
  metadataPath?: string
  featureSchemaVersion?: string
  approvedForShadow?: boolean
  approvedForHybrid?: boolean
  artifactSha256?: string
  latestEvaluationReport?: string
  latestMetrics?: Record<string, number | null>
  owner?: string
  notes?: string
}

type ModelRegistry = {
  models?: Record<string, RegistryModel>
}

type EvaluationReport = {
  generatedAt?: string
  data?: {
    source?: string
    trainingRows?: number
    holdoutRows?: number
    labelSource?: string
    evaluationProtocol?: string
    productionLabelExpectation?: string[]
  }
  featureSchemaVersion?: string
  artifacts?: Record<string, unknown>
  modelSelection?: {
    renewalRisk?: {
      criterion?: string
      selected?: ModelCandidate
      candidates?: ModelCandidate[]
    }
    expansionPropensity?: {
      criterion?: string
      selected?: ModelCandidate
      candidates?: ModelCandidate[]
    }
    xgboostStatus?: {
      available?: boolean
      error?: string | null
    }
  }
  models?: Record<
    string,
    {
      modelName?: string
      modelType?: string
      framework?: string
      metrics?: Record<string, number | null>
      ruleBaselineMetrics?: Record<string, number | null>
    }
  >
  limitations?: string[]
}

type ModelCandidate = {
  modelName?: string
  modelType?: string
  framework?: string
  role?: string
  modelPath?: string
  metadataPath?: string
  available?: boolean
  metrics?: Record<string, number | null>
}

type DatasetSummary = {
  exists: boolean
  path: string
  sizeKb: number | null
  rows: number
  cases: number
  productArchetypes: number
  scenarioCounts: Record<string, number>
  dispositionCounts: Record<string, number>
}

const ROOT = process.cwd()
const REGISTRY_PATH = path.join(ROOT, 'ml/model-registry.json')
const EVALUATION_PATH = path.join(ROOT, 'ml/reports/evaluation.json')
const DATASET_PATH = path.join(ROOT, 'ml/data/synthetic-renewal-training.csv')

function readJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

function formatNumber(value: number | null | undefined, digits = 4) {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

function shortHash(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  return `${value.slice(0, 16)}...`
}

function compactPath(value: string | null | undefined) {
  if (!value) return undefined
  if (/^https?:\/\//.test(value)) return value

  const relativePath = path.relative(ROOT, value)
  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return relativePath
  }

  return value.replace(`${ROOT}/`, '')
}

function metricLabel(value: string) {
  const known: Record<string, string> = {
    mae: 'MAE',
    rmse: 'RMSE',
    r2: 'R2',
    accuracy: 'Accuracy',
    precision: 'Precision',
    recall: 'Recall',
    f1: 'F1',
    rocAuc: 'ROC AUC',
  }
  return known[value] ?? labelize(value)
}

function mlRunModeLabel(mode: string | null | undefined) {
  switch (mode) {
    case 'ML_SHADOW':
      return 'Shadow Mode'
    case 'HYBRID_RULES_ML':
      return 'ML-Assisted Rules'
    case 'RULES_ONLY':
      return 'Rules Only'
    default:
      return mode ?? 'Rules Only'
  }
}

function parseDatasetSummary(): DatasetSummary {
  const base: DatasetSummary = {
    exists: existsSync(DATASET_PATH),
    path: 'ml/data/synthetic-renewal-training.csv',
    sizeKb: null,
    rows: 0,
    cases: 0,
    productArchetypes: 0,
    scenarioCounts: {},
    dispositionCounts: {},
  }

  if (!base.exists) return base

  const stat = statSync(DATASET_PATH)
  const raw = readFileSync(DATASET_PATH, 'utf8').trim()
  if (!raw) return { ...base, sizeKb: Math.round(stat.size / 102.4) / 10 }

  const [headerLine, ...lines] = raw.split(/\r?\n/)
  const headers = headerLine.split(',')
  const indexOf = (name: string) => headers.indexOf(name)
  const caseIndex = indexOf('case_id')
  const productIndex = indexOf('product_archetype')
  const scenarioIndex = indexOf('demo_scenario_key')
  const dispositionIndex = indexOf('rule_disposition')
  const cases = new Set<string>()
  const products = new Set<string>()
  const scenarioCounts: Record<string, number> = {}
  const dispositionCounts: Record<string, number> = {}

  for (const line of lines) {
    const cells = line.split(',')
    const caseId = cells[caseIndex]
    const product = cells[productIndex]
    const scenario = cells[scenarioIndex]
    const disposition = cells[dispositionIndex]
    if (caseId) cases.add(caseId)
    if (product) products.add(product)
    if (scenario) scenarioCounts[scenario] = (scenarioCounts[scenario] ?? 0) + 1
    if (disposition) dispositionCounts[disposition] = (dispositionCounts[disposition] ?? 0) + 1
  }

  return {
    ...base,
    sizeKb: Math.round(stat.size / 102.4) / 10,
    rows: lines.length,
    cases: cases.size,
    productArchetypes: products.size,
    scenarioCounts,
    dispositionCounts,
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="technical-metric-card">
      <div className="small muted">{label}</div>
      <div className="technical-metric-value">{value}</div>
      {detail ? (
        <code className="technical-metric-detail" title={detail}>
          {detail}
        </code>
      ) : null}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="card technical-review-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function MetricRows({ metrics }: { metrics?: Record<string, number | null> }) {
  const entries = Object.entries(metrics ?? {})
  if (entries.length === 0) return <div className="small muted">No metrics available.</div>
  return (
    <div className="technical-pill-row">
      {entries.map(([key, value]) => (
        <span className="technical-pill" key={key}>
          {metricLabel(key)}: <strong>{formatNumber(value)}</strong>
        </span>
      ))}
    </div>
  )
}

function ModelCandidateRows({
  candidates,
  selectedModelName,
}: {
  candidates?: ModelCandidate[]
  selectedModelName?: string
}) {
  if (!candidates || candidates.length === 0) {
    return <div className="small muted">No challenger comparison has been generated yet.</div>
  }

  return (
    <div className="technical-candidate-grid">
      {candidates.map((candidate) => {
        const isSelected = candidate.modelName === selectedModelName
        return (
          <div
            className={`technical-candidate-card ${isSelected ? 'selected' : ''}`}
            key={candidate.modelName ?? candidate.modelPath ?? 'candidate'}
          >
            <div className="technical-model-card-header">
              <div>
                <h3>{candidate.modelName ?? 'Unknown model'}</h3>
                <div className="small muted">
                  {candidate.framework ?? 'unknown'} / {candidate.modelType ?? 'unknown'}
                </div>
              </div>
              <Badge tone={isSelected ? 'success' : candidate.available ? 'info' : 'warn'}>
                {isSelected ? 'Selected' : candidate.available ? labelize(candidate.role) : 'Unavailable'}
              </Badge>
            </div>
            <MetricRows metrics={candidate.metrics} />
            {candidate.modelPath ? (
              <code className="technical-metric-detail" title={candidate.modelPath}>
                {candidate.modelPath}
              </code>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

async function getLatestDecisionRun() {
  return prisma.decisionRun.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      renewalCaseId: true,
      mode: true,
      mlMode: true,
      mlModelName: true,
      mlModelVersion: true,
      ruleOutputJson: true,
      mlOutputJson: true,
      finalOutputJson: true,
      guardrailSummaryJson: true,
      createdAt: true,
    },
  })
}

function parseRecord(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export default async function TechnicalReviewPage() {
  const registry = readJson<ModelRegistry>(REGISTRY_PATH, { models: {} })
  const evaluation = readJson<EvaluationReport>(EVALUATION_PATH, {})
  const dataset = parseDatasetSummary()
  const mlConfig = getMlRuntimeConfig()
  const latestRun = await getLatestDecisionRun()
  const riskModel = registry.models?.renewal_risk
  const expansionModel = registry.models?.expansion_propensity
  const riskEval = evaluation.models?.renewalRisk
  const expansionEval = evaluation.models?.expansionPropensity
  const riskSelection = evaluation.modelSelection?.renewalRisk
  const expansionSelection = evaluation.modelSelection?.expansionPropensity
  const xgboostStatus = evaluation.modelSelection?.xgboostStatus
  const latestRule = parseRecord(latestRun?.ruleOutputJson ?? null)
  const latestMl = parseRecord(latestRun?.mlOutputJson ?? null)
  const latestFinal = parseRecord(latestRun?.finalOutputJson ?? null)
  const latestGuardrails = parseRecord(latestRun?.guardrailSummaryJson ?? null)

  return (
    <div className="page">
      <PageHeader
        title="AI Decision Flow"
        description="Business-first explanation of how rules, ML, LLM reasoning, validators, and reviewers work together."
        purpose="Explain what the AI can influence, what remains deterministic, and how the result is audited."
        nextStep="Use Business View for the demo story. Use Technical View for model registry, evaluation, serving, and latest run evidence."
      />

      <ViewModeSwitch
        business={
          <div className="business-view-stack">
            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Enterprise AI Decision Flow</h2>
                  <p className="section-subtitle">
                    The system uses AI for reasoning and prioritization, but deterministic controls
                    protect pricing, approvals, product boundaries, and persistence.
                  </p>
                </div>
              </div>
              <div className="business-flow">
                <div className="business-flow-step">
                  <span>1</span>
                  <strong>Evidence</strong>
                  <p>Subscription, usage, support, account, product, and pricing signals are frozen.</p>
                </div>
                <div className="business-flow-step">
                  <span>2</span>
                  <strong>Rules</strong>
                  <p>Rules generate valid renewal candidates and quote insight options.</p>
                </div>
                <div className="business-flow-step">
                  <span>3</span>
                  <strong>ML</strong>
                  <p>ML scores risk and expansion propensity as controlled evidence.</p>
                </div>
                <div className="business-flow-step">
                  <span>4</span>
                  <strong>LLM</strong>
                  <p>LLM critiques or ranks candidates inside the allowed decision envelope.</p>
                </div>
                <div className="business-flow-step">
                  <span>5</span>
                  <strong>Validator</strong>
                  <p>Deterministic checks accept, reject, or fall back to rules.</p>
                </div>
                <div className="business-flow-step">
                  <span>6</span>
                  <strong>Audit</strong>
                  <p>The final result is persisted, replay-checked, and exportable.</p>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">What To Trust</h2>
                  <p className="section-subtitle">
                    These are the simple guardrails that make the AI explainable and enterprise-safe.
                  </p>
                </div>
              </div>
              <div className="business-summary-grid">
                <article className="business-summary-card">
                  <Badge tone="success">Deterministic</Badge>
                  <h3>Pricing and approvals stay controlled</h3>
                  <p>LLM output cannot bypass pricing policy, approval routing, or product catalog validation.</p>
                </article>
                <article className="business-summary-card">
                  <Badge tone="info">Bounded</Badge>
                  <h3>LLM can reason only over candidates</h3>
                  <p>The LLM can critique or rank options, but it cannot invent unsupported quote lines.</p>
                </article>
                <article className="business-summary-card">
                  <Badge tone="default">Auditable</Badge>
                  <h3>Every decision can be inspected</h3>
                  <p>Evidence, policy, candidates, LLM proposal, validator result, and final output are stored.</p>
                </article>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Current Technical Readiness</h2>
                  <p className="section-subtitle">
                    Summary of the underlying architecture without exposing every artifact first.
                  </p>
                </div>
              </div>
              <div className="business-summary-grid">
                <article className="business-summary-card">
                  <Badge tone={dataset.exists ? 'success' : 'warn'}>
                    {dataset.exists ? 'Ready' : 'Missing'}
                  </Badge>
                  <h3>Evidence Dataset</h3>
                  <p>{dataset.exists ? `${dataset.rows} synthetic rows across ${dataset.cases} cases.` : 'Dataset artifact is missing.'}</p>
                </article>
                <article className="business-summary-card">
                  <Badge tone={mlConfig.modelExists ? 'success' : 'warn'}>
                    {mlConfig.modelExists ? 'Ready' : 'Missing'}
                  </Badge>
                  <h3>ML Model</h3>
                  <p>{mlConfig.registryModelName ?? 'No registered model'} {mlConfig.registryModelVersion ?? ''}</p>
                </article>
                <article className="business-summary-card">
                  <Badge tone={latestRun ? 'success' : 'warn'}>
                    {latestRun ? 'Available' : 'No Run'}
                  </Badge>
                  <h3>Latest Audit Trail</h3>
                  <p>{latestRun ? `Latest run ${latestRun.id} is available for technical inspection.` : 'Run a case workflow to create the first decision audit.'}</p>
                </article>
              </div>
            </section>

            <div className="business-callout">
              Technical View contains model registry details, evaluation metrics, serving paths,
              latest decision evidence, and known production boundaries.
            </div>
          </div>
        }
        technical={
          <>
      <section className="technical-hero-band">
        <div>
          <div className="small muted">AI Decision Stack</div>
          <h2>Rules control policy. ML scores risk and expansion. LLMs explain. Humans approve.</h2>
        </div>
        <div className="technical-stack-flow" aria-label="AI architecture flow">
          <span>Seeded Data</span>
          <span>Rules</span>
          <span>ML</span>
          <span>LLM</span>
          <span>Guardrails</span>
          <span>Human Review</span>
        </div>
      </section>

      <Section
        title="Standalone Assets"
        subtitle="The app includes local data, model artifacts, model metadata, evaluation report, and both subprocess and service serving paths."
      >
        <div className="technical-metric-grid">
          <MetricCard
            label="Synthetic Rows"
            value={dataset.exists ? String(dataset.rows) : 'Missing'}
            detail={dataset.path}
          />
          <MetricCard label="Synthetic Cases" value={String(dataset.cases)} />
          <MetricCard label="Product Archetypes" value={String(dataset.productArchetypes)} />
          <MetricCard
            label="Dataset Size"
            value={dataset.sizeKb == null ? 'n/a' : `${dataset.sizeKb} KB`}
          />
        </div>
        <div className="technical-two-column">
          <div>
            <h3>Scenario Distribution</h3>
            <div className="technical-pill-row">
              {Object.entries(dataset.scenarioCounts).map(([key, count]) => (
                <span className="technical-pill" key={key}>
                  {labelize(key)}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3>Rule Disposition Distribution</h3>
            <div className="technical-pill-row">
              {Object.entries(dataset.dispositionCounts).map(([key, count]) => (
                <span className="technical-pill" key={key}>
                  {labelize(key)}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Model Registry"
        subtitle="Registry metadata controls which model is approved for shadow and ML-assisted participation."
      >
        <div className="technical-model-grid">
          {[riskModel, expansionModel].map((model) => (
            <div className="technical-model-card" key={model?.modelName ?? 'missing'}>
              <div className="technical-model-card-header">
                <h3>{model?.modelName ?? 'Model missing'}</h3>
                <Badge tone={model?.approvedForShadow ? 'success' : 'warn'}>
                  Shadow {model?.approvedForShadow ? 'Approved' : 'Blocked'}
                </Badge>
              </div>
              <div className="small muted">Version: {model?.activeVersion ?? 'n/a'}</div>
              <div className="small muted">Feature schema: {model?.featureSchemaVersion ?? 'n/a'}</div>
              <div className="small muted">Artifact: {model?.modelPath ?? 'n/a'}</div>
              <div className="small muted">Checksum: {shortHash(model?.artifactSha256)}</div>
              <div className="technical-pill-row">
                <Badge tone={model?.approvedForHybrid ? 'success' : 'default'}>
                  ML Assist {model?.approvedForHybrid ? 'Approved' : 'Not Approved'}
                </Badge>
                <Badge tone="info">{model?.owner ?? 'No owner'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Model Selection"
        subtitle="Baseline and challenger models are evaluated on the same local holdout; the active registry model is selected by the stated criterion."
      >
        <div className="technical-two-column">
          <div className="technical-eval-card">
            <div className="technical-model-card-header">
              <div>
                <h3>Renewal Risk</h3>
                <div className="small muted">
                  Criterion: {riskSelection?.criterion ?? 'lowest holdout MAE'}
                </div>
              </div>
              <Badge tone="success">{riskSelection?.selected?.modelName ?? riskModel?.modelName ?? 'Active'}</Badge>
            </div>
            <ModelCandidateRows
              candidates={riskSelection?.candidates}
              selectedModelName={riskSelection?.selected?.modelName}
            />
          </div>
          <div className="technical-eval-card">
            <div className="technical-model-card-header">
              <div>
                <h3>Expansion Propensity</h3>
                <div className="small muted">
                  Criterion: {expansionSelection?.criterion ?? 'highest holdout ROC AUC'}
                </div>
              </div>
              <Badge tone="success">
                {expansionSelection?.selected?.modelName ?? expansionModel?.modelName ?? 'Active'}
              </Badge>
            </div>
            <ModelCandidateRows
              candidates={expansionSelection?.candidates}
              selectedModelName={expansionSelection?.selected?.modelName}
            />
          </div>
        </div>
        <div className="technical-callout">
          <strong>XGBoost challenger:</strong>{' '}
          {xgboostStatus?.available
            ? 'Available and included in model selection.'
            : xgboostStatus?.error
              ? `Unavailable: ${xgboostStatus.error}`
              : 'Pending evaluation.'}
        </div>
      </Section>

      <Section
        title="Evaluation"
        subtitle="Metrics are generated locally from the synthetic historical-like dataset and include rule-baseline comparisons."
      >
        <div className="technical-metric-grid">
          <MetricCard
            label="Training Rows"
            value={String(evaluation.data?.trainingRows ?? 'n/a')}
            detail={evaluation.data?.source}
          />
          <MetricCard label="Holdout Rows" value={String(evaluation.data?.holdoutRows ?? 'n/a')} />
          <MetricCard
            label="Feature Schema"
            value={evaluation.featureSchemaVersion ?? 'n/a'}
          />
          <MetricCard
            label="Generated"
            value={evaluation.generatedAt ? new Date(evaluation.generatedAt).toLocaleString() : 'n/a'}
          />
        </div>
        <div className="technical-two-column">
          <div className="technical-eval-card">
            <h3>Renewal Risk</h3>
            <div className="small muted">{riskEval?.modelType}</div>
            <MetricRows metrics={riskEval?.metrics} />
            <div className="small muted technical-subheading">Rule baseline</div>
            <MetricRows metrics={riskEval?.ruleBaselineMetrics} />
          </div>
          <div className="technical-eval-card">
            <h3>Expansion Propensity</h3>
            <div className="small muted">{expansionEval?.modelType}</div>
            <MetricRows metrics={expansionEval?.metrics} />
            <div className="small muted technical-subheading">Rule baseline</div>
            <MetricRows metrics={expansionEval?.ruleBaselineMetrics} />
          </div>
        </div>
        <div className="technical-callout">
          <strong>Label source:</strong> {evaluation.data?.labelSource ?? 'n/a'}
          <br />
          <strong>Protocol:</strong> {evaluation.data?.evaluationProtocol ?? 'n/a'}
        </div>
      </Section>

      <Section
        title="Serving and Runtime"
        subtitle="The app can call the model through a local subprocess or a persistent local HTTP service."
      >
        <div className="technical-metric-grid">
          <MetricCard label="Current Mode" value={mlModeLabel(mlConfig.mode)} />
          <MetricCard
            label="Serving Path"
            value={mlConfig.serviceUrl ? 'HTTP Service' : 'Subprocess'}
            detail={mlConfig.serviceUrl ?? compactPath(mlConfig.predictionScriptPath)}
          />
          <MetricCard
            label="Model Artifact"
            value={mlConfig.modelExists ? 'Found' : 'Missing'}
            detail={compactPath(mlConfig.modelPath)}
          />
          <MetricCard
            label="Python Runtime"
            value="Local venv"
            detail={compactPath(mlConfig.pythonBin)}
          />
        </div>
      </Section>

      <Section
        title="Shadow and ML-Assisted Behavior"
        subtitle="Shadow mode observes without changing outcomes; ML-Assisted Rules blends ML risk into recommendation scoring while guardrails remain final."
      >
        <div className="technical-mode-grid">
          <div className="technical-mode-card">
            <Badge tone="default">Rules Only</Badge>
            <h3>Deterministic baseline</h3>
            <p>Runs the rule engine only. ML is not called and final output equals rule output.</p>
          </div>
          <div className="technical-mode-card">
            <Badge tone="info">Shadow Mode</Badge>
            <h3>Observe and compare</h3>
            <p>Runs ML and stores scores in Decision Trace, but final recommendation still comes from rules.</p>
          </div>
          <div className="technical-mode-card">
            <Badge tone="success">ML-Assisted Rules</Badge>
            <h3>Controlled influence</h3>
            <p>Blends rule risk and ML risk before rerunning recommendation. Pricing guardrails and approvals remain deterministic.</p>
          </div>
        </div>
      </Section>

      <Section
        title="Latest Decision Evidence"
        subtitle="Most recent persisted DecisionRun across rule output, ML output, final output, and guardrails."
      >
        {latestRun ? (
          <>
            <div className="technical-metric-grid">
              <MetricCard label="Run ID" value={latestRun.id} />
              <MetricCard label="Case" value={latestRun.renewalCaseId} />
              <MetricCard label="Mode" value={mlRunModeLabel(latestRun.mlMode)} />
              <MetricCard
                label="Created"
                value={new Date(latestRun.createdAt).toLocaleString()}
              />
            </div>
            <div className="technical-two-column">
              <div className="technical-eval-card">
                <h3>Rule vs ML vs Final</h3>
                <div className="technical-pill-row">
                  <span className="technical-pill">
                    Rule Risk:{' '}
                    <strong>{formatNumber(Number(latestRule.riskScore), 0)}</strong>
                  </span>
                  <span className="technical-pill">
                    ML Risk: <strong>{formatNumber(Number(latestMl.bundleRiskScore), 0)}</strong>
                  </span>
                  <span className="technical-pill">
                    Final Risk: <strong>{formatNumber(Number(latestFinal.riskScore), 0)}</strong>
                  </span>
                </div>
                <div className="small muted">
                  Model: {latestRun.mlModelName ?? 'n/a'} {latestRun.mlModelVersion ?? ''}
                </div>
              </div>
              <div className="technical-eval-card">
                <h3>Guardrails</h3>
                <div className="technical-pill-row">
                  <span className="technical-pill">
                    Approval Count:{' '}
                    <strong>{formatNumber(Number(latestGuardrails.approvalRequiredCount), 0)}</strong>
                  </span>
                  {Array.isArray(latestGuardrails.guardrailResults)
                    ? latestGuardrails.guardrailResults.map((item) => (
                        <span className="technical-pill" key={String(item)}>
                          {labelize(String(item))}
                        </span>
                      ))
                    : null}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="small muted">No decision run has been logged yet.</div>
        )}
      </Section>

      <Section
        title="Known Boundaries"
        subtitle="This page is intentionally transparent about demo scope versus production claims."
      >
        <div className="technical-callout">
          The model is trained on synthetic historical-like data generated from the app data model.
          It demonstrates standalone ML readiness, evaluation discipline, and traceable inference.
          Production promotion would require historical production labels, drift monitoring,
          challenger evaluation, governance approval, and tenant-aware controls.
        </div>
      </Section>
          </>
        }
      />
    </div>
  )
}
