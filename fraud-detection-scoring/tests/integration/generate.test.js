import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateDataset } from '../../src/generation/generate.js';
import { scoreClaims } from '../../src/domain/score.js';
import { readJson } from '../../src/artifacts/files.js';
import { createApp } from '../../src/app.js';
import { serve } from '../helpers/http.js';
import { runNode } from '../helpers/process.js';
import { withoutTiming } from '../fixtures/claims.js';

async function temporary(context) {
  const directory = await mkdtemp(join(tmpdir(), 'fraud-generator-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('CLI and HTTP reproduce the same three artifacts and refuse implicit overwrite', async (context) => {
  const directory = await temporary(context);
  const args = ['src/cli/generate.js', '--out', directory, '--seed', '202410'];
  assert.equal((await runNode(args)).code, 0);
  const url = await serve(createApp(), context);
  const response = await fetch(`${url}/api/v1/datasets/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"seed":202410}',
  });
  const sample = await response.json();
  for (const name of ['claims', 'labels', 'manifest'])
    assert.deepEqual(
      await readJson(join(directory, `${name}.json`)),
      sample[name],
    );
  const before = await readFile(join(directory, 'claims.json'), 'utf8');
  const refused = await runNode(args);
  assert.equal(refused.code, 2);
  assert.equal(JSON.parse(refused.stderr).error.code, 'OUTPUT_EXISTS');
  assert.equal(await readFile(join(directory, 'claims.json'), 'utf8'), before);
  assert.equal((await runNode([...args, '--force'])).code, 0);
  assert.equal(await readFile(join(directory, 'claims.json'), 'utf8'), before);
});

test('CLI rejects malformed seed strings, missing arguments and incomplete output safely', async (context) => {
  const directory = await temporary(context);
  for (const seed of ['-1', '1.5', '1e2', '0x10', '', '4294967296', 'abc']) {
    const result = await runNode([
      'src/cli/generate.js',
      '--out',
      directory,
      '--seed',
      seed,
    ]);
    assert.equal(result.code, 2);
  }
  assert.equal((await runNode(['src/cli/generate.js'])).code, 2);
  assert.deepEqual(await readdir(directory), []);
  await mkdir(join(directory, 'labels.json'));
  const failed = await runNode([
    'src/cli/generate.js',
    '--out',
    directory,
    '--force',
  ]);
  assert.equal(failed.code, 1);
  assert.ok(!(await readdir(directory)).includes('manifest.json'));
  assert.ok(!(await readdir(directory)).some((name) => name.endsWith('.tmp')));
  const inputFile = join(directory, 'not-directory');
  await writeFile(inputFile, 'occupied');
  assert.equal(
    (await runNode(['src/cli/generate.js', '--out', inputFile])).code,
    1,
  );
});

test('every intentional pattern survives independent scoring without changing truth labels', () => {
  const sample = generateDataset();
  const truth = structuredClone(sample.labels);
  const scored = scoreClaims({ claims: sample.claims });
  const byId = new Map(
    scored.results.map((result) => [result.claim_id, result]),
  );
  for (const label of sample.labels.filter((label) => label.is_fraud)) {
    const flags = byId.get(label.claim_id).flags.map((flag) => flag.rule);
    for (const rule of label.injected_patterns)
      assert.ok(flags.includes(rule), `${label.claim_id}: ${rule}`);
  }
  assert.deepEqual(sample.labels, truth);
  assert.ok(
    sample.labels.some(
      (label) => !label.is_fraud && byId.get(label.claim_id).flags.length,
    ),
  );
  assert.deepEqual(
    withoutTiming(scored),
    withoutTiming(scoreClaims({ claims: sample.claims.toReversed() })),
  );
  assert.equal(scored.metadata.dataset_hash, sample.manifest.dataset_hash);
  assert.throws(
    () => scoreClaims({ claims: sample.claims, labels: sample.labels }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('committed development sample is byte-identical to default regeneration', async () => {
  const sample = generateDataset();
  for (const name of ['claims', 'labels', 'manifest']) {
    const bytes = await readFile(
      new URL(`../../data/sample/${name}.json`, import.meta.url),
      'utf8',
    );
    assert.equal(bytes, JSON.stringify(sample[name], null, 2) + '\n');
  }
});
