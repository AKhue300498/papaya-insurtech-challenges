import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { serve, post } from '../helpers/http.js';
import { claim, allRuleClaims } from '../fixtures/claims.js';

test('configuration and scoring expose stable versioned contracts', async (context) => {
  const url = await serve(createApp(), context);
  const configuration = await (await fetch(`${url}/api/v1/config`)).json();
  assert.equal(configuration.schema_version, '1');
  assert.equal(Object.keys(configuration.weights).length, 8);
  assert.ok(configuration.bundles.length >= 5);
  const response = await post(url, { claims: allRuleClaims() });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schema_version, '1');
  const target = body.results.find((item) => item.claim_id === 'TARGET');
  assert.equal(target.risk_score, 100);
  assert.deepEqual(Object.keys(target).sort(), [
    'claim_id',
    'flags',
    'risk_score',
  ]);
  assert.deepEqual(Object.keys(target.flags[0]).sort(), [
    'evidence',
    'rule',
    'severity',
  ]);
  assert.ok(body.metadata.configuration_hash);
});

test('empty score input and per-request overrides preserve defaults', async (context) => {
  const url = await serve(createApp(), context);
  assert.deepEqual(
    (await (await post(url, { claims: [] })).json()).results,
    [],
  );
  const changed = await (
    await post(url, { claims: [], weights: { upcoding: 1 } })
  ).json();
  const normal = await (await post(url, { claims: [] })).json();
  assert.equal(changed.metadata.effective_weights.upcoding, 1);
  assert.equal(normal.metadata.effective_weights.upcoding, 4);
});

test('invalid inputs return field errors without partial results or label stripping', async (context) => {
  const url = await serve(createApp(), context);
  for (const body of [
    { claims: [claim({ claim_date: '2024-02-30' })] },
    { claims: [claim(), claim()] },
    { claims: [], labels: [] },
    { claims: [claim({ is_fraud: true })] },
    { claims: [], weights: { upcoding: 0 } },
    {
      claims: Array.from({ length: 2001 }, (_, index) =>
        claim({ claim_id: String(index) }),
      ),
    },
    { claims: [], weights: null },
  ]) {
    const response = await post(url, body);
    assert.equal(response.status, 422);
    const error = await response.json();
    assert.equal(error.error.code, 'VALIDATION_ERROR');
    assert.ok(error.error.details.length);
    assert.equal(error.results, undefined);
  }
  const invalid = await (
    await post(url, { claims: [claim({ submitted_amount: -1 })] })
  ).json();
  assert.equal(invalid.error.details[0].path, 'claims.0.submitted_amount');
});
