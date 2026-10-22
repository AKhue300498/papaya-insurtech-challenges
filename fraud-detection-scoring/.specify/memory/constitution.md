<!--
Sync Impact Report (temporary; remove before committing)
Version change: unratified scaffold -> 1.0.0 (initial adoption)
Modified principles: five unnamed slots replaced with Clean Design, Self-Explanatory Code,
Robust Boundaries, Verified Correctness, and Reproducible Scoring.
Added sections: Quality Constraints; Development Workflow.
Removed sections: none; template placeholders and examples replaced.
Follow-up TODOs: none.
-->
# Fraud Detection Scoring Constitution

## Core Principles

### I. Clean Design

Code MUST use descriptive domain names, focused functions, and explicit interfaces.
Detection rules, scoring, data generation, and evaluation MUST have separate responsibilities.
Changes MUST avoid unused code, duplicated business logic, and abstractions without a current use.
These constraints keep fraud decisions understandable and independently testable.

### II. Self-Explanatory Code

Application code and tests MUST contain no comments, explanatory docstrings, or embedded prose
explaining implementation. Contributors MUST express intent through names, types, structure,
and descriptive tests. Design explanations, setup instructions, and weight justifications MUST
live in Markdown documentation outside code. Runtime evidence and error messages MUST remain
specific and actionable because they are required program output.

### III. Robust Boundaries

External claim data and configuration MUST be validated before scoring. Invalid dates, missing
required fields, invalid amounts, and severity weights outside 1-5 MUST produce explicit errors.
Code MUST handle empty inputs, insufficient statistical samples, and zero variance without
unhandled failures or non-finite scores. Failures MUST NOT be silently converted into valid results.

### IV. Verified Correctness

The implementation MUST include at least 15 unit tests covering all eight detection rules and
edge cases. Tests MUST exercise threshold boundaries, overlapping flags, score normalization,
and invalid inputs. Regression fixes MUST include tests reproducing the defect. Relevant tests
MUST pass before a change is accepted; assertions MUST verify observable behavior.

### V. Reproducible Scoring

Identical input data and configuration MUST yield identical scores, flags, and ranking,
including deterministic tie handling. Synthetic dataset generation MUST accept a reproducible
seed. Each triggered rule MUST provide claim-specific evidence. Scores MUST remain within
0-100, severity weights MUST be configurable, and evaluation labels MUST NOT influence detection.

## Quality Constraints

The implementation MUST satisfy `AI_Challenge_10.md`, including all eight detection rules,
required clinical mappings, and submission artifacts. Evaluation MUST report precision, recall,
and false positive rate against known synthetic labels. Acceptance requires at least 70% recall,
at most 20% false positive rate, and processing 2,000 claims in under 30 seconds.
Metric and timing reports MUST identify the dataset, configuration, and execution environment.

The selected stack MUST have a documented formatter and lint command. Contributors MUST apply
consistent language-standard formatting and resolve relevant lint findings before acceptance.
No specific language or framework is mandated by this constitution.

## Development Workflow

Before implementation, contributors MUST map changes to challenge requirements and identify
observable acceptance criteria. Each change MUST remain focused and include applicable tests
and updates to external documentation. Reviews MUST check code clarity, absence of explanatory
comments, input validation, deterministic behavior, and relevant test results.

Changes to rules or weights MUST include metric comparisons and documented rationale outside
code. Changes affecting processing cost MUST include a timing check against the stated limit.
Dataset generation, scoring, testing, and evaluation commands MUST be documented when introduced.

## Governance

This constitution governs project implementation and review. Amendments MUST record the reason,
affected principles, compatibility impact, and any migration work in the change description.
Every plan and implementation review MUST check compliance; deviations MUST be resolved through
an explicit constitution amendment before acceptance.

Versions follow semantic versioning: MAJOR for incompatible principle changes or removals,
MINOR for new principles or materially expanded guidance, and PATCH for clarifications without
behavioral changes. Amendments MUST update the version and last-amended date while preserving
the original ratification date. The temporary Sync Impact Report MUST be removed before commit.

**Version**: 1.0.0 | **Ratified**: 2026-10-22 | **Last Amended**: 2026-10-22
