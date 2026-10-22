import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../src/app.js';
import { serve } from '../helpers/http.js';
import { runNode } from '../helpers/process.js';
import { preparedEvaluation } from '../fixtures/evaluation.js';

async function temporary(context) {
  const directory = await mkdtemp(join(tmpdir(), 'fraud-evaluate-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('evaluation CLI and HTTP agree and preserve scored input while protecting reports', async (context) => {
  const input = preparedEvaluation();
  const directory = await temporary(context);
  const scores = join(directory, 'scores.json');
  const labels = join(directory, 'labels.json');
  const output = join(directory, 'metrics.json');
  await writeFile(scores, JSON.stringify(input.scored));
  await writeFile(labels, JSON.stringify(input.labels));
  const args = [
    'src/cli/evaluate.js',
    '--scores',
    scores,
    '--labels',
    labels,
    '--output',
    output,
  ];
  const result = await runNode(args);
  assert.equal(result.code, 0, result.stderr);
  const url = await serve(createApp(), context);
  const response = await fetch(`${url}/api/v1/evaluate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const http = await response.json();
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), http);
  assert.equal(http.targets.all_passed, false);
  assert.equal((await runNode(args)).code, 1);
  assert.equal(
    (await runNode([...args, '--force', '--minimum-score', '13.79'])).code,
    0,
  );
  assert.equal(
    JSON.parse(await readFile(output, 'utf8')).false_positive_rate,
    0,
  );
  assert.equal(await readFile(scores, 'utf8'), JSON.stringify(input.scored));
});

test('evaluation CLI reports validation usage and I/O failures without partial reports', async (context) => {
  const directory = await temporary(context);
  const scores = join(directory, 'scores.json');
  const labels = join(directory, 'labels.json');
  const output = join(directory, 'metrics.json');
  const input = preparedEvaluation();
  await writeFile(scores, JSON.stringify(input.scored));
  await writeFile(labels, JSON.stringify(input.labels));
  const args = [
    'src/cli/evaluate.js',
    '--scores',
    scores,
    '--labels',
    labels,
    '--output',
    output,
  ];
  assert.equal((await runNode(['src/cli/evaluate.js'])).code, 2);
  for (const threshold of [
    '',
    '0',
    '-1',
    '101',
    'NaN',
    'Infinity',
    '0x10',
    '1e1',
    '1.5oops',
  ])
    assert.equal(
      (await runNode([...args, '--minimum-score', threshold])).code,
      2,
    );
  await writeFile(labels, '[]');
  assert.equal((await runNode(args)).code, 2);
  await writeFile(scores, '{bad');
  assert.equal((await runNode(args)).code, 2);
  await rm(scores);
  assert.equal((await runNode(args)).code, 1);
  assert.ok(!(await readdir(directory)).includes('metrics.json'));
  assert.ok(!(await readdir(directory)).some((name) => name.endsWith('.tmp')));
});
