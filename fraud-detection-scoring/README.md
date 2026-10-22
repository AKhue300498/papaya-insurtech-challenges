# Fraud Detection Scoring Engine

Node.js 24 / Express 5 application implementing all three user stories of
[the feature specification](specs/001-fraud-scoring/spec.md), based on `AI_Challenge_10.md`.
Submit a batch and receive a deterministic ranked list with scores, itemized evidence, and
separate diagnostics when statistical history is unavailable.

## Install and Run

Use Node.js 24 LTS and npm. From this directory:

```powershell
npm.cmd ci
npm.cmd start
```

On Linux/macOS use `npm` in place of `npm.cmd`. The Windows form avoids PowerShell's restriction
on npm.ps1. The server listens on `http://127.0.0.1:3000`. Set HOST to an IP address or localhost
and PORT to an integer from 1 to 65535 to override. `npm.cmd run dev` enables Node watch mode.
Stop with Ctrl+C. No database or external service is required.

## Score Claims

Save a JSON array using the fields in the [data model](specs/001-fraud-scoring/data-model.md).
The supplied `data/sample/claims.json` contains 2,000 generated claims. This hand-authored fixture
demonstrates the input shape:

```json
[
  {
    "claim_id": "CLM-001",
    "member_id": "MEM-001",
    "provider_id": "PRV-001",
    "provider_name": "Synthetic Clinic",
    "claim_date": "2024-06-03",
    "claim_type": "OUTPATIENT",
    "diagnosis_code": "Z00.0",
    "procedure_codes": ["P-100"],
    "submitted_amount": 49500,
    "is_weekend": false
  }
]
```

Run the file through the shared scoring service:

```powershell
npm.cmd run score -- --input claims.json --output tmp/example-scored.json --force
npm.cmd run score -- --input claims.json --output tmp/example-scored.json --weights config/weights.json --force
```

Existing outputs are protected; --force explicitly replaces them. The optional weights file may
override any subset of the eight weights. CLI success exits 0, validation/usage errors exit 2,
and filesystem/unexpected errors exit 1. Errors are JSON on stderr without stack traces.

The scoring HTTP interface provides `GET /health`, `GET /api/v1/config`, and `POST /api/v1/score`:

```powershell
$claims = Get-Content -Raw claims.json | ConvertFrom-Json
$body = @{ claims = @($claims); weights = @{ amount_clustering = 3 } } | ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/score -ContentType 'application/json' -Body $body
```

The result has `schema_version`, ranked `results`, `diagnostics`, and `metadata` with hashes,
effective weights, mapping version, runtime/platform and scoring duration. Scores range 0-100,
rounded to two decimals. Ties use ascending claim ID; flags follow the documented rule order.
The example produces only an amount-clustering flag and a default score of 6.90. A single-claim
procedure cohort also produces an insufficient-samples diagnostic, which adds no risk score.

## Rules and Configuration

| Rule                         | Weight | Rationale                                               |
| ---------------------------- | -----: | ------------------------------------------------------- |
| duplicate_claim              |      5 | Exact submission identity is strong evidence for review |
| rapid_resubmission           |      3 | Repeat visits can be legitimate                         |
| upcoding                     |      4 | A material amount outlier warrants investigation        |
| unbundling                   |      4 | A specific mapped bundle is available                   |
| phantom_billing              |      5 | Abnormal daily provider volume                          |
| weekend_anomaly              |      2 | Scheduling patterns alone have lower specificity        |
| diagnosis_procedure_mismatch |      4 | Explicit mismatch with the demonstration catalog        |
| amount_clustering            |      2 | Threshold proximity alone has lower specificity         |

Score = 100 × triggered weights / all eight weights (default denominator 29). Each rule contributes
once. These scores express investigation priority, not calibrated fraud probabilities.
Weights must be integers 1-5; unknown keys fail validation and overrides cannot mutate defaults.

Versioned files in `config/` include five bundles, valid diagnosis/procedure pairs, and surgical
codes. The clinical catalog is synthetic, not a source of medical advice. Unknown codes are
identified as unsupported by the demonstration mapping rather than a clinical conclusion.

Upcoding uses whole-claim amounts for each listed procedure's cohort across the supplied batch,
including the claim itself, with population standard deviation. It flags strictly above mean + 2 SD;
fewer than two samples or zero variance yields a diagnostic. Weekend history includes only earlier
dates for the same provider; no history yields a diagnostic. Rapid resubmission includes same-day
claims and seven preceding days. Amount clustering includes 47,500 and excludes 50,000.

## Evaluate Scored Claims

The delivered `output/scored.json` and `output/metrics.json` correspond to the default sample,
default weights, and any-positive-score prediction policy. To regenerate them intentionally:

```powershell
npm.cmd run score -- --input data/sample/claims.json --output output/scored.json --force
npm.cmd run evaluate -- --scores output/scored.json --labels data/sample/labels.json --output output/metrics.json --force
npm.cmd run test:acceptance
```

The default predicts fraud when `risk_score > 0`. Supply `--minimum-score 10` to use an inclusive
`risk_score >= 10` cutoff; choose a different output path when comparing thresholds. The optional
threshold must be greater than 0 and at most 100. Changing the threshold does not rerun detection
or modify the scored artifact. To compare weights, rescore using --weights, then evaluate that
new artifact; the report retains its effective weights and configuration hash.

The report includes TP, FP, TN, FN, precision `TP/(TP+FP)`, recall `TP/(TP+FN)`, and false positive
rate `FP/(FP+TN)`. Ratios use 0-1 units. A zero denominator gives `null` and an explicit reason in
`undefined_metrics`; an undefined quality metric cannot pass its target. Target misses remain in
the saved report and do not turn a valid evaluation into a CLI or HTTP error. Acceptance tests
fail when quality or timing targets are missed.

The evaluator checks exact label-ID coverage, unique ranked score IDs, flag order/severity, score
normalization, and complete provenance metadata. It consumes existing scores without detecting
fraud again. Dataset/configuration hashes and source timing are carried into the report; callers
must associate it with the original dataset and manifest. Structural validation cannot authenticate
externally supplied score artifacts or their declared metadata.

Evaluate an HTTP scoring response with its matching labels:

```powershell
$sample = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/datasets/generate -ContentType 'application/json' -Body '{"seed":202410}'
$body = @{ claims = $sample.claims } | ConvertTo-Json -Depth 20
$scored = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/score -ContentType 'application/json' -Body $body
$evaluation = @{ scored = $scored; labels = $sample.labels } | ConvertTo-Json -Depth 30
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/evaluate -ContentType 'application/json' -Body $evaluation
```

Measured on the included seed 202410 sample, default weights and threshold, using Node v24.19.0
on Windows x64:

| Outcome             |               Result | Required target |
| ------------------- | -------------------: | --------------: |
| Precision           |               84.75% |        Reported |
| Recall              |                 100% |    At least 70% |
| False positive rate |                   2% |     At most 20% |
| Scoring duration    |           35.8066 ms | Under 30,000 ms |
| TP / FP / TN / FN   | 200 / 36 / 1,764 / 0 |        Reported |

The recorded duration covers validation, indexing, detection, scoring, ranking and provenance
hashing. It excludes generation, evaluation and file export. New runs have different timings.
Results describe this synthetic demonstration sample; all 36 false positives remain clean-labeled.
No prediction threshold or label was adjusted to improve these reported results.

## Generate Development and Test Data

The default sample is included in `data/sample/`:

- `claims.json`: 2,000 claims, exactly 500 members and 50 providers, dated in 2024.
- `labels.json`: one ground-truth record per claim, including 200 intentionally fraudulent claims.
- `manifest.json`: seed, generator/PRNG/mapping versions, canonical dataset hash, counts, and
  injection/support claim references.

```powershell
npm.cmd run data:generate -- --seed 202410 --out data/sample --force
npm.cmd run data:generate -- --seed 7 --out tmp/alternate-sample --force
npm.cmd run score -- --input data/sample/claims.json --output tmp/sample-scored.json --force
```

The first command intentionally replaces the included sample; the others write disposable outputs.
Omit --force for a new directory;
existing dataset files are otherwise protected. The completion manifest is written last. An
interrupted or failed write has no completion manifest and must not be used as a complete dataset.
JSON artifacts use UTF-8 and LF line endings, including after Git checkout.

The seed is an unsigned 32-bit integer, from 0 through 4294967295, defaulting to 202410.
Generation uses versioned Mulberry32 and contains no timestamps or environment-dependent fields.
The same seed and generator/catalog versions reproduce identical artifacts; another seed varies
baseline scheduling, providers, diagnoses and amounts. Ordinary visits are spaced apart, have
compatible diagnoses/procedures, occur on weekdays, and stay below daily volume limits.

| Intentional pattern          | Claims |
| ---------------------------- | -----: |
| Duplicate claim              |     30 |
| Rapid re-submission          |     30 |
| Upcoding                     |     30 |
| Unbundling                   |     25 |
| Phantom billing              |     25 |
| Weekend surgical anomaly     |     20 |
| Diagnosis-procedure mismatch |     20 |
| Amount clustering            |     20 |

These counts total **200**, with one intentional pattern per labeled fraud claim. Detected flags may overlap: duplicates can
also be rapid re-submissions, and clean original/support claims can be flagged. Those incidental
findings do not change their truth labels. Phantom billing uses 25 intentional fraud claims and
six clean supports on a common provider-day; weekend surgery has earlier weekday provider history.

Before returning or saving a sample, an independent verifier checks schema, cardinality, exact
label coverage, hashes, support references, and every intentional predicate against the final
batch. It recomputes the statistical and history conditions without calling the scorer. There
are no retries based on achieved metrics and no relabeling to improve results.

Generate through Express without allowing a server-side output path:

```powershell
$sample = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/datasets/generate -ContentType 'application/json' -Body '{"seed":202410}'
$body = @{ claims = $sample.claims } | ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/score -ContentType 'application/json' -Body $body
```

Keep labels and manifest separate from scoring input. Passing the entire generation response
or adding truth fields to claims is rejected rather than silently stripped.

## Validation and Limits

Requests reject unknown fields, including fraud labels, and fail as a whole on invalid claims.
IDs must be nonblank and unique; procedure lists are nonempty and unique. Dates are real
YYYY-MM-DD calendar dates with a consistent Saturday/Sunday indicator. Scoring supports dates
outside 2024; the challenge generator restricts generated dates to 2024. Amounts must be
finite, nonnegative, at most two decimal places, and no greater than 1,000,000,000. This numeric
bound prevents unstable/overflowing moments while remaining above challenge amounts.

HTTP bodies are limited to 10 MiB and batches to 2,000 claims. Errors use 400 for malformed JSON,
413 for body size, 415 for media type, 422 for invalid data, 404 for missing routes, and 500 for
unexpected failures. Output hashing canonicalizes claim and procedure order. Label data never
enters detection. Bind to loopback for this single-user local application.

## Development and Verification

```powershell
npm.cmd test
npm.cmd run test:unit
npm.cmd run test:acceptance
npm.cmd run lint
npm.cmd run format:check
npm.cmd run format
```

Tests use node:test, node:assert/strict and native fetch against ephemeral servers. Formatting uses
Prettier (two spaces, single quotes); ESLint checks JavaScript and an AST check rejects code comments
and explanatory docstrings/JSDoc. Explanations belong in Markdown. `src/domain/rules/` contains
independent detectors; `src/domain/score.js` composes them; `src/api/` and `src/cli/` are adapters.
Hand-authored development fixtures live in `tests/fixtures/`.

US1 tests cover all eight rules, exact thresholds, insufficient history, normalization, weight
isolation, shuffled input, output protection and HTTP/CLI equivalence. A controlled 2,000-claim
test checks the <30-second scoring budget. This does not establish recall/FPR against generated fraud.

Validated with Node v24.19.0 on Windows x64: all 116 tests pass, including server
startup and invalid runtime configuration. ESLint, the AST no-comment check, and Prettier checks
passed. The generated-sample measurements are recorded above and in `output/metrics.json`.

US2 adds tests for seed limits, reproducibility, exact pattern counts, damaged-injection rejection,
truth isolation, CLI/API agreement and byte-identical regeneration of the supplied development sample.

US3 adds prepared-score metric tests, exact/inclusive threshold cases, undefined ratios, malformed
artifact rejection, HTTP/CLI agreement, full-dataset quality/timing acceptance, alternate seeds,
shuffled inputs and weight comparisons. The saved scored submission and metrics report are in
`output/`; `npm.cmd run test:acceptance` verifies the full pipeline against the delivered sample.
Lifecycle tests also cover graceful shutdown, aborted HTTP bodies without persisted results,
concurrent configuration overrides and cleanup after failed CLI writes. The Windows shutdown
test sends IPC to invoke the actual SIGTERM handler, then verifies a normal exit and closed listener.
The overall planning estimate is 6-8 focused developer hours, subject to validation outcomes.

## Delivery Artifacts

Include `data/sample/claims.json`, `data/sample/labels.json`, `data/sample/manifest.json`,
`output/scored.json`, `output/metrics.json`, all `config/` mappings, and `package-lock.json` when
submitting. The manifest records seed 202410, generator/PRNG versions and the dataset hash; the
score and metric artifacts share that hash and record the effective configuration.

The lockfile installs Express 5.3.0 and Zod 4.6.7 for runtime, plus ESLint 10.13.0 and Prettier
3.9.10 for development. Use `npm ci` to reproduce the locked dependency tree. Git ignores local
dependencies and temporary artifacts while retaining the supplied dataset and output artifacts.

The final review reproduced the sample byte-for-byte, replayed the saved scores, recalculated
the metrics report, and confirmed matching dataset/configuration hashes and lockfile versions.
`npm ci`, lint, formatting, the complete 116-test suite, and the three acceptance tests passed.
The CLI and PowerShell HTTP quickstarts were exercised against the full sample. Delivery artifacts
are ready for repository submission; publication is a separate action.

See [tasks](specs/001-fraud-scoring/tasks.md) for progress and
[interface contracts](specs/001-fraud-scoring/contracts/interfaces.md) for the complete design.
