# Data Model

## Claim

| Field | Type | Validation |
| --- | --- | --- |
| claim_id | string | Nonempty, unique within collection |
| member_id | string | Nonempty |
| provider_id | string | Nonempty |
| provider_name | string | Nonempty; consistent per provider ID |
| claim_date | string | Real calendar date, YYYY-MM-DD; generator restricted to 2024 |
| claim_type | string | OUTPATIENT, INPATIENT, DENTAL |
| diagnosis_code | string | Nonempty ICD-10-format identifier; mapping membership checked by rule |
| procedure_codes | string array | Nonempty, unique nonempty entries |
| submitted_amount | number | Finite, nonnegative, at most two decimal places |
| is_weekend | boolean | Matches Saturday/Sunday derived in UTC |

Strict boundary validation rejects unrecognized fields rather than stripping ground-truth data.
Reject amounts that could overflow cohort calculations; document the numeric upper bound in the
shared schema and return a field-specific error. Date-only comparisons use UTC day numbers.
Canonical calculation order is ascending claim ID; evidence-related IDs and procedures are sorted.
No persistence identity or lifecycle state beyond the supplied claim ID is required.

## Rule Configuration

Eight fixed rule IDs in this order: duplicate_claim, rapid_resubmission, upcoding, unbundling,
phantom_billing, weekend_anomaly, diagnosis_procedure_mismatch, amount_clustering.

`weights` is a complete object of these IDs and integer values 1-5. Omitted overrides inherit
versioned defaults; unknown keys fail validation. Bundle mappings, diagnosis/procedure mappings,
and surgical catalog are versioned local JSON assets shared by generation and scoring. They are
read-only during a request. Each bundle contains a bundle code and at least two distinct components;
there are at least five bundles and ten valid diagnosis-procedure pairs.

Initial weights: duplicate_claim 5; rapid_resubmission 3; upcoding 4; unbundling 4;
phantom_billing 5; weekend_anomaly 2; diagnosis_procedure_mismatch 4; amount_clustering 2.
Total 29. Direct duplication and volume anomalies receive higher weight; weekend and threshold
proximity alone have weaker specificity. These are synthetic demonstration priorities, not
calibrated fraud probabilities. Clinical mismatch uses a limited catalog and needs investigation.

## Scoring Result

`results`: descending risk_score, ascending claim_id using code-point comparison on ties.
Each item contains claim_id, risk_score rounded to two decimals, and flags. Each flag contains
rule, severity, evidence. Rules contribute once and flags follow the fixed rule order.

`diagnostics`: ordered records with claim_id, rule, code, and message for unavailable statistical
baselines. These are distinct from fraud flags. No samples or zero variance skip upcoding;
no earlier provider dates skips weekend comparison. Diagnostics never add score.

`metadata`: schema_version, dataset_hash, configuration_hash, effective_weights, mapping_version,
scoring_duration_ms, runtime and platform identifiers. Hash canonical claims by claim ID and
canonical configuration with SHA-256. Exclude timing/environment from reproducibility comparisons.

Derived indexes: duplicate composite-key groups; member/diagnosis day-sorted lists; per-procedure
cohort moments; provider/day counts; provider day-sorted cumulative history. They are local to a
batch and discarded afterward. Stable population moments must avoid cancellation/overflow.
No label object is reachable by the scoring service.

## Dataset and Ground Truth

`claims.json`: 2,000 claim records with exactly 500 members and 50 providers.
`labels.json`: one record per claim with claim_id, is_fraud boolean, and injected_patterns array.
Exactly 200 records have is_fraud=true; other records have an empty injected_patterns array.
`manifest.json`: seed, generator_version, schema_version, mapping_version, dataset_hash,
claim/member/provider totals, per-pattern memberships and injection group references.

Seed is an unsigned 32-bit integer; default 202410. Use a versioned deterministic PRNG, not
Math.random. Allocate 200 intentional fraud IDs with one intentional pattern each,
giving 200 memberships. All intentional membership allocations are disjoint. Support claims do
not become fraud merely because a rule also flags them. Final dataset verification must prove
all intended memberships satisfy the actual rule predicates after every injection.

Phantom injection uses 25 labeled claims plus at least six clean supporting claims on one day.
Weekend injections use prior weekday history and fewer than 5% earlier weekend claims. Schedule
ordinary provider-days below the phantom boundary, space ordinary member/diagnosis visits, and
keep legitimate amounts away from the clustering interval. Use stable procedure cohorts large
enough that injected upcoding remains above the final two-standard-deviation cutoff. Verify
bundle/diagnosis validity except deliberate mismatch cases. Do not regenerate until metrics pass
or relabel incidental flags; preserve and report them. Generator verification may inspect labels,
but the independent detector cannot.

Development and integration tests use the full fixed-seed sample; unit tests use small explicit
boundary fixtures. Tests include another seed and shuffled input to detect hardcoded behavior.

## Evaluation Report

Fields: dataset_hash, configuration_hash, decision_policy, confusion_matrix with tp/fp/tn/fn,
precision, recall, false_positive_rate, counts, scoring_duration_ms, environment, and target status.
Decision policy is `any_flag` by default, equivalent to score > 0; custom policy is
`minimum_score` with finite threshold > 0 and <= 100, using score >= threshold.
Ratios are numbers in [0,1], or null with an undefined_metrics reason when denominator is zero.
Labels must cover exactly the scored claim IDs. Validate finite scores, unique IDs, and full
metadata; threshold changes never change rule results. Empty input is valid and yields null ratios.

## Artifact Lifecycle

Generate and verify -> save immutable claims, labels, manifest -> score claims alone -> save
scored results -> evaluate against labels -> save report. A failed phase must not leave an artifact
marked complete. Write CLI outputs through temporary files followed by rename; refuse existing
output files unless an explicit --force flag is supplied. HTTP requests return artifacts as JSON
and never accept filesystem output paths.

