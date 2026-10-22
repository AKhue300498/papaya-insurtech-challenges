import { resolveConfig } from '../../src/config.js';
import { hash } from '../../src/artifacts/canonical.js';

export function preparedEvaluation() {
  const configuration = resolveConfig();
  return {
    scored: {
      schema_version: '1',
      results: [
        {
          claim_id: 'TP',
          risk_score: 13.79,
          flags: [
            {
              rule: 'upcoding',
              severity: 4,
              evidence:
                'Prepared outlier with amount 90000 above cohort cutoff 40000',
            },
          ],
        },
        {
          claim_id: 'FP',
          risk_score: 6.9,
          flags: [
            {
              rule: 'amount_clustering',
              severity: 2,
              evidence: 'Prepared amount 49500 is below the threshold 50000',
            },
          ],
        },
        { claim_id: 'FN', risk_score: 0, flags: [] },
        { claim_id: 'TN', risk_score: 0, flags: [] },
      ],
      diagnostics: [],
      metadata: {
        schema_version: '1',
        dataset_hash: hash('prepared-evaluation'),
        configuration_hash: hash(configuration),
        effective_weights: { ...configuration.weights },
        mapping_version: configuration.mapping_version,
        scoring_duration_ms: 12.5,
        environment: {
          node: 'v24.19.0',
          platform: 'win32',
          architecture: 'x64',
        },
      },
    },
    labels: [
      { claim_id: 'TP', is_fraud: true, injected_patterns: ['upcoding'] },
      { claim_id: 'FP', is_fraud: false, injected_patterns: [] },
      { claim_id: 'TN', is_fraud: false, injected_patterns: [] },
      { claim_id: 'FN', is_fraud: true, injected_patterns: ['upcoding'] },
    ],
  };
}

export function emptyEvaluation() {
  const input = preparedEvaluation();
  input.scored.results = [];
  input.labels = [];
  return input;
}
