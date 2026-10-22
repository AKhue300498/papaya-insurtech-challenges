# Quickstart Validation Guide

These commands validate the implemented application and its included submission artifacts.
Run from the fraud-detection-scoring directory. See [contracts](contracts/interfaces.md) and
[data model](data-model.md) for request formats, artifacts and defaults.

## Prerequisites and Setup

Use Node.js 24 LTS and npm. On Windows PowerShell, use npm.cmd when execution policy blocks
npm.ps1. The validation workstation uses Node v24.19.0 and npm 11.17.0.
Install the locked dependencies using:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
```

Expected: all commands exit zero; at least 15 meaningful unit tests pass, plus contract,
integration and acceptance checks. No application comments or explanatory docstrings are allowed.

## Generate the Development Sample

```powershell
npm.cmd run data:generate -- --seed 202410 --out tmp/quickstart/sample --force
```

Expected: claims.json, labels.json and manifest.json; 2,000 claims, 500 members, 50 providers,
2024 dates, 200 intentional fraud IDs and the challenge's 200 intentional pattern memberships. Output files
are protected from accidental overwrite; use --force only when intentionally regenerating them.
The final generation verification proves every intended pattern after all modifications.

Regenerate into a temporary directory with the same seed and compare canonical artifacts.
They must match `data/sample/`. The commands write disposable outputs under `tmp/quickstart/`;
--force makes repeated validation safe without replacing the delivered artifacts. Labels remain
separate from claims. Omit --force to verify existing-output refusal.

## Score and Evaluate

```powershell
npm.cmd run score -- --input tmp/quickstart/sample/claims.json --output tmp/quickstart/scored.json --force
npm.cmd run evaluate -- --scores tmp/quickstart/scored.json --labels tmp/quickstart/sample/labels.json --output tmp/quickstart/metrics.json --force
npm.cmd run test:acceptance
```

Expected: one ranked result per claim; all scores within 0-100; each flag includes observed values
and its comparison. Reports record seed through the manifest, hashes, mappings, effective weights,
any_flag decision policy, environment, and scoring duration. Recall >=0.70, FPR <=0.20, and
scoring_duration_ms <30000 must be asserted. Report precision and TP/FP/TN/FN without suppressing
incidental false positives. These assertions are exercised by the acceptance tests. Recorded
submission measurements remain in `output/metrics.json`; regenerated timings may differ.

Repeat score with --weights config/weights.json and --force to verify documented overrides;
rule triggers remain unchanged. A custom evaluation threshold uses --minimum-score with a number
>0 and <=100, recorded in its own output file.

## Validate Express Endpoints

Start in another terminal:

```powershell
npm.cmd start
```

Then:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/api/v1/config
$generatedSample = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/datasets/generate -ContentType 'application/json' -Body '{"seed":202410}'
$scoreBody = @{ claims = $generatedSample.claims } | ConvertTo-Json -Depth 20
$scoredSample = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/score -ContentType 'application/json' -Body $scoreBody
$evaluationBody = @{ scored = $scoredSample; labels = $generatedSample.labels } | ConvertTo-Json -Depth 30
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/evaluate -ContentType 'application/json' -Body $evaluationBody
```

Expected: HTTP 200 with the shared contract shapes; HTTP results match CLI domain outputs after
excluding timing/environment metadata. Stop the server with Ctrl+C and confirm clean shutdown.

## Boundary and Failure Validation

Automated tests must cover each rule's positive/negative cases and the spec's exact boundaries:
7/8 days, 30/31 daily claims, below/exactly 5% weekend history, two-standard-deviation equality,
47,500 and amounts immediately below 50,000. Test zero variance, no history, empty input,
overlapping flags, stable ties, shuffled input, duplicate IDs, malformed dates and invalid weights.

Submit invalid JSON (400), incorrect media type (415), oversized JSON (413), malformed claims
or label coverage (422), and an unknown route (404). Verify actionable error envelopes and no
partial results. Submit labels inside a score request and confirm rejection. Independently
calculate metrics on a tiny known confusion matrix, including undefined denominator cases.

## Submission Review

Include sample data, manifest, separate labels, scored results and measured metrics. Document
exact commands, dependency versions, environment and weight rationale in README. Compare a second
seed to detect hardcoded generation. Actual GitHub publication remains a separate submission action.

