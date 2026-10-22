import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { errorHandler } from '../../src/api/errors.js';
import { serve } from '../helpers/http.js';

test('health, unknown routes, media types and malformed JSON follow the contract', async (context) => {
  const url = await serve(createApp(), context);
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), {
    status: 'ok',
    schema_version: '1',
  });
  for (const [path, options, status, code] of [
    ['/missing', {}, 404, 'NOT_FOUND'],
    [
      '/api/v1/score',
      { method: 'POST', body: '{}' },
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
    [
      '/api/v1/score',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad',
      },
      400,
      'INVALID_JSON',
    ],
    [
      '/api/v1/score',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload: 'x'.repeat(10 * 1024 * 1024) }),
      },
      413,
      'BODY_TOO_LARGE',
    ],
  ]) {
    const response = await fetch(url + path, options);
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.ok(Array.isArray(body.error.details));
    assert.equal(body.results, undefined);
  }
});

test('unexpected error response omits implementation details', () => {
  let status;
  let body;
  const response = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
    },
  };
  errorHandler(new Error('private stack detail'), {}, response, () => {});
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(body).includes('private'));
});
