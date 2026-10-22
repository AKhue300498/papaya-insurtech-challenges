# Research: Fraud Detection Scoring

## Runtime and Language

Decision: Node.js 24 LTS with JavaScript ESM; use a supported Node 24 patch and commit the lockfile.
Rationale: fits the user's Node.js preference, supports modern built-in testing and watch mode,
and avoids an unnecessary compilation stage. Local inspection found Node v24.19.0 and npm 11.17.0.
Alternatives considered: TypeScript improves static checking but requires a build toolchain;
Node Current provides no required capability over LTS.
Source: [Node release status](https://nodejs.org/en/about/previous-releases).

## Express and Boundary Validation

Decision: Express 5, Zod 4 runtime schemas, centralized JSON error middleware, thin route handlers.
Rationale: Express 5 forwards rejected handler promises to error handling. Strict schemas and
cross-record domain checks catch bad input before any scoring. Zod supplies field-path validation;
verify its current stable patch during installation and pin through package-lock.json.
Alternatives considered: Express 4 requires additional async wrappers; handwritten schema checks
would duplicate request/file validation; a larger application framework is unnecessary.
Sources: [Express error handling](https://expressjs.com/en/5x/guide/error-handling/),
[Express API](https://expressjs.com/en/5x/api/), [Zod documentation](https://zod.dev/).

## Testing and Quality Tools

Decision: node:test, node:assert/strict, native fetch against an ephemeral loopback server,
ESLint and Prettier. Use an AST-based lint check to reject JavaScript comments; no JSDoc.
Rationale: built-in tests cover asynchronous service and HTTP behavior without another runner.
At least 15 meaningful unit tests plus integration and acceptance coverage satisfy governance;
there is no invented percentage gate. Markdown holds rationale and setup documentation.
Alternatives considered: Jest/Vitest and Supertest are useful but unnecessary dependencies here.
Sources: [Node test runner](https://nodejs.org/docs/latest-v24.x/api/test.html),
[ESLint configuration](https://eslint.org/docs/latest/use/configure/),
[Prettier CLI](https://prettier.io/docs/cli).

## Storage and Algorithms

Decision: in-memory maps and sorted histories; versioned JSON configuration and filesystem artifacts.
Rationale: 2,000 claims do not justify a database or background queue. Canonical claim ordering,
population cohort moments, day-level provider prefix totals, and stable evidence ordering preserve
reproducibility while avoiding repeated full scans. Intended complexity is O(n log n + e), where
e is the amount of evidence emitted; avoid unbounded duplicate-pair materialization internally.
Alternatives considered: persistent storage and workers introduce lifecycle concerns without
meeting an additional requirement. This decision is inferred from the specified local scope.

## Dataset Construction

Decision: versioned seeded PRNG, exactly 500 members and 50 providers, 2,000 claims, 200 fraud IDs,
200 disjoint intentional pattern memberships matching the eight challenge counts. Use structured scheduling
and independent final pattern verification, not metric-driven relabeling. Preserve a full default
sample in data/sample and separate small boundary fixtures in tests/fixtures.
Rationale: the challenge counts sum to 200; the earlier 220-total assumption was an arithmetic error. Constructing patterns jointly avoids
phantom daily totals, historical weekend rates, or inflated statistical baselines invalidating
later injections. Support claims can be false positives and stay legitimately labeled.
Alternatives considered: independent random injections risk destructive interference; labeling
all flagged claims fraudulent would contaminate evaluation. No actual sample is generated in planning.

## Scoring and Evaluation

Decision: retain the specification's whole-claim procedure cohorts, strictly earlier provider
history, 29-point default weight sum, and any-positive-score default decision policy. Preserve
undefined metric ratios as null with reasons. Record configurations and canonical SHA-256 hashes.
Rationale: removes silent baseline and threshold ambiguity; the score is a priority indicator,
not a calibrated probability. Labels are accessible to generation verification and evaluation only.
Alternatives considered: external clinical/statistical baselines and probability calibration
lack supplied data and would expand the challenge scope.

## Research Status

All technical choices are resolved. Runtime/Express/testing findings were researched using official
documentation; storage, injection strategy, and default weights are project design decisions.
No unresolved clarification or constitution exception remains.

