import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../../src/generation/generate.js';
import { scoreClaims } from '../../src/domain/score.js';
import { evaluateScores } from '../../src/evaluation/evaluate.js';
import { withoutTiming } from '../fixtures/claims.js';

function triggers(scored) {
  return Object.fromEntries(
    scored.results.map((result) => [
      result.claim_id,
      result.flags.map((flag) => [flag.rule, flag.evidence]),
    ]),
  );
}

test('generation scoring and evaluation are repeatable across shuffled inputs and another seed', () => {
  for (const seed of [202410, 7]) {
    const first = generateDataset({ seed });
    const repeated = generateDataset({ seed });
    assert.deepEqual(first, repeated);
    const scored = scoreClaims({ claims: first.claims });
    const shuffled = scoreClaims({ claims: repeated.claims.toReversed() });
    assert.deepEqual(withoutTiming(scored), withoutTiming(shuffled));
    const report = evaluateScores({ scored, labels: first.labels });
    const reordered = evaluateScores({
      scored,
      labels: first.labels.toReversed(),
    });
    assert.deepEqual(report, reordered);
    assert.equal(report.targets.all_passed, true);
  }
});

test('weight changes preserve triggers and any-flag predictions while changing normalized scores', () => {
  const sample = generateDataset();
  const normal = scoreClaims({ claims: sample.claims });
  const changed = scoreClaims({
    claims: sample.claims,
    weights: { duplicate_claim: 1, amount_clustering: 5 },
  });
  assert.deepEqual(triggers(normal), triggers(changed));
  assert.notEqual(
    normal.metadata.configuration_hash,
    changed.metadata.configuration_hash,
  );
  const changedById = new Map(
    changed.results.map((result) => [result.claim_id, result.risk_score]),
  );
  assert.ok(
    normal.results.some(
      (result) => result.risk_score !== changedById.get(result.claim_id),
    ),
  );
  assert.deepEqual(
    evaluateScores({ scored: normal, labels: sample.labels }).confusion_matrix,
    evaluateScores({ scored: changed, labels: sample.labels }).confusion_matrix,
  );
});
