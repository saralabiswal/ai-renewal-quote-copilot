import {
  approvalBriefInstructions,
  buildApprovalBriefInput,
  buildCaseExecutiveSummaryInput,
  buildCaseRationaleInput,
  buildQuoteInsightInput,
  buildReasoningEvidenceInput,
  caseExecutiveSummaryInstructions,
  caseRationaleInstructions,
  quoteInsightInstructions,
  reasoningInstructions,
} from '@/lib/ai/prompts'
import {
  buildQuoteInsightDispositionPromptInput,
  quoteInsightDispositionJsonInstructions,
} from '@/lib/ai/quote-insight-disposition-prompt'

export type PromptStageId = 'recalculate' | 'insights_ai' | 'full_ai'
export type PromptViewMode = 'business' | 'technical'

export type PromptVariableDefinition = {
  key: string
  label: string
  exampleValue: string | number | boolean | null
  sensitivity: 'public' | 'sensitive'
}

export type PromptHistoryEntry = {
  version: string
  releasedAt: string
  changeSummary: string
  diff: {
    added?: string[]
    modified?: string[]
    removed?: string[]
  }
}

export type PromptGovernanceArtifact = {
  id: string
  stage: PromptStageId
  stageLabel: string
  name: string
  purpose: string
  businessSummary: string
  owner: string
  modelLabel: string
  temperature: string
  visibilityNote: string
  redactionNote: string
  sourcePath: string
  version: string
  lastUpdated: string
  systemPrompt: string
  inputTemplate: string
  variables: PromptVariableDefinition[]
  history: PromptHistoryEntry[]
  fingerprint: string
}

export type PromptVariablePreview = {
  key: string
  label: string
  displayValue: string
  redacted: boolean
}

const STAGE_META: Record<PromptStageId, { label: string; subtitle: string }> = {
  recalculate: {
    label: 'Step 1: Recalculate Recommendation',
    subtitle: 'Deterministic rules refresh risk/action posture. No LLM call is made.',
  },
  insights_ai: {
    label: 'Step 2: Quote Insights, then AI Rationales',
    subtitle:
      'Guarded LLM may finalize quote insight disposition, then separate LLM text explains each accepted insight.',
  },
  full_ai: {
    label: 'Step 3: Full AI Review Guidance',
    subtitle: 'LLM generates executive summary, rationale, and conditional approval brief.',
  },
}

const RECOMMENDATION_ENGINE_PROMPT = [
  'No runtime LLM prompt is used in this stage.',
  'The decision engine runs deterministic policy and scoring logic in:',
  '- lib/rules/recommendation-engine.ts',
  '- lib/rules/renewal-scoring.ts',
  '- lib/rules/pricing-guardrails.ts',
  '',
  'Inputs come from subscription metrics, product metadata, and active pricing policies.',
].join('\n')

const RECOMMENDATION_ENGINE_TEMPLATE = [
  'renewalCaseId={{RENEWAL_CASE_ID}}',
  'scenarioKey={{SCENARIO_KEY}}',
  'metricSnapshot={{USAGE_PERCENT}},{{ACTIVE_USER_PERCENT}},{{LOGIN_TREND_30D}},{{CSAT_SCORE}}',
  'pricingPolicy={{MAX_AUTO_DISCOUNT}},{{APPROVAL_DISCOUNT}},{{FLOOR_PRICE_PERCENT}}',
].join('\n')

const QUOTE_INSIGHT_INPUT_TEMPLATE = buildQuoteInsightInput({
  accountName: '{{ACCOUNT_NAME}}',
  title: '{{QUOTE_INSIGHT_TITLE}}',
  insightType: '{{INSIGHT_TYPE}}',
  productName: '{{PRODUCT_NAME}}',
  insightSummary: '{{INSIGHT_SUMMARY}}',
  recommendedActionSummary: '{{RECOMMENDED_ACTION_SUMMARY}}',
  confidenceScore: 84,
  fitScore: 79,
  reasonCodes: ['{{REASON_CODE_1}}', '{{REASON_CODE_2}}'],
  structuredReasoning: ['{{STRUCTURED_REASON_1}}', '{{STRUCTURED_REASON_2}}'],
  whatChangedSummary: '{{WHAT_CHANGED_SUMMARY}}',
  expectedImpactSummary: '{{EXPECTED_IMPACT_SUMMARY}}',
})

const QUOTE_INSIGHT_DISPOSITION_TEMPLATE = JSON.stringify(
  buildQuoteInsightDispositionPromptInput({
    caseContext: {
      caseId: '{{RENEWAL_CASE_ID}}',
      accountName: '{{ACCOUNT_NAME}}',
      accountIndustry: '{{INDUSTRY}}',
      accountSegment: '{{SEGMENT}}',
      recommendedAction: '{{RECOMMENDED_ACTION}}',
      riskLevel: '{{RISK_LEVEL}}',
      riskScore: 42,
      scenarioKey: '{{SCENARIO_KEY}}',
    },
    candidates: [
      {
        insightKey: '{{INSIGHT_KEY}}',
        productSkuSnapshot: '{{PRODUCT_SKU}}',
        productNameSnapshot: '{{PRODUCT_NAME}}',
        productFamilySnapshot: '{{PRODUCT_FAMILY}}',
        insightType: '{{INSIGHT_TYPE}}',
        title: '{{DETERMINISTIC_CANDIDATE_TITLE}}',
        insightSummary: '{{DETERMINISTIC_CANDIDATE_SUMMARY}}',
        recommendedActionSummary: '{{DETERMINISTIC_ACTION_SUMMARY}}',
        confidenceScore: 84,
        fitScore: 79,
        recommendedQuantity: 10,
        recommendedUnitPrice: 1250,
        recommendedDiscountPercent: 15,
        estimatedArrImpact: 0,
      },
    ],
  }),
  null,
  2,
)

const CASE_EXECUTIVE_SUMMARY_TEMPLATE = buildCaseExecutiveSummaryInput({
  accountName: '{{ACCOUNT_NAME}}',
  segment: '{{SEGMENT}}',
  industry: '{{INDUSTRY}}',
  riskLevel: '{{RISK_LEVEL}}',
  recommendedAction: '{{RECOMMENDED_ACTION}}',
  approvalRequired: true,
  bundleSummaryText: '{{BUNDLE_SUMMARY}}',
  primaryDrivers: ['{{DRIVER_1}}', '{{DRIVER_2}}'],
  itemSummaries: [
    {
      productName: '{{PRODUCT_1}}',
      disposition: '{{DISPOSITION_1}}',
      riskLevel: '{{ITEM_RISK_LEVEL_1}}',
      summary: '{{ITEM_SUMMARY_1}}',
    },
  ],
})

const CASE_RATIONALE_TEMPLATE = buildCaseRationaleInput({
  accountName: '{{ACCOUNT_NAME}}',
  segment: '{{SEGMENT}}',
  industry: '{{INDUSTRY}}',
  riskLevel: '{{RISK_LEVEL}}',
  recommendedAction: '{{RECOMMENDED_ACTION}}',
  approvalRequired: true,
  bundleSummaryText: '{{BUNDLE_SUMMARY}}',
  primaryDrivers: ['{{DRIVER_1}}', '{{DRIVER_2}}', '{{DRIVER_3}}'],
  itemSummaries: [
    {
      productName: '{{PRODUCT_1}}',
      disposition: '{{DISPOSITION_1}}',
      riskLevel: '{{ITEM_RISK_LEVEL_1}}',
      summary: '{{ITEM_SUMMARY_1}}',
    },
    {
      productName: '{{PRODUCT_2}}',
      disposition: '{{DISPOSITION_2}}',
      riskLevel: '{{ITEM_RISK_LEVEL_2}}',
      summary: '{{ITEM_SUMMARY_2}}',
    },
  ],
})

const APPROVAL_BRIEF_TEMPLATE = buildApprovalBriefInput({
  accountName: '{{ACCOUNT_NAME}}',
  caseNumber: '{{CASE_NUMBER}}',
  recommendedAction: '{{RECOMMENDED_ACTION}}',
  riskLevel: '{{RISK_LEVEL}}',
  approvalReason: '{{APPROVAL_REASON}}',
  primaryDrivers: ['{{DRIVER_1}}', '{{DRIVER_2}}'],
  currentArrFormatted: '{{CURRENT_ARR}}',
  proposedArrFormatted: '{{PROPOSED_ARR}}',
})

const REASONING_EVIDENCE_TEMPLATE = buildReasoningEvidenceInput({
  accountName: '{{ACCOUNT_NAME}}',
  caseNumber: '{{CASE_NUMBER}}',
  reasoningType: 'DECISION_TRACE',
  recommendationMode: '{{RECOMMENDATION_MODE}}',
  scenarioKey: '{{SCENARIO_KEY}}',
  recommendedAction: '{{RECOMMENDED_ACTION}}',
  riskLevel: '{{RISK_LEVEL}}',
  approvalRequired: true,
  approvalReason: '{{APPROVAL_REASON}}',
  ruleSummary: ['{{RULE_EVIDENCE_1}}', '{{RULE_EVIDENCE_2}}'],
  mlSummary: ['{{ML_EVIDENCE_1}}', '{{ML_EVIDENCE_2}}'],
  finalSummary: ['{{FINAL_OUTPUT_1}}', '{{FINAL_OUTPUT_2}}'],
  guardrailSummary: ['{{GUARDRAIL_1}}', '{{GUARDRAIL_2}}'],
  quoteInsightSummary: ['{{QUOTE_INSIGHT_1}}', '{{QUOTE_INSIGHT_2}}'],
  quoteDeltaSummary: ['{{QUOTE_DELTA_1}}', '{{QUOTE_DELTA_2}}'],
  changeSummary: ['{{CHANGE_1}}', '{{CHANGE_2}}'],
  evidenceReferences: ['{{REFERENCE_1}}', '{{REFERENCE_2}}'],
})

function stableHash(value: string) {
  let hash = 2166136261
  for (let idx = 0; idx < value.length; idx += 1) {
    hash ^= value.charCodeAt(idx)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

function buildFingerprint(systemPrompt: string, inputTemplate: string) {
  return `FP-${stableHash(`${systemPrompt}\n---\n${inputTemplate}`)}`
}

const BASE_CATALOG: Omit<PromptGovernanceArtifact, 'fingerprint'>[] = [
  {
    id: 'recommendation-engine-rules',
    stage: 'recalculate',
    stageLabel: STAGE_META.recalculate.label,
    name: 'Recommendation Engine Ruleset',
    purpose: 'Recomputes risk scores, dispositions, guardrails, and approval posture.',
    businessSummary:
      'This stage is policy-deterministic. It does not call an LLM and instead applies scoring and guardrail rules to subscription signals.',
    owner: 'Revenue Strategy Engineering',
    modelLabel: 'N/A (deterministic)',
    temperature: '0',
    visibilityNote: 'Visible to all policy readers. No customer-identifying raw payload is displayed.',
    redactionNote: 'IDs and account references are masked in preview by default.',
    sourcePath: 'lib/rules/recommendation-engine.ts',
    version: 'v2.3',
    lastUpdated: '2026-04-21',
    systemPrompt: RECOMMENDATION_ENGINE_PROMPT,
    inputTemplate: RECOMMENDATION_ENGINE_TEMPLATE,
    variables: [
      { key: 'renewal_case_id', label: 'Renewal Case ID', exampleValue: 'rcase_aster_commerce', sensitivity: 'sensitive' },
      { key: 'scenario_key', label: 'Scenario Key', exampleValue: 'RETENTION_OFFER', sensitivity: 'public' },
      { key: 'usage_percent', label: 'Usage %', exampleValue: 72, sensitivity: 'public' },
      { key: 'active_user_percent', label: 'Active User %', exampleValue: 63, sensitivity: 'public' },
      { key: 'login_trend_30d', label: 'Login Trend 30d', exampleValue: -8, sensitivity: 'public' },
    ],
    history: [
      {
        version: 'v2.3',
        releasedAt: '2026-04-21',
        changeSummary: 'Added explicit scenario-key handling and stale-insight invalidation after recalc.',
        diff: {
          modified: ['Scenario input envelope now includes selected demo scenario.', 'Stale insight marker now set when recommendation changes.'],
        },
      },
      {
        version: 'v2.2',
        releasedAt: '2026-04-18',
        changeSummary: 'Refined guardrail precedence notes for floor-price exceptions.',
        diff: {
          modified: ['Guardrail ordering docs aligned with runtime behavior.'],
        },
      },
    ],
  },
  {
    id: 'quote-insight-disposition',
    stage: 'insights_ai',
    stageLabel: STAGE_META.insights_ai.label,
    name: 'Generate Quote Insights Prompt',
    purpose:
      'Asks the LLM to produce final Quote Insight dispositions from deterministic safe candidates.',
    businessSummary:
      'The LLM can explain and confirm quote insight disposition only inside the deterministic candidate envelope. Product, pricing, discount, quantity, ARR impact, and policy citations are validated before anything is accepted.',
    owner: 'AI Workflow Team',
    modelLabel: 'Runtime JSON generation model',
    temperature: '0',
    visibilityNote:
      'Shown for governance traceability. The validator remains final for math, catalog, and policy boundaries.',
    redactionNote: 'Account and case identifiers are masked in variable previews.',
    sourcePath: 'lib/ai/quote-insight-disposition-prompt.ts',
    version: 'quote-insight-disposition-rag-v1',
    lastUpdated: '2026-05-06',
    systemPrompt: quoteInsightDispositionJsonInstructions(),
    inputTemplate: QUOTE_INSIGHT_DISPOSITION_TEMPLATE,
    variables: [
      { key: 'renewal_case_id', label: 'Renewal Case ID', exampleValue: 'rcase_aster_commerce', sensitivity: 'sensitive' },
      { key: 'account_name', label: 'Account Name', exampleValue: 'Aster Commerce', sensitivity: 'sensitive' },
      { key: 'scenario_key', label: 'Scenario Key', exampleValue: 'MARGIN_RECOVERY', sensitivity: 'public' },
      { key: 'recommended_action', label: 'Recommended Action', exampleValue: 'RENEW_AS_IS', sensitivity: 'public' },
      { key: 'product_sku', label: 'Product SKU', exampleValue: 'PLATFORM-SUBSCRIPTION', sensitivity: 'public' },
      { key: 'insight_type', label: 'Insight Type', exampleValue: 'MARGIN_RECOVERY', sensitivity: 'public' },
    ],
    history: [
      {
        version: 'quote-insight-disposition-rag-v1',
        releasedAt: '2026-05-06',
        changeSummary:
          'Added guarded JSON prompt for Quote Insight disposition using deterministic candidate envelopes.',
        diff: {
          added: [
            'Strict JSON output contract.',
            'Hard rule that LLM cannot invent products, pricing, discounts, quantities, ARR impact, or citations.',
            'Policy context chunk for safe commercial envelope behavior.',
          ],
        },
      },
    ],
  },
  {
    id: 'quote-insight-rationale',
    stage: 'insights_ai',
    stageLabel: STAGE_META.insights_ai.label,
    name: 'AI Rationale Prompt',
    purpose: 'Explains each quote insight in reviewer-friendly language.',
    businessSummary:
      'Transforms structured signal evidence into a clear Decision / Why / Commercial Impact / What Changed narrative for each quote insight.',
    owner: 'AI Workflow Team',
    modelLabel: 'Runtime text generation model',
    temperature: 'default',
    visibilityNote: 'Raw prompt text is shown for internal demo and policy-authorized users.',
    redactionNote: 'Sensitive variables are masked in variable previews and contextual drawers.',
    sourcePath: 'lib/ai/prompts.ts#quoteInsightInstructions',
    version: 'v3.2',
    lastUpdated: '2026-04-29',
    systemPrompt: quoteInsightInstructions(),
    inputTemplate: QUOTE_INSIGHT_INPUT_TEMPLATE,
    variables: [
      { key: 'account_name', label: 'Account Name', exampleValue: 'Aster Commerce', sensitivity: 'sensitive' },
      { key: 'quote_insight_title', label: 'Insight Title', exampleValue: 'Retention Offer for Fusion Apps', sensitivity: 'public' },
      { key: 'insight_type', label: 'Insight Type', exampleValue: 'CONCESSION', sensitivity: 'public' },
      { key: 'product_name', label: 'Product Name', exampleValue: 'Oracle Fusion Applications', sensitivity: 'public' },
      { key: 'confidence_score', label: 'Confidence Score', exampleValue: 84, sensitivity: 'public' },
      { key: 'fit_score', label: 'Fit Score', exampleValue: 79, sensitivity: 'public' },
    ],
    history: [
      {
        version: 'v3.2',
        releasedAt: '2026-04-29',
        changeSummary: 'Cleaned output contract for local and hosted model consistency.',
        diff: {
          modified: [
            'System prompt now requires plain text only with no Markdown decoration.',
            'Heading contract now calls for exact plain-text heading lines.',
          ],
        },
      },
      {
        version: 'v3.1',
        releasedAt: '2026-04-21',
        changeSummary: 'Strengthened business-objective language and explicit section heading contract.',
        diff: {
          modified: [
            'System instruction now emphasizes subscription signals to business objective mapping.',
            'Output contract enforces Decision/Why/Commercial Impact/What Changed headings.',
          ],
        },
      },
      {
        version: 'v3.0',
        releasedAt: '2026-04-20',
        changeSummary: 'Added change-context and expected-impact fields for reviewer traceability.',
        diff: {
          added: ['What changed context input field.', 'Expected impact summary input field.'],
        },
      },
    ],
  },
  {
    id: 'case-executive-summary',
    stage: 'full_ai',
    stageLabel: STAGE_META.full_ai.label,
    name: 'Case Executive Summary Prompt',
    purpose: 'Generates concise summary text for quote reviewers.',
    businessSummary:
      'Creates a short executive snapshot of current renewal posture, risk, and reviewer takeaway.',
    owner: 'AI Workflow Team',
    modelLabel: 'Runtime text generation model',
    temperature: 'default',
    visibilityNote: 'Internal governance view only. Includes policy-sensitive summary framing.',
    redactionNote: 'Case/account identifiers are masked in non-admin previews.',
    sourcePath: 'lib/ai/prompts.ts#caseExecutiveSummaryInstructions',
    version: 'v2.3',
    lastUpdated: '2026-04-29',
    systemPrompt: caseExecutiveSummaryInstructions(),
    inputTemplate: CASE_EXECUTIVE_SUMMARY_TEMPLATE,
    variables: [
      { key: 'account_name', label: 'Account Name', exampleValue: 'Aster Commerce', sensitivity: 'sensitive' },
      { key: 'segment', label: 'Account Segment', exampleValue: 'ENTERPRISE', sensitivity: 'public' },
      { key: 'risk_level', label: 'Risk Level', exampleValue: 'MEDIUM', sensitivity: 'public' },
      { key: 'recommended_action', label: 'Recommended Action', exampleValue: 'RENEW_WITH_CONCESSION', sensitivity: 'public' },
      { key: 'approval_required', label: 'Approval Required', exampleValue: true, sensitivity: 'public' },
    ],
    history: [
      {
        version: 'v2.3',
        releasedAt: '2026-04-29',
        changeSummary: 'Cleaned formatting instructions to reduce Markdown artifacts in generated summaries.',
        diff: {
          modified: [
            'System prompt now requires plain text only.',
            'Input contract now asks for one summary paragraph followed by two plain hyphen bullets.',
          ],
        },
      },
      {
        version: 'v2.2',
        releasedAt: '2026-04-21',
        changeSummary: 'Updated reviewer-takeaway instructions to improve consistency in demos.',
        diff: {
          modified: ['Executive summary structure clarified to 3-5 sentence pattern plus two bullet drivers.'],
        },
      },
      {
        version: 'v2.1',
        releasedAt: '2026-04-19',
        changeSummary: 'Added explicit policy and risk grounding instruction.',
        diff: {
          modified: ['System prompt now explicitly blocks unsupported claims.'],
        },
      },
    ],
  },
  {
    id: 'case-rationale',
    stage: 'full_ai',
    stageLabel: STAGE_META.full_ai.label,
    name: 'Case Rationale Prompt',
    purpose: 'Produces deeper rationale for reviewer and approver context.',
    businessSummary:
      'Builds a structured explanation of why the recommendation is commercially defensible based on bundle and line evidence.',
    owner: 'AI Workflow Team',
    modelLabel: 'Runtime text generation model',
    temperature: 'default',
    visibilityNote: 'Internal governance view only. Intended for reviewer workflow transparency.',
    redactionNote: 'Case/account identifiers are masked in non-admin previews.',
    sourcePath: 'lib/ai/prompts.ts#caseRationaleInstructions',
    version: 'v2.5',
    lastUpdated: '2026-04-29',
    systemPrompt: caseRationaleInstructions(),
    inputTemplate: CASE_RATIONALE_TEMPLATE,
    variables: [
      { key: 'account_name', label: 'Account Name', exampleValue: 'Aster Commerce', sensitivity: 'sensitive' },
      { key: 'bundle_summary', label: 'Bundle Summary', exampleValue: 'Usage softening across 2 products; concession recommended.', sensitivity: 'public' },
      { key: 'driver_1', label: 'Primary Driver', exampleValue: 'Declining login trend and rising ticket volume.', sensitivity: 'public' },
      { key: 'item_summary_1', label: 'Item Summary', exampleValue: 'Fusion Apps requires targeted concession to retain seats.', sensitivity: 'public' },
    ],
    history: [
      {
        version: 'v2.5',
        releasedAt: '2026-04-29',
        changeSummary: 'Cleaned rationale output rules for consistent plain-text reviewer copy.',
        diff: {
          modified: [
            'System prompt now blocks Markdown decoration.',
            'Input contract now asks for two paragraphs followed by three plain hyphen bullets with no headings.',
          ],
        },
      },
      {
        version: 'v2.4',
        releasedAt: '2026-04-21',
        changeSummary: 'Aligned rationale language with enterprise reviewer tone and policy references.',
        diff: {
          modified: ['Prompt now emphasizes guardrails and defensibility wording.'],
        },
      },
      {
        version: 'v2.3',
        releasedAt: '2026-04-19',
        changeSummary: 'Improved item-summary formatting for multi-line portfolios.',
        diff: {
          modified: ['Item summary section now enumerates product context with disposition and risk.'],
        },
      },
    ],
  },
  {
    id: 'approval-brief',
    stage: 'full_ai',
    stageLabel: STAGE_META.full_ai.label,
    name: 'Approval Brief Prompt',
    purpose: 'Creates approval packet text when a recommendation requires approval.',
    businessSummary:
      'Summarizes situation, why approval is needed, and suggested reviewer posture for approval-required cases.',
    owner: 'AI Workflow Team',
    modelLabel: 'Runtime text generation model',
    temperature: 'default',
    visibilityNote: 'Visible to approval workflow roles. Guardrails and ARR posture are emphasized.',
    redactionNote: 'Case number and account references are partially masked by default.',
    sourcePath: 'lib/ai/prompts.ts#approvalBriefInstructions',
    version: 'v2.0',
    lastUpdated: '2026-04-29',
    systemPrompt: approvalBriefInstructions(),
    inputTemplate: APPROVAL_BRIEF_TEMPLATE,
    variables: [
      { key: 'account_name', label: 'Account Name', exampleValue: 'Aster Commerce', sensitivity: 'sensitive' },
      { key: 'case_number', label: 'Case Number', exampleValue: 'RC-ACCT-1016', sensitivity: 'sensitive' },
      { key: 'risk_level', label: 'Risk Level', exampleValue: 'HIGH', sensitivity: 'public' },
      { key: 'current_arr', label: 'Current ARR', exampleValue: '$1,240,000', sensitivity: 'public' },
      { key: 'proposed_arr', label: 'Proposed ARR', exampleValue: '$1,198,000', sensitivity: 'public' },
    ],
    history: [
      {
        version: 'v2.0',
        releasedAt: '2026-04-29',
        changeSummary: 'Cleaned approval brief prompt for plain-text headings and concise reviewer posture.',
        diff: {
          modified: [
            'System prompt now requires plain text only.',
            'Input contract now specifies exact heading lines and sentence count under each heading.',
          ],
        },
      },
      {
        version: 'v1.9',
        releasedAt: '2026-04-21',
        changeSummary: 'Clarified approval posture guidance and heading format requirements.',
        diff: {
          modified: ['Output headings standardized for Situation / Why Approval Is Needed / Recommended Reviewer Posture.'],
        },
      },
      {
        version: 'v1.8',
        releasedAt: '2026-04-20',
        changeSummary: 'Added ARR movement context to approval recommendation.',
        diff: {
          added: ['Current ARR and proposed ARR formatted variables.'],
        },
      },
    ],
  },
  {
    id: 'reasoning-evidence',
    stage: 'full_ai',
    stageLabel: STAGE_META.full_ai.label,
    name: 'Reasoning Evidence Prompt',
    purpose: 'Explains the decision trace using rule, ML, quote, guardrail, and change evidence.',
    businessSummary:
      'Produces an auditable reviewer explanation that separates deterministic evidence, model evidence, guardrails, and the final human-review action.',
    owner: 'AI Workflow Team',
    modelLabel: 'Runtime text generation model',
    temperature: 'default',
    visibilityNote: 'Internal governance view only. Intended to show how AI text summarizes decision evidence without making the decision.',
    redactionNote: 'Case/account identifiers and evidence references are masked in non-admin previews.',
    sourcePath: 'lib/ai/prompts.ts#reasoningInstructions',
    version: 'v1.0',
    lastUpdated: '2026-04-29',
    systemPrompt: reasoningInstructions(),
    inputTemplate: REASONING_EVIDENCE_TEMPLATE,
    variables: [
      { key: 'account_name', label: 'Account Name', exampleValue: 'Aster Commerce', sensitivity: 'sensitive' },
      { key: 'case_number', label: 'Case Number', exampleValue: 'RC-ACCT-1016', sensitivity: 'sensitive' },
      { key: 'scenario_key', label: 'Scenario Key', exampleValue: 'RETENTION_OFFER', sensitivity: 'public' },
      { key: 'recommended_action', label: 'Recommended Action', exampleValue: 'RENEW_WITH_CONCESSION', sensitivity: 'public' },
      { key: 'rule_evidence_1', label: 'Rule Evidence', exampleValue: 'Usage trend breached retention threshold.', sensitivity: 'public' },
      { key: 'ml_evidence_1', label: 'ML Evidence', exampleValue: 'Churn propensity moved above medium-risk band.', sensitivity: 'public' },
    ],
    history: [
      {
        version: 'v1.0',
        releasedAt: '2026-04-29',
        changeSummary: 'Added reasoning evidence prompt to governance catalog and standardized clean plain-text output.',
        diff: {
          added: ['Governance artifact for the runtime reasoning-evidence prompt.'],
          modified: [
            'System prompt now requires plain text only.',
            'Output contract clarifies that the AI text generator is not the final decision maker.',
          ],
        },
      },
    ],
  },
]

export const promptGovernanceSources = Object.freeze([
  'lib/ai/prompts.ts',
  'lib/ai/quote-insight-disposition-prompt.ts',
  'lib/db/generate-ai-content.ts',
  'lib/rules/recommendation-engine.ts',
] as const)

const PROMPT_GOVERNANCE_CATALOG: PromptGovernanceArtifact[] = BASE_CATALOG.map((artifact) => ({
  ...artifact,
  fingerprint: buildFingerprint(artifact.systemPrompt, artifact.inputTemplate),
}))

function toPreviewLabel(rawKey: string) {
  return rawKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizePreviewValue(value: unknown) {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function maskSensitiveValue(value: string) {
  if (value.length <= 3) return '***'
  if (value.length <= 6) return `${value.slice(0, 1)}***${value.slice(-1)}`
  return `${value.slice(0, 2)}***${value.slice(-2)}`
}

function shouldMask(key: string, value: string) {
  const sensitiveKey = /(account|case|subscription|id|email|phone|name|number)/i.test(key)
  if (sensitiveKey) return true
  return value.length > 14 && /[A-Za-z]/.test(value) && /[0-9]/.test(value)
}

export function redactPromptValue(key: string, value: unknown): PromptVariablePreview {
  const normalized = normalizePreviewValue(value)
  const redacted = shouldMask(key, normalized)
  return {
    key,
    label: toPreviewLabel(key),
    displayValue: redacted ? maskSensitiveValue(normalized) : normalized,
    redacted,
  }
}

export function buildRedactedVariablePreview(
  context: Record<string, unknown>,
): PromptVariablePreview[] {
  return Object.entries(context).map(([key, value]) => redactPromptValue(key, value))
}

export function buildArtifactVariablePreview(
  artifact: PromptGovernanceArtifact,
): PromptVariablePreview[] {
  const context: Record<string, unknown> = {}
  for (const variable of artifact.variables) {
    context[variable.key] = variable.exampleValue
  }
  return buildRedactedVariablePreview(context)
}

export function getPromptStageMeta(stage: PromptStageId) {
  return STAGE_META[stage]
}

export function getPromptGovernanceCatalog() {
  return PROMPT_GOVERNANCE_CATALOG
}

export function getPromptArtifactsForStage(stage: PromptStageId) {
  return PROMPT_GOVERNANCE_CATALOG.filter((artifact) => artifact.stage === stage)
}

export function summarizePromptHistoryDiff(entry: PromptHistoryEntry) {
  const chunks: string[] = []
  if (entry.diff.added && entry.diff.added.length > 0) {
    chunks.push(`+${entry.diff.added.length} additions`)
  }
  if (entry.diff.modified && entry.diff.modified.length > 0) {
    chunks.push(`~${entry.diff.modified.length} modifications`)
  }
  if (entry.diff.removed && entry.diff.removed.length > 0) {
    chunks.push(`-${entry.diff.removed.length} removals`)
  }
  return chunks.length > 0 ? chunks.join(' • ') : 'No structural diff metadata'
}
