import { parse } from '../errors.js';
import { evaluationSchema } from '../validation/evaluation.js';

export function evaluateScores(input) {
  const { scored, labels, minimum_score } = parse(evaluationSchema, input);
  const truth = new Map(
    labels.map((label) => [label.claim_id, label.is_fraud]),
  );
  const confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const result of scored.results) {
    const predicted =
      minimum_score === undefined
        ? result.risk_score > 0
        : result.risk_score >= minimum_score;
    if (truth.get(result.claim_id)) confusion[predicted ? 'tp' : 'fn']++;
    else confusion[predicted ? 'fp' : 'tn']++;
  }
  const undefinedMetrics = [];
  function ratio(metric, numerator, denominator, reason) {
    if (denominator > 0) return numerator / denominator;
    undefinedMetrics.push({ metric, reason });
    return null;
  }
  const { tp, fp, tn, fn } = confusion;
  const precision = ratio(
    'precision',
    tp,
    tp + fp,
    'No claims were predicted fraudulent (TP + FP is zero)',
  );
  const recall = ratio(
    'recall',
    tp,
    tp + fn,
    'No ground-truth fraudulent claims (TP + FN is zero)',
  );
  const falsePositiveRate = ratio(
    'false_positive_rate',
    fp,
    fp + tn,
    'No ground-truth clean claims (FP + TN is zero)',
  );
  const targets = {
    recall: { minimum: 0.7, passed: recall === null ? null : recall >= 0.7 },
    false_positive_rate: {
      maximum: 0.2,
      passed: falsePositiveRate === null ? null : falsePositiveRate <= 0.2,
    },
    scoring_duration_ms: {
      maximum_exclusive: 30000,
      passed: scored.metadata.scoring_duration_ms < 30000,
    },
  };
  const allPassed = Object.values(targets).every(
    (target) => target.passed === true,
  );
  return {
    schema_version: '1',
    dataset_hash: scored.metadata.dataset_hash,
    configuration_hash: scored.metadata.configuration_hash,
    effective_weights: scored.metadata.effective_weights,
    mapping_version: scored.metadata.mapping_version,
    decision_policy:
      minimum_score === undefined
        ? { mode: 'any_flag', comparison: '>', threshold: 0 }
        : { mode: 'minimum_score', comparison: '>=', threshold: minimum_score },
    confusion_matrix: confusion,
    precision,
    recall,
    false_positive_rate: falsePositiveRate,
    undefined_metrics: undefinedMetrics,
    counts: {
      claims: scored.results.length,
      actual_fraud: tp + fn,
      actual_clean: tn + fp,
      predicted_fraud: tp + fp,
      predicted_clean: tn + fn,
    },
    scoring_duration_ms: scored.metadata.scoring_duration_ms,
    environment: scored.metadata.environment,
    targets: { ...targets, all_passed: allPassed },
  };
}
