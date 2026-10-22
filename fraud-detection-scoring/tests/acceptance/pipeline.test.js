import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '../../src/artifacts/files.js';
import { scoreClaims } from '../../src/domain/score.js';
import { evaluateScores } from '../../src/evaluation/evaluate.js';

test('delivered sample meets recall false-positive and full-batch scoring time targets', () => {
  return Promise.all(
    ['claims', 'labels', 'manifest'].map((name) =>
      readJson(new URL(`../../data/sample/${name}.json`, import.meta.url)),
    ),
  ).then(([claims, labels, manifest]) => {
    const truth = structuredClone(labels);
    const scored = scoreClaims({ claims });
    const report = evaluateScores({ scored, labels });
    assert.equal(scored.results.length, 2000);
    assert.equal(
      new Set(scored.results.map((result) => result.claim_id)).size,
      2000,
    );
    assert.equal(report.counts.actual_fraud, 200);
    assert.equal(report.counts.actual_clean, 1800);
    assert.equal(report.dataset_hash, manifest.dataset_hash);
    assert.equal(report.decision_policy.mode, 'any_flag');
    assert.ok(report.recall >= 0.7, `Recall: ${report.recall}`);
    assert.ok(
      report.false_positive_rate <= 0.2,
      `FPR: ${report.false_positive_rate}`,
    );
    assert.ok(
      report.precision !== null &&
        report.precision >= 0 &&
        report.precision <= 1,
    );
    assert.ok(scored.metadata.scoring_duration_ms < 30000);
    assert.equal(report.targets.all_passed, true);
    assert.deepEqual(labels, truth);
    assert.equal(
      Object.values(report.confusion_matrix).reduce(
        (sum, value) => sum + value,
        0,
      ),
      2000,
    );
  });
});
