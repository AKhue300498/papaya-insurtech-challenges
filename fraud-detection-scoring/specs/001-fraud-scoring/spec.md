# Feature Specification: Fraud Detection Scoring Engine

**Feature Branch**: Not created; no branch hook configured.

**Created**: 2026-10-22

**Status**: Draft

**Input**: Build an application based on `AI_Challenge_10.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prioritize Claims with Evidence (Priority: P1)

An insurance fraud analyst submits a claim collection and receives a ranked list of claims
with risk scores and specific evidence to decide which claims warrant investigation.

**Why this priority**: Explainable prioritization is the application's primary business value.

**Independent Test**: Score a controlled collection with known rule triggers and verify the
ranking, score, and evidence for every claim without using generated fraud labels.

**Acceptance Scenarios**:

1. **Given** valid claims containing each supported fraud pattern, **When** the analyst scores
   them, **Then** every qualifying rule appears with its name, configured severity, and
   claim-specific evidence.
2. **Given** claims triggering several rules, **When** scoring finishes, **Then** all triggered
   rules contribute once each and the ranked results include every input claim exactly once.
3. **Given** an unflagged claim, **When** scored, **Then** it receives score zero and no flags.
4. **Given** malformed claims, **When** submitted, **Then** the analyst receives field-specific
   validation errors and no apparently successful partial scoring result.

---

### User Story 2 - Generate Reproducible Demonstration Data (Priority: P2)

An evaluator generates synthetic claims with known fraud labels to demonstrate coverage of
all eight patterns without exposing real member information.

**Why this priority**: Known examples make the engine's behavior reproducible and measurable.

**Independent Test**: Generate data twice with the same seed and compare claims and labels;
inspect counts, schema, dates, and injected patterns without requiring the scoring engine.

**Acceptance Scenarios**:

1. **Given** a seed, **When** generation completes, **Then** the evaluator receives 2,000 claims,
   200 distinct labeled fraudulent claims, and an injection manifest accounting for every pattern.
2. **Given** the same seed and settings, **When** generation is repeated, **Then** the claims,
   labels, and injection manifest are identical.
3. **Given** the generated collection, **When** inspected, **Then** identifiers, dates,
   weekend indicators, amounts, and procedure lists satisfy the required schema.

---

### User Story 3 - Evaluate and Adjust Scoring (Priority: P3)

An evaluator changes rule weights, compares predictions against known labels, and exports
results with enough context to reproduce the measured quality and processing time.

**Why this priority**: Evaluation demonstrates the challenge targets and supports justified tuning.

**Independent Test**: Evaluate a prepared set of scored claims and labels with known confusion
counts; verify reported metrics independently of data generation and detection.

**Acceptance Scenarios**:

1. **Given** valid revised weights, **When** claims are rescored, **Then** rule triggers remain
   unchanged while scores reflect the documented normalization and revised configuration.
2. **Given** scored claims and matching ground truth, **When** evaluation runs, **Then** the
   report includes confusion counts, precision, recall, false positive rate, and decision threshold.
3. **Given** a completed demonstration, **When** results are saved, **Then** the dataset, labels,
   scored output, metrics, configuration, and reproduction instructions are available for review.

### Edge Cases

- Empty valid input returns an empty ranking; evaluation reports undefined ratios explicitly.
- Missing fields, duplicate claim IDs, invalid dates, non-finite or negative amounts, empty
  procedure lists, unsupported claim types, and inconsistent weekend indicators are rejected.
- Duplicate claims have different claim IDs; all members of a matching duplicate group are flagged.
- Rapid re-submission includes day seven and same-day distinct claims; day eight is excluded.
- Upcoding requires strictly greater than two standard deviations; insufficient samples or zero
  variance produce no upcoding flag and an explicit diagnostic rather than fabricated statistics.
- Phantom billing triggers at 31 claims, not 30; weekend history at exactly 5% does not qualify.
- A provider with no earlier claims has insufficient history and receives no weekend anomaly flag.
- Amounts 47,500 and 49,999 qualify; 47,499 and 50,000 do not. Fractional amounts below 50,000
  and at least 47,500 qualify under the continuous interval assumption.
- Multiple matching procedures produce one flag per rule with evidence covering the matches.
- Equal scores use ascending claim ID as a stable tie-breaker; input ordering cannot affect results.
- Evaluation rejects missing, duplicate, or unexpected label IDs; zero denominators are reported
  as undefined rather than silently presented as successful performance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support generating synthetic data, scoring valid claim collections,
  configuring severity weights, evaluating labeled results, and saving reviewable outputs.
- **FR-002**: Each claim MUST contain unique string `claim_id`, string `member_id`, string
  `provider_id`, string `provider_name`, date `claim_date`, `claim_type` in OUTPATIENT,
  INPATIENT, or DENTAL, string `diagnosis_code`, nonempty string list `procedure_codes`,
  nonnegative finite `submitted_amount`, and boolean `is_weekend` consistent with the date.
- **FR-003**: The demonstration dataset MUST contain 2,000 claims dated 2024-01-01 through
  2024-12-31 inclusive, approximately 500 members and 50 providers, and 200 distinct intentionally
  fraudulent claims. It MUST record 30 duplicate, 30 rapid re-submission, 30 upcoding,
  25 unbundling, 25 phantom billing, 20 weekend anomaly, 20 mismatch, and 20 clustering
  injections across 200 distinct claims with one intentional pattern per labeled fraud claim.
- **FR-004**: Duplicate detection MUST flag claims sharing member, provider, date, and diagnosis
  with another claim and identify the related claim IDs in evidence.
- **FR-005**: Rapid re-submission MUST flag a claim when another claim for the same member and
  diagnosis occurs on the same date or within the preceding seven calendar days. Evidence MUST
  identify the related claims and elapsed days. Provider changes MUST NOT prevent detection.
- **FR-006**: Upcoding MUST flag a claim if its submitted amount exceeds the procedure cohort
  mean plus twice the population standard deviation for any listed procedure. Each cohort MUST
  consist of submitted amounts of claims in the input collection containing that procedure,
  counting a claim once per procedure and including the evaluated claim. At least two cohort
  claims and positive variance are required. Evidence MUST state procedure, amount, mean,
  standard deviation, and deviation distance.
- **FR-007**: Unbundling MUST use a supplied mapping of at least five bundles to component
  procedures, flagging claims containing all components of a mapped bundle without its bundle
  code. Evidence MUST identify the component procedures and available bundle.
- **FR-008**: Phantom billing MUST flag every claim in a provider-date group containing more
  than 30 claims and include provider, date, and daily count in evidence.
- **FR-009**: Weekend anomaly MUST flag weekend claims containing a designated surgical
  procedure when fewer than 5% of that provider's earlier-dated claims occurred on weekends.
  History MUST exclude the evaluated day and future dates. Evidence MUST include the procedure,
  date, historical total, weekend count, and percentage; absent history MUST be reported separately.
- **FR-010**: Diagnosis-procedure mismatch MUST use a supplied mapping of at least ten valid
  diagnosis-procedure pairs and flag any procedure not allowed for the claim diagnosis.
  Evidence MUST identify the diagnosis and offending procedures. Unknown codes MUST be flagged
  as unsupported by the demonstration mapping, without asserting a clinical conclusion.
- **FR-011**: Amount clustering MUST flag amounts at least 47,500 and below 50,000, including
  fractional amounts. Evidence MUST state amount, threshold, and percentage of threshold.
- **FR-012**: Each rule MUST have an independently configurable integer severity weight from
  1 through 5. Documentation MUST justify defaults. Invalid weights MUST be rejected.
- **FR-013**: Risk score MUST equal 100 multiplied by the sum of triggered rule weights divided
  by the sum of all eight configured weights, rounded to two decimal places. Rules MUST contribute
  at most once per claim; all returned scores MUST be finite and within 0-100.
- **FR-014**: Results MUST rank claims by descending score and ascending claim ID for ties.
  Each result MUST contain `claim_id`, `risk_score`, and `flags`; each flag MUST contain `rule`,
  `severity`, and actionable `evidence`. Flag ordering MUST be stable in the eight-rule order above.
- **FR-015**: Evaluation MUST default to predicting fraud when risk score is greater than zero.
  An optional minimum positive score threshold MUST be configurable and recorded; when supplied,
  scores equal to or greater than it are positive. Evaluation MUST report TP, FP, TN, FN,
  precision as TP/(TP+FP), recall as TP/(TP+FN), and FPR as FP/(FP+TN).
- **FR-016**: Ground-truth labels and injection annotations MUST be separate from scoring inputs
  and MUST NOT influence rule decisions, cohort statistics, or scores. Generation MUST preserve
  intended patterns in the final collection and document incidental flags without relabeling them
  as intentional fraud merely to improve reported metrics.
- **FR-017**: Reproduction artifacts MUST include the seed, dataset identity, rule mappings,
  weights, prediction threshold, measured scoring duration, and execution environment. Timing
  MUST cover validation, detection, scoring, and ranking, excluding generation and report export.
- **FR-018**: Invalid inputs MUST produce actionable errors without silent correction or partial
  success. Insufficient statistical history MUST be distinguishable from malformed data.
- **FR-019**: Delivery documentation MUST provide setup and execution instructions, justified
  weights, assumptions, and an implementation timeline estimate. The dataset, scored output,
  and metrics report MUST be included in the repository submission.

### Key Entities *(include if feature involves data)*

- **Claim**: A member's dated submission to a provider, with diagnosis, procedures, amount,
  claim type, and derived weekend status.
- **Rule Configuration**: The eight rule identities, severity weights, bundle mappings,
  valid diagnosis-procedure pairs, and surgical procedure catalog.
- **Flag**: A triggered rule's configured severity and claim-specific evidence.
- **Scored Claim**: A claim identifier, normalized risk score, and ordered flags.
- **Ground Truth**: A claim's intentional fraud status and injected pattern memberships,
  available exclusively for dataset verification and evaluation.
- **Evaluation Report**: Dataset and configuration identity, prediction threshold, confusion
  counts, metrics, scoring duration, and reproduction context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An evaluator can produce and inspect 2,000 schema-valid synthetic claims with
  200 distinct intentional fraud labels and all specified injection counts accounted for.
- **SC-002**: Controlled acceptance examples for each of the eight rules produce the expected
  flags and evidence; all negative and boundary examples avoid their respective flags.
- **SC-003**: On the delivered dataset at the reported decision threshold, recall is at least
  70% and false positive rate is at most 20%; precision and confusion counts are also reported.
- **SC-004**: An analyst receives the complete ranking of 2,000 claims in under 30 seconds
  on the recorded execution environment, using the timing scope defined in FR-017.
- **SC-005**: Every scored claim has a score within 0-100, and every flag contains the
  specific observed values and comparison responsible for the finding.
- **SC-006**: Repeating generation and scoring with identical seed, data, and configuration
  produces identical claims, labels, scores, flags, and ranking, excluding timing metadata.
- **SC-007**: A reviewer can reproduce generation, scoring, and evaluation from delivered
  instructions and artifacts without reconstructing undocumented settings.

## Assumptions

- The initial application serves a single local analyst or challenge evaluator. Batch generation,
  scoring, reviewable results, and evaluation define scope; a browser interface, authentication,
  production claims ingestion, and automated claim rejection are not required.
- The challenge is authoritative. Its eight pattern counts sum to 200 intentional
  memberships across 200 distinct fraudulent claims; incidental detection is assessed through
  the confusion matrix. Phantom billing groups may include nonfraudulent supporting claims.
- Approximately 500 members means 450-550 distinct members; approximately 50 providers means
  45-55 distinct providers in the demonstration dataset.
- Statistical cohorts use the submitted collection because no external baseline dataset is
  supplied. Whole-claim amounts are compared for each listed procedure because line-item prices
  are absent. This is a demonstration assumption, documented as a limitation.
- Weekend history means all earlier-dated claims in the supplied collection; weekends are
  Saturdays and Sundays, and dates have calendar-day precision without time-zone conversion.
- Currency is unspecified; all amounts share a single unit. The stated 47,500-49,999 range is
  interpreted as at least 47,500 and strictly below 50,000 when fractional amounts are allowed.
- Clinical mappings and the surgical catalog are curated synthetic demonstration references,
  not medical advice or production clinical validation. No external service is required.
- At least 15 unit tests and the constitution's clean-code, robustness, reproducibility, and
  prohibition on code comments and explanatory docstrings remain delivery constraints.
- Publishing to GitHub is a submission step; specification generation does not publish changes.

