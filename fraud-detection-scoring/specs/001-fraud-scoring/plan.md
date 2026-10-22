# Implementation Plan: Fraud Detection Scoring Engine

**Branch**: `main` (actual checkout; setup returned feature identifier `001-fraud-scoring`)
**Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-fraud-scoring/spec.md`; user requests Node.js,
Express, and challenge-aligned sample data for development and testing.

## Summary

Build a local Express 5 application on Node.js 24 with shared generation, rule detection, scoring,
and evaluation services. Expose JSON HTTP endpoints and Node CLI commands using the same services.
Generate and deliver a fixed-seed 2,000-claim sample with separate labels and injection manifest.
Implement all eight rules with evidence, deterministic weighted ranking, and reproducible metrics.
The source file is `AI_Challenge_10.md`; the user's plural filename does not exist.

## Technical Context

**Language/Version**: JavaScript ESM, Node.js 24 LTS; local runtime v24.19.0.

**Primary Dependencies**: Express 5 and Zod 4; ESLint and Prettier as development dependencies.
Pin resolved versions through package-lock.json during implementation.

**Storage**: Versioned JSON configuration; in-memory batches; local JSON sample and result artifacts.

**Testing**: node:test, node:assert/strict and native fetch; at least 15 unit cases plus HTTP,
generator, reproducibility, metrics and performance acceptance checks.

**Target Platform**: Windows PowerShell and Linux/macOS with Node 24; loopback HTTP service.

**Project Type**: Single Node.js service with reusable domain services and CLI adapters.

**Performance Goals**: Validation through ranking for 2,000 claims in under 30 seconds;
recall >=70% and FPR <=20% on delivered labels at the reported threshold.

**Constraints**: No comments or explanatory docstrings in application code/tests. No labels in
scoring. Strict validation; finite arithmetic; deterministic seed, evidence and ranking. No UI,
database, production clinical integration or authentication in this local demonstration.

**Scale/Scope**: One analyst, 2,000 claims per request, 10 MiB JSON body limit, 500 synthetic
members and 50 providers. HTTP returns artifacts; CLI saves them without arbitrary HTTP paths.

## Constitution Check

*Pre-research review: PASS. Post-design review: PASS. These are design compliance checks;
implementation quality and metric targets remain to be verified by tests.*

| Principle | Design enforcement | Gate |
| --- | --- | --- |
| Clean Design | Separate generator, rules, scorer, evaluator and transport | PASS |
| Self-Explanatory Code | Descriptive names; AST comment check; rationale in Markdown | PASS |
| Robust Boundaries | Shared strict schemas, cross-record validation, explicit diagnostics | PASS |
| Verified Correctness | >=15 unit tests, boundary cases, integration and regression checks | PASS |
| Reproducible Scoring | Seeded generator, canonical order, stable ties, label isolation | PASS |
| Quality Constraints | Eight rules, mappings, metrics and full-batch timing acceptance | PASS |
| Development Workflow | Commands, contracts, configuration rationale and acceptance evidence | PASS |

No constitution amendments or exceptions are required. The constitution's temporary Sync Impact
Report must be removed before its eventual commit; this planning workflow does not change it.

## Project Structure

### Documentation (this feature)

```text
specs/001-fraud-scoring/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  checklists/requirements.md
  contracts/interfaces.md
```

### Source Code (repository root)

```text
package.json
package-lock.json
eslint.config.js
.prettierrc.json
README.md
config/
  weights.json
  bundles.json
  diagnosis-procedures.json
  surgical-procedures.json
src/
  app.js
  server.js
  api/routes.js
  api/errors.js
  validation/
  domain/rules/
  domain/indexes.js
  domain/score.js
  generation/
  evaluation/
  artifacts/
  cli/
data/sample/
  claims.json
  labels.json
  manifest.json
output/
  scored.json
  metrics.json
tests/
  unit/
  contract/
  integration/
  acceptance/
  fixtures/
```

**Structure Decision**: One package shares pure domain services between HTTP and CLI; configuration
and labels stay outside scoring code. app.js creates the Express app without opening a port;
server.js owns listening and shutdown. Commit default sample and submission outputs during
implementation; keep temporary artifacts outside those canonical paths. The tree is planned,
not a statement that application files already exist.

## Complexity Tracking

No constitution violations. A database, frontend, job queue and separate service deployments are
unnecessary at this scale.

## Phase 0: Research

Completed [research.md](research.md): runtime, Express boundaries, tests, storage, seed strategy,
cohort behavior and evaluation decisions. No unresolved technical clarifications.

## Phase 1: Design and Contracts

Completed [data-model.md](data-model.md), [contracts/interfaces.md](contracts/interfaces.md), and
[quickstart.md](quickstart.md). The plan includes the full challenge dataset and explicit boundary
fixtures; artifact generation belongs to implementation. Constitution gates were rechecked against
the completed design and pass. No application code or sample artifacts are created by this phase.

## Delivery Sequence and Estimate

Planning estimate for one developer assisted by AI: 6-8 focused hours, subject to acceptance results.
Allow roughly 1 hour for scaffolding/schemas/catalogs, 2 hours for indexed rules and scoring,
1-2 hours for generator and final pattern verification, 1 hour for API/CLI and artifacts, and
1-2 hours for integration, measured evaluation, fixes and documentation. The challenge suggests
4-6 hours; additional allowance covers both HTTP and CLI delivery and rigorous dataset verification.

Next phase is `$speckit-tasks`; this command does not create tasks.md or implement features.
