import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { serve, post } from '../helpers/http.js';

function generate(url, body) {
  return fetch(`${url}/api/v1/datasets/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('generation endpoint returns deterministic versioned artifacts and an isolated score input', async (context) => {
  const url = await serve(createApp(), context);
  const response = await generate(url, {});
  assert.equal(response.status, 200);
  const sample = await response.json();
  assert.deepEqual(Object.keys(sample).sort(), [
    'claims',
    'labels',
    'manifest',
    'schema_version',
  ]);
  assert.equal(sample.manifest.seed, 202410);
  assert.equal(sample.claims.length, 2000);
  assert.equal(sample.labels.filter((label) => label.is_fraud).length, 200);
  assert.deepEqual(
    await (await generate(url, { seed: 202410 })).json(),
    sample,
  );
  assert.equal((await post(url, sample)).status, 422);
  assert.equal((await post(url, { claims: sample.claims })).status, 200);
});

test('generation endpoint rejects invalid seeds and server filesystem paths', async (context) => {
  const url = await serve(createApp(), context);
  for (const body of [
    { seed: -1 },
    { seed: '1' },
    { seed: 1.1 },
    { seed: 4294967296 },
    { seed: null },
    { seed: 0, out: 'data' },
    { claims: [] },
    null,
  ]) {
    const response = await generate(url, body);
    assert.equal(response.status, 422);
    const output = await response.json();
    assert.equal(output.error.code, 'VALIDATION_ERROR');
    assert.equal(output.claims, undefined);
  }
});
