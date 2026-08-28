import assert from 'node:assert/strict'
import { apply, name } from '../index.js'

let registered
const ctx = {
  tools: {
    register(definition) {
      registered = definition
      return () => {}
    }
  }
}

assert.equal(name, 'ai-shopping-assistant')
apply(ctx)
assert.equal(registered.name, 'shopping_decision_analyze')
assert.equal(registered.parameters.type, 'object')
assert.deepEqual(registered.parameters.required, ['input_json'])

const controller = new AbortController()
const result = await registered.execute({
  input_json: JSON.stringify({
    operation: 'analyze',
    candidates: [
      {
        name: 'A',
        base_price: 1900,
        confirmed_discount: 100,
        conditional_discount: 200,
        eligibility_confirmed: false,
        user_fit: 0.9,
        evidence_confidence: 0.8,
        merchant_trust: 0.9,
        review_confidence: 0.7,
        hard_constraint_failures: [],
        source_quality_flags: [],
        sku_scope_verified: true
      },
      {
        name: 'B',
        base_price: 1500,
        user_fit: 0.95,
        hard_constraint_failures: ['must support feature X']
      }
    ]
  })
}, { signal: controller.signal })

assert.equal(result.ok, true)
const analysis = JSON.parse(result.result_json)
assert.equal(analysis.version, '2.0.1-dsh.2')
assert.equal(analysis.top_candidates.length, 1)
assert.equal(analysis.top_candidates[0].name, 'A')
assert.equal(analysis.top_candidates[0].confirmed_price, 1800)
assert.equal(analysis.top_candidates[0].potential_condition_price, 1600)
assert.equal(analysis.top_candidates[0].conditional_discount_counted_as_confirmed, false)
assert.equal(analysis.rejected_candidates[0].name, 'B')

const cap = await registered.execute({ input_json: '{"operation":"capabilities"}' }, { signal: controller.signal })
assert.equal(cap.ok, true)
assert.match(cap.result_json, /2\.0\.1-dsh\.2/)

const invalid = await registered.execute({ input_json: '{bad json' }, { signal: controller.signal })
assert.equal(invalid.ok, false)

const rendered = registered.output.render({}, result)
assert.equal(rendered[0].type, 'text')
assert.match(rendered[0].text, /Shopping decision analysis completed/)

console.log('PASS: plugin registration, analyze, price, rejection, capabilities, invalid input, render')
