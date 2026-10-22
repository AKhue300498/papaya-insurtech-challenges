# Tasks: Fraud Detection Scoring Engine

**Input**: Design documents in `specs/001-fraud-scoring/`.
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/interfaces.md, quickstart.md.
**Tests**: Required by the challenge and constitution: at least 15 unit tests plus contract,
integration, reproducibility, generator and acceptance tests. Write story tests first, observe
meaningful failures, then implement and make them pass. Do not add comments or explanatory
 docstrings in application code or tests; put explanations in Markdown.
**Organization**: Setup, shared foundations, prioritized user stories, then delivery validation.
All paths are relative to this project directory, not the parent Git repository root.

## Format: `[ID] [P?] [Story] Description`

`[P]` marks work in separate files that can run concurrently after the prerequisites stated below.
`[US1]`, `[US2]`, and `[US3]` map to the numbered user stories in spec.md. Unchecked tasks represent
unbuilt work; this document does not claim implementation or test completion.

## Path Conventions

Single Node.js ESM package with `src/`, `config/`, `tests/`, `data/sample/`, and `output/`.
Test files use `*.test.js`; each service is shared by HTTP and CLI adapters.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the Node 24 / Express 5 project and repeatable quality commands.

- [X] T001 Initialize `package.json` and `package-lock.json` for Node.js 24 ESM with Express 5, Zod 4, ESLint and Prettier; declare every script in contracts/interfaces.md, using node:test and explicit test discovery across unit, contract, integration and acceptance directories.
- [X] T002 [P] Configure `eslint.config.js`, `scripts/no-comments.js`, `.prettierrc.json` and `.prettierignore` for language-standard formatting, unused-code checks and AST-based rejection of comments/JSDoc in application code and tests; exclude generated artifacts and Spec Kit scaffolding from formatting mutations.
- [X] T003 [P] Configure `.gitignore` to exclude node_modules, temporary outputs and local environment files while retaining canonical `data/sample/` and submission `output/` artifacts.
- [X] T004 [P] Create `README.md` with Node prerequisites, planned npm scripts, local scope, challenge source filename, no-comment rule and the 6-8-hour planning estimate, clearly distinguishing required targets from measured results.
- [X] T005 Verify the setup scripts in `package.json` execute cross-platform with `npm.cmd` on PowerShell; establish `tests/helpers/http.js` for ephemeral loopback servers and `tests/helpers/process.js` for CLI execution without shell-specific commands.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts and infrastructure. Complete this phase before story implementation.

- [X] T006 Create `src/validation/claims.js` with strict Zod schemas: claim_id "Nonempty, unique within collection"; member_id/provider_id "Nonempty"; provider_name "Nonempty; consistent per provider ID"; claim_date "Real calendar date, YYYY-MM-DD; generator restricted to 2024"; claim_type "OUTPATIENT, INPATIENT, DENTAL"; diagnosis_code "Nonempty ICD-10-format identifier; mapping membership checked by rule"; procedure_codes "Nonempty, unique nonempty entries"; submitted_amount "Finite, nonnegative, at most two decimal places"; is_weekend "Matches Saturday/Sunday derived in UTC". Reject unknown fields and batches above 2,000; accept empty batches; choose and document a safe amount bound preventing cohort overflow in `README.md`.
- [X] T007 [P] Populate `config/weights.json`, `config/bundles.json`, `config/diagnosis-procedures.json` and `config/surgical-procedures.json` with the data-model defaults totaling 29, at least five bundles with "at least two distinct components", at least ten valid diagnosis-procedure pairs and a surgical catalog; ensure normal generator procedures and bundles have valid diagnosis associations.
- [X] T008 After T007, implement `src/validation/config.js` and `src/config.js`: eight fixed rule IDs; weights are "integer values 1-5"; "Omitted overrides inherit versioned defaults; unknown keys fail validation"; version and validate catalogs and resolve immutable per-request configuration.
- [X] T009 [P] Implement `src/domain/dates.js` and `src/artifacts/canonical.js` for strict UTC calendar days, ascending code-point claim ordering, stable canonical JSON and SHA-256 dataset/configuration hashes; sort evidence IDs and procedures consistently.
- [X] T010 [P] Implement `src/artifacts/files.js` and `src/cli/common.js` for validated JSON reads, temporary-file/rename writes, existing-output refusal unless --force, multi-file generation completion semantics, cleanup on failure, shared error envelopes, CLI usage exit 2 and I/O/unexpected exit 1.
- [X] T011 [P] Implement `src/app.js`, `src/server.js`, `src/api/errors.js` and the shared router in `src/api/routes.js` with JSON parsing limited to 10 MiB, media-type enforcement, health endpoint, 127.0.0.1:3000 defaults, HOST/PORT validation, graceful shutdown and contracted 400/413/415/422/404/500 envelopes without partial results or stack traces.
- [X] T012 Add `tests/unit/validation.test.js`, `tests/unit/artifacts.test.js` and `tests/contract/errors.test.js` verifying T006-T011: invalid/unknown fields, duplicate IDs, dates, numeric bounds, weight errors, body/batch limits, failure-safe writes, CLI exit codes and error-path formatting; run them to establish the foundation checkpoint.

**Checkpoint**: Validated claims/configuration, shared transport, deterministic artifacts and errors
are available. T006 and T007 can start together; T008 waits for T007. T009-T011 are independent
of each other after setup; T012 waits for all foundational implementations.

## Phase 3: User Story 1 - Prioritize Claims with Evidence (Priority: P1)

**Goal**: Score arbitrary valid batches with all eight rules, evidence and deterministic ranking.
**Independent Test**: Use hand-authored controlled claims without generator or labels; assert
expected triggers, absent boundary flags, score arithmetic and HTTP/CLI equivalence.

### Tests for User Story 1

- [X] T013 [P] [US1] Create deterministic claim builders and boundary fixtures in `tests/fixtures/claims.js` and `tests/fixtures/rules.json`, independent of the future generator; supply valid and invalid examples for all eight rules and exact upcoding-cutoff construction.
- [X] T014 [P] [US1] Write score/config HTTP contract tests in `tests/contract/score.test.js` for GET /api/v1/config and POST /api/v1/score, strict label rejection, empty results, schema_version, metadata, stable flags, overridden weights and actionable validation errors.
- [X] T015 [US1] After T013, write at least 15 individual rule/edge unit cases in `tests/unit/rules.test.js` covering all eight rules: same-day and 7/8-day resubmission, duplicate group membership, strict two-SD cutoff, insufficient/zero variance, bundle presence, 30/31 claims, below/exactly 5% history, no/future history, unknown clinical codes and 47,500/49,999.99/50,000 boundaries.
- [X] T016 [US1] After T013, write scorer unit and adapter integration tests in `tests/unit/score.test.js` and `tests/integration/score.test.js` for overlap, once-per-rule contribution, two-decimal normalization, zero/all-rule scores, stable tie/flag/evidence ordering, shuffled-input invariance, config isolation and matching CLI/HTTP outputs excluding timing metadata.

### Implementation for User Story 1

- [X] T017 [US1] Build deterministic per-batch indexes in `src/domain/indexes.js`: duplicate groups, sorted member/diagnosis histories, stable population procedure moments including each claim once, provider/day counts and strictly-earlier-date prefix history; avoid future leakage and overflow.
- [X] T018 [P] [US1] Implement `src/domain/rules/duplicate-claim.js` after T017; flag every group member sharing member/provider/date/diagnosis and provide sorted related claim IDs as evidence (FR-004).
- [X] T019 [P] [US1] Implement `src/domain/rules/rapid-resubmission.js` after T017; same member/diagnosis, same date or preceding seven inclusive calendar days irrespective of provider; evidence includes related IDs and elapsed days (FR-005).
- [X] T020 [P] [US1] Implement `src/domain/rules/upcoding.js` after T017; compare whole-claim amount against mean plus twice population SD for each listed procedure, include evaluated claim, require at least two samples and positive variance, and emit observed statistics or explicit diagnostic (FR-006).
- [X] T021 [P] [US1] Implement `src/domain/rules/unbundling.js` after foundation; flag all components present without the bundle code and identify components and bundle; consolidate multiple matches into one rule flag (FR-007).
- [X] T022 [P] [US1] Implement `src/domain/rules/phantom-billing.js` after T017; flag all provider/day claims only above 30, recording provider, date and daily count (FR-008).
- [X] T023 [P] [US1] Implement `src/domain/rules/weekend-anomaly.js` after T017; require weekend surgery and strictly less than 5% earlier-dated weekend volume, exclude evaluated day/future dates, report counts/percentage and diagnose absent history (FR-009).
- [X] T024 [P] [US1] Implement `src/domain/rules/diagnosis-procedure-mismatch.js` after foundation; aggregate disallowed procedures into one flag and describe unknown codes as unsupported demonstration mappings (FR-010).
- [X] T025 [P] [US1] Implement `src/domain/rules/amount-clustering.js` after foundation for amounts >=47,500 and <50,000 with amount, threshold and percentage evidence (FR-011).
- [X] T026 [US1] Implement `src/domain/score.js` after T018-T025, validating inputs before detection, collecting one flag per rule in canonical order, normalizing by all eight effective weights and rounding to two decimals, sorting ties by claim ID, and excluding all access to ground truth (FR-012-FR-014, FR-016, FR-018).
- [X] T027 [US1] Add metadata and ordered diagnostics in `src/domain/score.js` using `src/artifacts/canonical.js`; measure validation through ranking with a monotonic clock, record schema/mapping versions, canonical hashes, effective weights and runtime/platform, and keep diagnostics out of score arithmetic (FR-017).
- [X] T028 [US1] Implement GET /api/v1/config and POST /api/v1/score in `src/api/score-routes.js`, mounted in `src/api/routes.js`, calling shared configuration/scoring services without mutable global overrides.
- [X] T029 [US1] Implement `src/cli/score.js` with --input, --output, optional --weights/--force; write the same ScoringResult as HTTP and return contracted summaries/errors using shared file helpers.
- [X] T030 [US1] Execute `tests/unit/rules.test.js`, `tests/unit/score.test.js`, `tests/contract/score.test.js` and `tests/integration/score.test.js`; correct failures in their owning modules and verify at least 15 meaningful unit cases pass before marking this checkpoint.

**Checkpoint**: US1 is a working MVP using hand-authored inputs. Generation and evaluation are
not needed to demonstrate scoring, evidence, weight overrides and deterministic ranking.

## Phase 4: User Story 2 - Generate Reproducible Demonstration Data (Priority: P2)

**Goal**: Produce challenge-aligned sample data with independently verifiable intentional patterns.
**Independent Test**: Generate twice with a fixed seed, verify schema/counts/patterns and compare
artifacts; test another seed without relying on evaluator metric targets.

### Tests for User Story 2

- [X] T031 [P] [US2] Write generator/manifest tests in `tests/unit/generation.test.js` for seed "unsigned 32-bit integer; default 202410", 2,000 claims, exactly 500 members/50 providers, all 2024 dates, 200 fraud IDs, 200 disjoint intentional memberships and final pattern preservation; include invalid seeds, a second seed and reproducibility.
- [X] T032 [P] [US2] Write endpoint/CLI tests in `tests/contract/generate.test.js` and `tests/integration/generate.test.js` for POST /api/v1/datasets/generate, default/explicit seed, three-file output, overwrite refusal, failure cleanup, and identical API/CLI dataset content.

### Implementation for User Story 2

- [X] T033 [P] [US2] Create `src/validation/generation.js` and `src/validation/labels.js` for unsigned 32-bit seed, strict versioned manifest/label shapes, "one record per claim", "Exactly 200 records have is_fraud=true" in challenge samples and clean records with "an empty injected_patterns array"; make challenge-specific counts generator checks, not restrictions on general evaluation labels.
- [X] T034 [P] [US2] Implement a versioned seeded PRNG in `src/generation/random.js`, avoiding Math.random; define stable sampling and IDs so random consumption/order does not vary by platform.
- [X] T035 [US2] Implement baseline generation in `src/generation/baseline.js` after T033-T034 with exactly 500 members and 50 providers, real 2024 dates, consistent provider names, valid diagnosis/procedure associations, derived weekends, stable amount cohorts, spaced ordinary visits and ordinary daily counts <=30.
- [X] T036 [US2] Implement `src/generation/inject.js` after T035: allocate 200 distinct fraud IDs with 30 duplicate, 30 rapid, 30 upcoded, 25 unbundled, 25 phantom, 20 weekend, 20 mismatch and 20 clustering memberships; keep intentional groups disjoint, use at least six clean phantom supports, and preserve prior weekday surgical history and stable final cohorts without relabeling incidental flags.
- [X] T037 [US2] Implement `src/generation/verify.js` and `src/generation/generate.js` after T036 to verify every intended predicate against the final batch independently of scoring outputs, emit labels/manifest with seed/versions/hash/group references and reject invalid construction without retrying until metrics pass.
- [X] T038 [US2] Implement POST /api/v1/datasets/generate in `src/api/generate-routes.js`, mount it in `src/api/routes.js`, and implement `src/cli/generate.js` with --seed/--out/--force using shared services and completion-safe artifact writes.
- [X] T039 [US2] Run the generator via `src/cli/generate.js` to create `data/sample/claims.json`, `data/sample/labels.json` and `data/sample/manifest.json` with seed 202410; verify exact counts, pattern memberships and byte-stable regeneration in a temporary directory before retaining the development sample.
- [X] T040 [US2] Run `tests/unit/generation.test.js`, `tests/contract/generate.test.js` and `tests/integration/generate.test.js`, plus scoring of claims alone against US1; verify no labels enter detection and keep incidental flags distinct from injection annotations.

**Checkpoint**: Delivered full sample supports development and testing. Generation tests can run
without the scoring implementation; T040 is the integration check once US1 is complete.

## Phase 5: User Story 3 - Evaluate and Adjust Scoring (Priority: P3)

**Goal**: Evaluate known scores, compare weights and save reproducible quality/timing reports.
**Independent Test**: Evaluate a tiny prepared scored collection with independently calculated
confusion counts, then vary threshold without invoking generation or detection.

### Tests for User Story 3

- [X] T041 [P] [US3] Write `tests/unit/evaluate.test.js` with known TP/FP/TN/FN fixtures, precision/recall/FPR arithmetic, default score>0, custom inclusive threshold, null undefined ratios, empty results and missing/duplicate/extra label ID rejection.
- [X] T042 [P] [US3] Write `tests/contract/evaluate.test.js` and `tests/integration/evaluate.test.js` for POST /api/v1/evaluate and CLI outputs, schema validation, no detector invocation, weight comparisons, recorded provenance and immutable input scores.

### Implementation for User Story 3

- [X] T043 [US3] Implement `src/validation/evaluation.js` validating scored artifacts, flags, unique IDs, full metadata and exact label coverage; enforce ratios "numbers in [0,1], or null with an undefined_metrics reason" and custom threshold "finite threshold > 0 and <= 100" without imposing the generator's 200-fraud requirement on arbitrary evaluations.
- [X] T044 [US3] Implement `src/evaluation/evaluate.js` after T043: default any_flag via score>0, optional minimum_score inclusive threshold, confusion counts, defined/undefined metrics, target status and source timing/environment/hashes; consume existing results without calling detection (FR-015, FR-017).
- [X] T045 [US3] Implement POST /api/v1/evaluate in `src/api/evaluate-routes.js`, mount it in `src/api/routes.js`, and implement `src/cli/evaluate.js` with --scores/--labels/--output/--minimum-score/--force; keep expected target misses in reports and enforce contracted exit/error behavior.
- [X] T046 [US3] Add `tests/acceptance/pipeline.test.js` using the full delivered sample to assert >=70% recall, <=20% FPR, reported precision/confusion counts and <30,000 ms validation-through-ranking; preserve labels and report actual failures rather than changing them to match predictions.
- [X] T047 [US3] Add `tests/acceptance/reproducibility.test.js` for fixed-seed artifact identity, shuffled claim input, a second seed, unchanged triggers under valid weight overrides and determinism of scores/flags/ranking excluding timing/environment metadata.
- [X] T048 [US3] Run scoring/evaluation CLI commands to create `output/scored.json` and `output/metrics.json`; verify dataset/configuration hashes against `data/sample/manifest.json`, record effective weights, threshold and actual environment, and document measured results in `README.md` without claiming unmeasured targets.
- [X] T049 [US3] Run `tests/unit/evaluate.test.js`, `tests/contract/evaluate.test.js`, `tests/integration/evaluate.test.js` and `tests/acceptance/`; resolve defects while preserving threshold disclosure and truth-label independence, then confirm both prepared-score and full-pipeline acceptance paths pass.

**Checkpoint**: Every story is independently demonstrable, with a complete measured submission path.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the complete application and finalize reviewable delivery artifacts.

- [X] T050 [P] Complete `README.md` with installation, all HTTP/CLI examples, default weight rationale, mappings/clinical limits, cohort/history assumptions, seed and overlap accounting, artifact locations, actual metrics, timing environment and timeline; preserve the existing `AGENTS.md` unchanged.
- [X] T051 [P] Add `tests/integration/lifecycle.test.js` for loopback startup, invalid HOST/PORT, graceful shutdown, aborted HTTP requests without persistence, immutable configuration across requests and CLI failure cleanup; cover any discovered regressions in owning test files.
- [X] T052 Validate all scenarios in `specs/001-fraud-scoring/quickstart.md` against the implemented commands and endpoints; update `README.md` and contract/example documentation only when required to match verified behavior without weakening the spec or constitution.
- [X] T053 Run npm lint, format:check, test and test:acceptance through scripts in `package.json`; verify zero code comments/docstrings, eight-rule coverage and >=15 unit cases; resolve findings and retain a concise validation record in `README.md`.
- [X] T054 Review `data/sample/manifest.json`, `output/scored.json`, `output/metrics.json` and `package-lock.json` for reproducibility and completeness; inspect Git status scoped to this project and document submission readiness in `README.md` without automatically publishing, staging unrelated parent files or changing `AGENTS.md`.

## Dependencies & Execution Order

### Phase Dependencies

Setup T001-T005 -> foundations T006-T012 -> story implementation -> polish T050-T054.
Within setup, T002-T004 can run concurrently after T001; T005 follows their configuration.
Foundation prerequisite details appear at its checkpoint. Story test files are written before
implementation and run against the intended interfaces to expose meaningful initial failures.

### User Story Dependencies

- US1 (T013-T030): foundation only; independent MVP with explicit fixtures.
- US2 (T031-T040): foundation only for generator and contracts; T040 waits for completed US1.
- US3 (T041-T049): prepared-result evaluator can be developed after foundation using the designed
  contract; T043 also needs the generic label schema from T033. Full integration/weight comparison
  waits for US1; T046-T048 require US1 and US2's delivered sample. T049 waits for all US3 work.
- Completion order for the full application: foundation -> US1 MVP -> US2 integration -> US3
  acceptance -> polish. Components can be developed concurrently only at the boundaries above.

### Within Each User Story

Tests first; then schemas and indexes, services/rules, endpoint and CLI adapters, then verification.
T014 is independent of fixture creation; T015-T016 require T013. Rule implementations T018-T020,
T022-T023 require T017; T021/T024/T025 require only foundation. Scoring assembly waits for all rules.
Shared-router mutations T028, T038 and T045 must run sequentially, even with parallel story work.
US3 prepared-score fixtures do not require the generator. Generation verification MUST NOT import
scored labels or derive truth from predictions; scoring MUST NOT import generation/evaluation labels.

### Parallel Opportunities

Parallel markers are conditional on the stated phase/task prerequisites. Different rule files,
test contracts and fixture work can proceed independently; assembly and verification are sequential.
T046 and T047 can be authored concurrently after evaluator contracts stabilize, but full execution
requires the completed sample and services. T050 and T051 can run together after story completion;
T052-T054 are sequential final validation to avoid stale artifacts or recorded results.

## Parallel Example: User Story 1

After foundation, author T013 fixtures and T014 HTTP contracts concurrently. After T017, implement
T018 duplicate detection, T019 rapid re-submission, T020 upcoding, T022 phantom billing and T023
weekend anomaly in separate files. T021/T024/T025 can proceed independently after foundation.
Do not start T026 scoring assembly until every rule implementation is available.

## Parallel Example: User Story 2

After foundation, author T031 generator tests and T032 adapter tests concurrently. T033 schemas
and T034 seeded random source use different files and can also proceed concurrently; T035 waits
for both. Keep baseline, injection, verification and canonical artifact generation sequential.

## Parallel Example: User Story 3

Author T041 evaluator unit tests and T042 contract/integration tests concurrently from prepared
fixtures. Evaluation service work is independent of detection once artifact schemas are stable;
serialize shared-router integration. Full sample acceptance waits for US1 and US2.

## Implementation Strategy

### MVP First (User Story 1 Only)

Complete setup and foundations, then US1. Demonstrate all eight rules and configurable evidence-based
ranking through HTTP and CLI with explicit fixtures. Validate T030 before moving to full data generation.

### Incremental Delivery

Add US2's verified seeded sample without changing scoring's label-free interface. Add US3's
prepared-result evaluator, then measure full-pipeline metrics and timing. Finally run the quickstart
and quality gates; retain only genuine measured results and reproducible artifacts.

### Traceability

| Requirements | Primary tasks |
| --- | --- |
| FR-001, FR-002, FR-018 | T006-T012, T028-T029, T038, T043-T045 |
| FR-003 | T031-T040 |
| FR-004 through FR-011 | T013-T025, T030 |
| FR-012 through FR-014 | T007-T008, T016, T026-T029 |
| FR-015 | T041-T045, T049 |
| FR-016 | T026, T033-T037, T040, T046-T047 |
| FR-017 | T009, T027, T044, T046-T048 |
| FR-019 | T004, T039, T048, T050, T052-T054 |
| SC-001 through SC-007 | T030, T039-T040, T046-T049, T052-T054 |

## Notes

There are 54 tasks: 5 setup, 7 foundation, 18 US1, 10 US2, 9 US3 and 5 polish.
No task authorizes GitHub publication. No tasks.md checkbox is marked complete during generation.
The constitution's temporary Sync Impact Report is a pre-commit cleanup item in its own workflow;
this feature implementation must not silently amend governance content.

## US1 Implementation Record (2026-10-22)

T001-T030 completed for the requested US1 scope. Validation: 71 tests passed, including
all eight rule boundaries, score normalization, HTTP/CLI equivalence and server startup.
ESLint, AST no-comment checks and Prettier validation passed. The controlled 2,000-claim
case completed in approximately 38 ms on Node v24.19.0 / Windows x64; this is not a
measurement of recall or false positive rate against the future generated dataset.
T031-T054 remain unchecked; US2, US3 and full-delivery acceptance are not completed.

## US2 Implementation Record (2026-10-22)

T031-T040 completed. Delivered versioned Mulberry32 generation, independent final-pattern
verification, strict labels/manifest schemas, HTTP and CLI adapters, and the default sample.
Corrected the earlier arithmetic error in design documents: the eight challenge pattern counts
sum to 200, so 200 distinct intentionally fraudulent claims each carry one intentional pattern.
The historical arithmetic note in checklists/requirements.md is superseded by this correction;
checklist files and gate markers were left unchanged as required by the implementation skill.
The default seed 202410 produces dataset hash
0aaa3cfe52475bde2588736dc64a383701bbf431ace68f3e5bb33b56512b0cdc.
Validation: 91 tests passed; lint, AST no-comment checks and Prettier checks passed.
Byte-identical regeneration, alternate/extreme seeds, damaged injections, label isolation,
output protection and failure cleanup are covered. T041-T054 remain unchecked.

## US3 Implementation Record (2026-10-22)

T041-T049 completed. Added strict scored-artifact validation, prepared-score evaluation,
configurable inclusive thresholds, explicit undefined ratios, and shared HTTP/CLI evaluation.
Saved output/scored.json and output/metrics.json, verified against the sample dataset and active
configuration hashes. Default any-positive-score policy produced TP=200, FP=36, TN=1764, FN=0:
precision 84.7457627118644%, recall 100%, FPR 2%, scoring duration 35.8066 ms on Node v24.19.0
Windows x64. No threshold tuning or relabeling was used. All 112 tests passed; lint, AST
no-comment checks and Prettier checks passed. Final cross-cutting tasks T050-T054 remain unchecked.

## Final Polish Completion Record

T050-T054 completed. Final README and rerunnable quickstart examples cover all delivered
commands, assumptions, mappings, dependency versions and measured artifacts. Added four lifecycle
tests covering normal shutdown via the actual signal handler, aborted requests without persisted
output, concurrent configuration isolation and CLI write cleanup. Existing startup validation
tests continue covering invalid HOST/PORT. The full suite passes all 116 tests; the separate
acceptance command passes all three tests. Clean npm ci, lint, AST no-comment validation, and
Prettier validation passed. CLI and real PowerShell HTTP quickstarts were exercised end-to-end.
Final audit verified byte-identical sample regeneration, replayed scores, recalculated metrics,
dataset/configuration hashes, and all 144 locked dependencies. All 54 tasks are complete.
AGENTS.md and checklist gate files remain unchanged. No staging, commit or publication occurred.
