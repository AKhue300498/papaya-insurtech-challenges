import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { serve } from '../helpers/http.js';
import { preparedEvaluation, emptyEvaluation } from '../fixtures/evaluation.js';

function evaluate(url, body) {
  return fetch(`${url}/api/v1/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('evaluate endpoint accepts prepared scored artifacts and returns metrics despite target misses', async (context) => {
  const url = await serve(createApp(), context);
  const response = await evaluate(url, preparedEvaluation());
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.schema_version, '1');
  assert.deepEqual(report.confusion_matrix, { tp: 1, fp: 1, tn: 1, fn: 1 });
  assert.equal(report.targets.all_passed, false);
  const threshold = await (
    await evaluate(url, { ...preparedEvaluation(), minimum_score: 13.79 })
  ).json();
  assert.equal(threshold.false_positive_rate, 0);
  const empty = await (await evaluate(url, emptyEvaluation())).json();
  assert.equal(empty.recall, null);
  assert.equal(empty.undefined_metrics.length, 3);
});

test('evaluate endpoint returns actionable errors on invalid scores labels and thresholds', async (context) => {
  const url = await serve(createApp(), context);
  const invalid = preparedEvaluation();
  invalid.scored.results[0].risk_score = 101;
  for (const body of [
    invalid,
    { ...preparedEvaluation(), minimum_score: 0 },
    { ...preparedEvaluation(), labels: [] },
    { ...preparedEvaluation(), output: 'unsafe' },
    null,
  ]) {
    const response = await evaluate(url, body);
    assert.equal(response.status, 422);
    const output = await response.json();
    assert.equal(output.error.code, 'VALIDATION_ERROR');
    assert.ok(output.error.details.length);
    assert.equal(output.precision, undefined);
  }
  const response = await evaluate(url, invalid);
  assert.ok(
    (await response.json()).error.details.some(
      (detail) => detail.path === 'scored.results.0.risk_score',
    ),
  );
});
