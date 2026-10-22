import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScores } from '../../src/evaluation/evaluate.js';
import { preparedEvaluation, emptyEvaluation } from '../fixtures/evaluation.js';

test('prepared scores yield independently known confusion counts and metrics', () => {
  const input = preparedEvaluation();
  const before = structuredClone(input);
  const report = evaluateScores(input);
  assert.deepEqual(report.confusion_matrix, { tp: 1, fp: 1, tn: 1, fn: 1 });
  assert.equal(report.precision, 0.5);
  assert.equal(report.recall, 0.5);
  assert.equal(report.false_positive_rate, 0.5);
  assert.deepEqual(report.counts, {
    claims: 4,
    actual_fraud: 2,
    actual_clean: 2,
    predicted_fraud: 2,
    predicted_clean: 2,
  });
  assert.deepEqual(report.decision_policy, {
    mode: 'any_flag',
    comparison: '>',
    threshold: 0,
  });
  assert.equal(report.targets.all_passed, false);
  assert.deepEqual(report.undefined_metrics, []);
  assert.deepEqual(input, before);
});

test('custom minimum threshold includes equality and changes predictions only', () => {
  const input = { ...preparedEvaluation(), minimum_score: 13.79 };
  const before = structuredClone(input.scored);
  const report = evaluateScores(input);
  assert.deepEqual(report.confusion_matrix, { tp: 1, fp: 0, tn: 2, fn: 1 });
  assert.equal(report.precision, 1);
  assert.equal(report.decision_policy.comparison, '>=');
  assert.equal(report.decision_policy.threshold, 13.79);
  assert.deepEqual(input.scored, before);
  const above = evaluateScores({ ...input, minimum_score: 13.8 });
  assert.deepEqual(above.confusion_matrix, { tp: 0, fp: 0, tn: 2, fn: 2 });
  assert.equal(above.precision, null);
});

test('empty evaluation has explicit undefined ratios and cannot pass quality targets', () => {
  const report = evaluateScores(emptyEvaluation());
  assert.deepEqual(report.confusion_matrix, { tp: 0, fp: 0, tn: 0, fn: 0 });
  assert.equal(report.precision, null);
  assert.equal(report.recall, null);
  assert.equal(report.false_positive_rate, null);
  assert.equal(report.undefined_metrics.length, 3);
  assert.ok(report.undefined_metrics.every((entry) => entry.reason.length > 0));
  assert.equal(report.targets.recall.passed, null);
  assert.equal(report.targets.all_passed, false);
});

test('all-clean and all-fraud batches report the correct undefined denominator', () => {
  const clean = preparedEvaluation();
  clean.labels = clean.labels.map((label) => ({
    ...label,
    is_fraud: false,
    injected_patterns: [],
  }));
  assert.equal(evaluateScores(clean).recall, null);
  const fraud = preparedEvaluation();
  fraud.labels = fraud.labels.map((label) => ({
    ...label,
    is_fraud: true,
    injected_patterns: ['upcoding'],
  }));
  assert.equal(evaluateScores(fraud).false_positive_rate, null);
});

test('reported provenance and source timing are preserved without detector invocation', () => {
  const input = preparedEvaluation();
  const report = evaluateScores(input);
  for (const name of [
    'dataset_hash',
    'configuration_hash',
    'effective_weights',
    'mapping_version',
    'scoring_duration_ms',
    'environment',
  ])
    assert.deepEqual(report[name], input.scored.metadata[name]);
  assert.equal(report.schema_version, '1');
  input.scored.metadata.scoring_duration_ms = 30000;
  assert.equal(evaluateScores(input).targets.scoring_duration_ms.passed, false);
  input.scored.metadata.scoring_duration_ms = 29999.99;
  assert.equal(evaluateScores(input).targets.scoring_duration_ms.passed, true);
});

test('evaluation labels must exactly cover the scored IDs, regardless of label order', () => {
  const input = preparedEvaluation();
  assert.deepEqual(
    evaluateScores({ ...input, labels: input.labels.toReversed() }),
    evaluateScores(input),
  );
  for (const labels of [
    input.labels.slice(1),
    [...input.labels, input.labels[0]],
    input.labels.map((label, index) =>
      index ? label : { ...label, claim_id: 'unexpected' },
    ),
  ])
    assert.throws(() => evaluateScores({ ...input, labels }), {
      code: 'VALIDATION_ERROR',
    });
});

for (const threshold of [0, -1, 100.01, Infinity, NaN, null, '10']) {
  test(`invalid threshold ${String(threshold)} is rejected`, () =>
    assert.throws(
      () =>
        evaluateScores({ ...preparedEvaluation(), minimum_score: threshold }),
      { code: 'VALIDATION_ERROR' },
    ));
}

test('malformed scores flags provenance and unknown fields are rejected', () => {
  const mutations = [
    (input) => {
      input.scored.results[0].risk_score = Infinity;
    },
    (input) => {
      input.scored.results[0].risk_score = -1;
    },
    (input) => {
      input.scored.results[0].risk_score = 101;
    },
    (input) => {
      input.scored.results[0].risk_score = 50;
    },
    (input) => {
      input.scored.results[0].claim_id = 'FP';
    },
    (input) => {
      input.scored.results[0].flags.push(input.scored.results[0].flags[0]);
    },
    (input) => {
      input.scored.results[0].flags[0].severity = 5;
    },
    (input) => {
      input.scored.results[0].flags[0].rule = 'unknown';
    },
    (input) => {
      input.scored.results[0].flags[0].evidence = '';
    },
    (input) => {
      delete input.scored.metadata.environment;
    },
    (input) => {
      input.scored.metadata.scoring_duration_ms = -1;
    },
    (input) => {
      input.scored.metadata.dataset_hash = 'not-a-hash';
    },
    (input) => {
      input.scored.metadata.effective_weights.upcoding = 0;
    },
    (input) => {
      input.scored.results.reverse();
    },
    (input) => {
      input.scored.diagnostics.push({
        claim_id: 'missing',
        rule: 'upcoding',
        code: 'NO_DATA',
        message: 'Absent',
      });
    },
    (input) => {
      input.output = 'path';
    },
  ];
  for (const mutate of mutations) {
    const input = preparedEvaluation();
    mutate(input);
    assert.throws(() => evaluateScores(input), { code: 'VALIDATION_ERROR' });
  }
});
