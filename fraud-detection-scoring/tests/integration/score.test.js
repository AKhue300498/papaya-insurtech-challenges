import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../src/app.js';
import { readJson } from '../../src/artifacts/files.js';
import { serve, post } from '../helpers/http.js';
import { runNode } from '../helpers/process.js';
import { allRuleClaims, withoutTiming } from '../fixtures/claims.js';

test('CLI and HTTP produce equivalent outputs; CLI protects output files', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraud-cli-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'claims.json');
  const output = join(directory, 'scored.json');
  await writeFile(input, JSON.stringify(allRuleClaims()));
  const args = ['src/cli/score.js', '--input', input, '--output', output];
  assert.equal((await runNode(args)).code, 0);
  const url = await serve(createApp(), context);
  const http = await (await post(url, { claims: allRuleClaims() })).json();
  assert.deepEqual(withoutTiming(await readJson(output)), withoutTiming(http));
  const refused = await runNode(args);
  assert.equal(refused.code, 1);
  assert.equal(JSON.parse(refused.stderr).error.code, 'EEXIST');
  assert.equal((await runNode([...args, '--force'])).code, 0);
  const weights = join(directory, 'weights.json');
  await writeFile(weights, JSON.stringify({ amount_clustering: 5 }));
  assert.equal(
    (await runNode([...args, '--weights', weights, '--force'])).code,
    0,
  );
  assert.equal(
    (await readJson(output)).metadata.effective_weights.amount_clustering,
    5,
  );
});

test('CLI reports usage, validation, JSON and I/O errors with proper exit codes', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'fraud-errors-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'claims.json');
  const output = join(directory, 'scored.json');
  const usage = await runNode(['src/cli/score.js']);
  assert.equal(usage.code, 2);
  const unknown = await runNode(['src/cli/score.js', '--unknown']);
  assert.equal(unknown.code, 2);
  await writeFile(input, '[{}]');
  const invalid = await runNode([
    'src/cli/score.js',
    '--input',
    input,
    '--output',
    output,
  ]);
  assert.equal(invalid.code, 2);
  assert.equal(JSON.parse(invalid.stderr).error.code, 'VALIDATION_ERROR');
  await writeFile(input, '{bad');
  assert.equal(
    (await runNode(['src/cli/score.js', '--input', input, '--output', output]))
      .code,
    2,
  );
  assert.equal(
    (
      await runNode([
        'src/cli/score.js',
        '--input',
        join(directory, 'missing'),
        '--output',
        output,
      ])
    ).code,
    1,
  );
});
