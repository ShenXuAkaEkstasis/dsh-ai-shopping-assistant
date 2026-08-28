# AI Shopping Assistant for DeepSeek Harness

A deterministic shopping-decision plugin for DeepSeek Harness (DSH), adapted from AI Shopping Assistant 2.0.1.

## Overview

The plugin helps an agent turn already-collected shopping evidence into a structured decision: candidate ranking, hard-constraint rejection, confirmed versus conditional price, merchant/review evidence, source-quality risk, and cross-SKU uncertainty.

It registers one tool: `shopping_decision_analyze`.

The plugin itself does not browse commerce sites, log in, place orders, pay, or collect credentials. The calling agent should gather current evidence first and pass structured JSON to the tool.

## Compatibility

- Plugin release: `2.0.1-dsh.2`
- DSH: designed against the current developer-preview bundle/tool contract documented in August 2026.
- Node.js: `^22.19.0 || >=24.0.0`, matching the DSH repository engine requirement.
- Runtime dependencies: none. The plugin uses the `tools` service injected by the DSH host and does not install its own copy of `@deepseek-ai/dsh-tools`.

Because DSH is in developer preview, compatibility-breaking changes are possible. Pin a release or commit when installing.

## Install

From GitHub after this repository is published:

```bash
dsh plugin --profile web add github:<OWNER>/<REPO>#v2.0.1-dsh.2
```

For headless:

```bash
dsh plugin --profile headless add github:<OWNER>/<REPO>#v2.0.1-dsh.2
```

No build step or `prepare` lifecycle script is required.

## Uninstall

```bash
dsh plugin --profile web remove dsh-ai-shopping-assistant
```

Use `headless` instead of `web` if that is the profile where you installed it.

## Quick start

Ask the agent to research products, then use the shopping decision tool. The tool accepts one argument, `input_json`, containing a JSON object.

```json
{
  "operation": "analyze",
  "patch": {
    "budget_changed": false
  },
  "candidates": [
    {
      "name": "Example A",
      "channel": "official store",
      "base_price": 1999,
      "shipping": 0,
      "confirmed_discount": 100,
      "conditional_discount": 200,
      "eligibility_confirmed": false,
      "membership_required": false,
      "user_fit": 0.9,
      "evidence_confidence": 0.85,
      "merchant_trust": 0.95,
      "review_confidence": 0.75,
      "hard_constraint_failures": [],
      "source_quality_flags": [],
      "sku_scope_verified": true
    }
  ]
}
```

## Decision rules

- Ranking means fit to the current user's requirements, not a universal quality ranking.
- Hard-constraint failures are rejected before recommendation ranking.
- Unconfirmed discounts remain conditional rather than confirmed savings.
- Membership fees can be included in the realizable price.
- Link-level sales/reviews are not assumed to represent the current SKU when SKU scope is unclear.
- Source-quality signals can reduce evidence weight, including repeated/template content, concentrated low-activity posting, SEO/GEO/AEO content matrices, unverified merchants, off-platform payment requests, and sensitive-information requests.
- A material change in budget, category, region, or condition returns `full_refresh`, signaling that the agent should re-check product lines rather than merely re-rank old candidates.

## Permissions and data

The plugin performs local deterministic computation only. It makes no network requests and writes no user data to disk.

Do not send passwords, OTP/SMS codes, cookies, bank-card information, payment passwords, or other credentials to this tool.

## Troubleshooting

If the plugin is installed but the tool is not visible:

1. Confirm the plugin is installed in the same profile you are running.
2. Run `dsh plugin --profile <profile> list`.
3. Restart that profile after bundle installation.
4. Confirm the repository root contains `package.json`, `index.js`, and `cordis.patch.yml`.

## Development

This release is intentionally plain ESM JavaScript with no runtime dependencies and no build lifecycle script. A local structural smoke test is included under `test/` in the source repository but is not required at runtime.

## Discovery

For DSH ecosystem discovery, add these GitHub repository topics:

- `dsh-plugin`
- `deepseek-harness`
- `shopping-assistant`

## License and security

See `LICENSE.md` and `SECURITY.md`.
