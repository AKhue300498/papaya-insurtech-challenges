import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreClaims } from '../../src/domain/score.js';
import { ruleIds } from '../../src/validation/config.js';
import {
  claim,
  allRuleClaims,
  independentClaims,
  withoutTiming,
} from '../fixtures/claims.js';

test('a clean claim scores zero with no flags; empty input returns empty results', () => {
  assert.equal(scoreClaims({ claims: [claim()] }).results[0].risk_score, 0);
  assert.deepEqual(scoreClaims({ claims: [] }).results, []);
});

test('all rules contribute once with canonical flag order and a score of 100', () => {
  const output = scoreClaims({ claims: allRuleClaims() });
  const target = output.results.find((item) => item.claim_id === 'TARGET');
  assert.equal(target.risk_score, 100);
  assert.deepEqual(
    target.flags.map((item) => item.rule),
    ruleIds,
  );
  assert.ok(target.flags.every((flag) => flag.evidence.length > 20));
});

test('single trigger normalizes against all eight weights and rounds to two decimals', () => {
  const result = scoreClaims({ claims: [claim({ submitted_amount: 49500 })] })
    .results[0];
  assert.equal(result.risk_score, 6.9);
  assert.equal(result.flags[0].severity, 2);
});

test('weight overrides affect scores but never triggers and do not mutate defaults', () => {
  const input = { claims: allRuleClaims() };
  const baseline = scoreClaims(input);
  const changed = scoreClaims({ ...input, weights: { duplicate_claim: 1 } });
  const flags = (output) =>
    Object.fromEntries(
      output.results.map((item) => [
        item.claim_id,
        item.flags.map((flag) => [flag.rule, flag.evidence]),
      ]),
    );
  assert.deepEqual(flags(baseline), flags(changed));
  assert.notDeepEqual(
    baseline.results.map((item) => item.risk_score),
    changed.results.map((item) => item.risk_score),
  );
  assert.equal(
    scoreClaims(input).metadata.effective_weights.duplicate_claim,
    5,
  );
});

test('shuffling claims and procedures preserves scores evidence diagnostics and hashes', () => {
  const claims = allRuleClaims();
  const reversed = claims.toReversed().map((item) => ({
    ...item,
    procedure_codes: item.procedure_codes.toReversed(),
  }));
  assert.deepEqual(
    withoutTiming(scoreClaims({ claims })),
    withoutTiming(scoreClaims({ claims: reversed })),
  );
});

test('ties use ascending code-point claim IDs and inputs are not mutated', () => {
  const claims = ['a', 'Z', 'A'].map((id) =>
    claim({ claim_id: id, member_id: id }),
  );
  const snapshot = structuredClone(claims);
  assert.deepEqual(
    scoreClaims({ claims }).results.map((item) => item.claim_id),
    ['A', 'Z', 'a'],
  );
  assert.deepEqual(claims, snapshot);
});

test('metadata records finite timing provenance and stable configuration hashes', () => {
  const { metadata } = scoreClaims({ claims: [claim()] });
  assert.equal(metadata.schema_version, '1');
  assert.match(metadata.dataset_hash, /^[a-f0-9]{64}$/);
  assert.match(metadata.configuration_hash, /^[a-f0-9]{64}$/);
  assert.equal(metadata.mapping_version, 'synthetic-1');
  assert.ok(
    Number.isFinite(metadata.scoring_duration_ms) &&
      metadata.scoring_duration_ms >= 0,
  );
  assert.ok(metadata.environment.node);
});

test('score boundary rejects malformed requests and label leakage', () => {
  for (const input of [
    null,
    [],
    { claims: [claim()], labels: [] },
    { claims: [claim({ injected_patterns: [] })] },
    { claims: [claim()], weights: { upcoding: 6 } },
  ])
    assert.throws(() => scoreClaims(input), { code: 'VALIDATION_ERROR' });
});

test('2000 controlled claims complete within the challenge budget without nonfinite scores', () => {
  const output = scoreClaims({
    claims: independentClaims(2000, { submitted_amount: 1_000_000_000 }),
  });
  assert.equal(output.results.length, 2000);
  assert.ok(output.metadata.scoring_duration_ms < 30000);
  assert.ok(output.results.every((item) => Number.isFinite(item.risk_score)));
});
