export const name = 'ai-shopping-assistant'
export const inject = ['tools']

const VERSION = '2.0.1-dsh.2'

const clamp = (value, fallback = 0.5) => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(1, n))
}

const finiteMoney = (value) => {
  if (value === undefined || value === null) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('money values must be finite numbers')
  }
  if (Math.abs(value) > 100_000_000) throw new Error('money value out of allowed range')
  return value
}

const asStringArray = (value, limit = 100) =>
  Array.isArray(value)
    ? value.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean).slice(0, limit)
    : []

const sourceQualityPenalty = (flags) => {
  const normalized = new Set(flags.map((v) => v.toLowerCase()))
  let penalty = 0
  const weights = {
    seo_matrix: 0.08,
    geo_matrix: 0.08,
    aeo_matrix: 0.08,
    repeated_content: 0.10,
    low_activity_burst: 0.10,
    marketing_only: 0.08,
    sku_scope_uncertain: 0.12,
    off_platform_payment: 0.35,
    sensitive_info_request: 0.35,
    unverified_merchant: 0.16
  }
  for (const flag of normalized) penalty += weights[flag] ?? 0.04
  return Math.min(0.65, penalty)
}

const calculatePrice = (candidate) => {
  const base = finiteMoney(candidate.base_price)
  const shipping = finiteMoney(candidate.shipping)
  const confirmedDiscount = finiteMoney(candidate.confirmed_discount)
  const conditionalDiscount = finiteMoney(candidate.conditional_discount)
  const membershipFee = candidate.membership_required === true ? finiteMoney(candidate.membership_fee) : 0

  const confirmed = Math.max(0, base + shipping + membershipFee - confirmedDiscount)
  const potential = conditionalDiscount > 0 ? Math.max(0, confirmed - conditionalDiscount) : null

  return {
    confirmed_price: Number(confirmed.toFixed(2)),
    potential_condition_price: potential === null ? null : Number(potential.toFixed(2)),
    conditional_discount_counted_as_confirmed: candidate.eligibility_confirmed === true
  }
}

const analyzeCandidate = (raw, index) => {
  const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const failures = asStringArray(candidate.hard_constraint_failures)
  const flags = asStringArray(candidate.source_quality_flags)
  if (candidate.sku_scope_verified === false && !flags.includes('sku_scope_uncertain')) {
    flags.push('sku_scope_uncertain')
  }

  const price = calculatePrice(candidate)
  const penalty = sourceQualityPenalty(flags)
  const hardFail = failures.length > 0

  const fit = clamp(candidate.user_fit)
  const evidence = clamp(candidate.evidence_confidence)
  const merchant = clamp(candidate.merchant_trust)
  const review = clamp(candidate.review_confidence)

  let score = fit * 0.46 + evidence * 0.22 + merchant * 0.18 + review * 0.14 - penalty
  if (hardFail) score -= 1
  score = Math.max(-1, Math.min(1, score))

  const evidenceStatus = hardFail
    ? 'hard_constraint_failed'
    : penalty >= 0.35
      ? 'high_source_risk'
      : evidence < 0.45
        ? 'insufficient_evidence'
        : 'usable'

  return {
    input_order: index + 1,
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : `Candidate ${index + 1}`,
    channel: typeof candidate.channel === 'string' ? candidate.channel : '',
    score: Number(score.toFixed(4)),
    hard_constraint_failures: failures,
    source_quality_flags: flags,
    evidence_status: evidenceStatus,
    confirmed_price: price.confirmed_price,
    potential_condition_price: price.potential_condition_price,
    conditional_discount_counted_as_confirmed: price.conditional_discount_counted_as_confirmed,
    notes: asStringArray(candidate.notes)
  }
}

const analyze = (payload) => {
  const candidatesRaw = Array.isArray(payload.candidates) ? payload.candidates.slice(0, 50) : []
  const analyzed = candidatesRaw.map(analyzeCandidate)
  const eligible = analyzed
    .filter((candidate) => candidate.hard_constraint_failures.length === 0)
    .sort((a, b) => b.score - a.score)

  const patch = payload.patch && typeof payload.patch === 'object' && !Array.isArray(payload.patch) ? payload.patch : {}
  const materialChange = Boolean(
    patch.budget_changed || patch.category_changed || patch.region_changed || patch.condition_changed
  )

  return {
    version: VERSION,
    search_action: materialChange ? 'full_refresh' : candidatesRaw.length === 0 ? 'research_needed' : 'rerank_or_continue',
    ranking_meaning: 'user_requirement_match_not_objective_quality',
    candidate_count: analyzed.length,
    top_candidates: eligible.slice(0, 5),
    rejected_candidates: analyzed.filter((candidate) => candidate.hard_constraint_failures.length > 0),
    safeguards: {
      do_not_submit_order_or_payment: true,
      do_not_request_password_otp_cookie_or_payment_credentials: true,
      unconfirmed_eligibility_not_confirmed_price: true,
      cross_sku_or_historical_sales_require_separate_verification: true,
      off_platform_payment_is_high_risk: true
    }
  }
}

const capabilities = () => ({
  version: VERSION,
  operations: ['capabilities', 'analyze'],
  features: [
    'candidate ranking by user fit and evidence',
    'confirmed versus conditional price separation',
    'membership-fee-aware price calculation',
    'hard-constraint rejection',
    'merchant and review evidence weighting',
    'source-quality risk penalties',
    'cross-SKU uncertainty handling',
    'full-refresh signal after material condition changes'
  ],
  boundaries: [
    'does not browse the web itself',
    'does not log in, place orders or pay',
    'does not collect passwords, OTPs, cookies or payment credentials'
  ]
})

const parseInput = (args) => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('arguments must be an object')
  if (typeof args.input_json !== 'string') throw new Error('input_json must be a string')
  if (args.input_json.length > 250_000) throw new Error('input_json exceeds 250000 characters')
  let parsed
  try {
    parsed = JSON.parse(args.input_json)
  } catch {
    throw new Error('input_json must contain valid JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('input_json root must be an object')
  return parsed
}

const toolDefinition = {
  name: 'shopping_decision_analyze',
  description:
    'Analyze structured shopping research after product, price, merchant, review and source evidence has been gathered. Use it for candidate ranking, realizable-price calculation, hard constraints and source-quality risk.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      input_json: {
        type: 'string',
        description: 'JSON object with operation="capabilities" or operation="analyze". Analyze may include candidates[] and patch metadata.'
      }
    },
    required: ['input_json']
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean' },
        operation: { type: 'string' },
        result_json: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['ok', 'operation', 'result_json', 'message']
    },
    render: (_args, value) => [{
      type: 'text',
      text: value.ok ? `${value.message}\n${value.result_json}` : `AI Shopping Assistant error: ${value.message}`
    }]
  },
  async execute(args, exec) {
    if (exec?.signal?.aborted) throw exec.signal.reason ?? new Error('tool call aborted')
    try {
      const parsed = parseInput(args)
      const operation = typeof parsed.operation === 'string' ? parsed.operation : 'analyze'
      const result = operation === 'capabilities'
        ? capabilities()
        : operation === 'analyze'
          ? analyze(parsed)
          : (() => { throw new Error(`unsupported operation: ${operation}`) })()

      return {
        ok: true,
        operation,
        result_json: JSON.stringify(result, null, 2),
        message: operation === 'capabilities' ? 'AI Shopping Assistant capabilities' : 'Shopping decision analysis completed'
      }
    } catch (error) {
      return {
        ok: false,
        operation: 'error',
        result_json: '{}',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

export function apply(ctx) {
  ctx.tools.register(toolDefinition)
}
