# Repository Guidelines

## Project Structure & Module Organization

This directory currently contains the challenge specification and Spec Kit scaffolding; application code has not been added.

- `AI_Challenge_10.md`: authoritative requirements for the fraud scoring engine, dataset, metrics, and submission.
- `.specify/`: PowerShell workflow scripts, document templates, and project memory. The constitution is currently an unfilled template.
- `.agents/skills/`: local Spec Kit workflow instructions.

When introducing implementation, keep detection rules, scoring, dataset generation, and evaluation in separate modules. Place automated tests in a dedicated `tests/` directory and document dataset and output locations in a README.

## Build, Test, and Development Commands

No application runtime, package manifest, build command, test runner, or formatter is configured yet. Do not assume `npm test` or `pytest` is available. Add exact installation, generation, scoring, and test commands to the README when selecting the stack.

From this directory, use `Get-Content AI_Challenge_10.md` to review requirements and `rg --files --hidden` to inspect files, including workflow scaffolding. Run `git status --short` before committing; this directory belongs to a parent Git repository, so stage only intended changes.

## Coding Style & Naming Conventions

Follow the chosen language's standard indentation and formatter consistently; record those choices with the implementation. Use descriptive rule names such as `duplicate_claim` and `amount_clustering`. Preserve specified output fields, including `claim_id`, `risk_score`, `flags`, `severity`, and `evidence`. Keep severity weights configurable and explain their rationale. Each flag must contain concrete evidence.

## Testing Guidelines

The challenge requires at least 15 unit tests covering individual rules and edge cases. No testing framework or coverage percentage is currently mandated. Cover all eight rules, threshold boundaries, score normalization, and overlapping flags. Use descriptive test names that state the condition and expected result.

Validate against known synthetic fraud labels: recall must reach at least 70%, false positive rate must stay at or below 20%, and processing 2,000 claims must finish in under 30 seconds. Report precision as well.

## Commit & Pull Request Guidelines

Available Git history contains plain descriptive subjects, with no established prefix convention. Write concise, action-oriented commit messages. In pull requests, explain the change, reference relevant requirements or issues, and include validation commands and results. Changes affecting scoring should include metric comparisons. Deliver the dataset, scored output, and metrics report required by the challenge; use synthetic data only.
