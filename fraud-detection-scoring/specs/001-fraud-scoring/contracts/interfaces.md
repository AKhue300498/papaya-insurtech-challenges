# HTTP and CLI Contracts

## Shared Behavior

Local Express service binds to 127.0.0.1:3000 by default; PORT may override the port.
All bodies and successful responses are application/json. Limit bodies to 10 MiB and batches
to 2,000 claims for v1; reject larger bodies with 413 and larger collections with 422.
No authentication, remote dependencies, upload paths, server-side dataset store, or job queue.
Configuration is resolved per request; one user's overrides cannot mutate defaults.

See [data-model.md](../data-model.md) for field definitions, defaults, ordering, and validation.
Reject unknown body properties. Responses have schema_version "1". API handlers and CLI adapters
call the same domain services; neither implements detection rules.

## Endpoints

| Method and path | Request | Success response |
| --- | --- | --- |
| GET /health | None | 200: {status:"ok", schema_version:"1"} |
| GET /api/v1/config | None | 200: {schema_version, weights, bundles, diagnosis_procedure_pairs, surgical_procedures, mapping_version} |
| POST /api/v1/datasets/generate | {seed?:unsigned integer} | 200: {schema_version, claims, labels, manifest} |
| POST /api/v1/score | {claims:Claim[], weights?:partial weight object} | 200: {schema_version, results, diagnostics, metadata} |
| POST /api/v1/evaluate | {scored:ScoringResult, labels:GroundTruth[], minimum_score?:number} | 200: EvaluationReport |

Generation is synchronous and always generates the challenge's 2,000 claims. The score endpoint
MUST reject label/manifest fields, including labels embedded inside claims. Evaluation consumes
existing scores and never calls detection; it cannot certify untrusted scores as genuine outputs.
Returned hashes allow consumers to compare artifacts; this local demonstration has no signature.
An empty claims array returns results:[] and diagnostics:[] with normal metadata.

Evaluation additionally checks unique ranked result IDs, canonical unique flag order, flag
severities matching effective weights, normalized two-decimal scores, and diagnostic references
to existing results. It accepts arbitrary valid batch sizes up to 2,000, including empty batches.
Labels must exactly cover results; no challenge-specific 200-fraud count is imposed here.

EvaluationReport fields: schema_version, dataset_hash, configuration_hash, effective_weights,
mapping_version, decision_policy, confusion_matrix, precision, recall, false_positive_rate,
undefined_metrics, counts, scoring_duration_ms, environment, and targets.
decision_policy contains mode (any_flag or minimum_score), comparison (> or >=), and threshold
(0 for any_flag or the supplied cutoff). confusion_matrix contains tp/fp/tn/fn. counts contains
claims, actual_fraud, actual_clean, predicted_fraud and predicted_clean. Ratios are in [0,1],
or null with {metric,reason} records in undefined_metrics for zero denominators.
targets contains recall {minimum,passed}, false_positive_rate {maximum,passed},
scoring_duration_ms {maximum_exclusive,passed}, and all_passed. Undefined metric targets have
passed:null; all_passed is true only when every target explicitly passes. Valid evaluations
return 200 even when a target fails. Source timing/environment are preserved, not measured anew.

## Errors

Error envelope: {error:{code,message,details:[{path,code,message}]}}.
Paths use dot-separated field/index notation, such as claims.7.claim_date.

- 400 INVALID_JSON: body cannot be parsed as JSON.
- 413 BODY_TOO_LARGE: exceeds configured body limit.
- 415 UNSUPPORTED_MEDIA_TYPE: body endpoint without application/json.
- 422 VALIDATION_ERROR: invalid schema, duplicate IDs, dates, config, threshold or label coverage.
- 404 NOT_FOUND: unsupported endpoint.
- 500 INTERNAL_ERROR: unexpected failure; no stack traces returned to clients.

Errors never return partial scored results. Aborted requests must not persist outputs.

## CLI and npm Script Contract

Commands below are the planned cross-platform npm scripts; on Windows use npm.cmd if PowerShell
blocks npm.ps1. Arguments after -- are passed unchanged to the Node command.

| Script | Arguments | Behavior |
| --- | --- | --- |
| npm start | none | Start Express service; HOST/PORT env overrides |
| npm run dev | none | Start with Node watch mode |
| npm run data:generate | --seed 202410 --out data/sample [--force] | Save claims.json, labels.json, manifest.json |
| npm run score | --input data/sample/claims.json --output output/scored.json [--weights config/weights.json] [--force] | Validate and save ScoringResult |
| npm run evaluate | --scores output/scored.json --labels data/sample/labels.json --output output/metrics.json [--minimum-score 10] [--force] | Save EvaluationReport |
| npm test | none | Run unit, contract, integration, generator and acceptance checks |
| npm run test:unit | none | Run at least 15 rule and boundary unit tests |
| npm run test:acceptance | none | Verify full sample, metrics and 30-second budget |
| npm run lint | none | ESLint plus AST check forbidding comments/explanatory docstrings in JS |
| npm run format:check | none | Prettier validation |
| npm run format | none | Apply formatting |

Success exit 0; validation/usage failures exit 2; I/O/unexpected errors exit 1. Errors go to stderr
using the same error shape; success summaries go to stdout. Evaluation target failures are recorded
in reports; acceptance tests fail when targets are missed. Output path arguments exist only in CLI.
