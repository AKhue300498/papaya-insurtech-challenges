import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readJson,
  writeJson,
  writeDataset,
} from '../../src/artifacts/files.js';

async function temporary(context) {
  const directory = await mkdtemp(join(tmpdir(), 'fraud-artifacts-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('atomic output refuses overwrite and explicit force replaces it', async (context) => {
  const directory = await temporary(context);
  const path = join(directory, 'output.json');
  await writeJson(path, { first: true });
  await assert.rejects(writeJson(path, { second: true }), { code: 'EEXIST' });
  assert.deepEqual(await readJson(path), { first: true });
  assert.deepEqual(await readdir(directory), ['output.json']);
  await writeJson(path, { second: true }, true);
  assert.deepEqual(await readJson(path), { second: true });
});

test('malformed JSON has an actionable error and BOM is accepted', async (context) => {
  const directory = await temporary(context);
  const path = join(directory, 'input.json');
  await writeFile(path, '{bad');
  await assert.rejects(readJson(path), { code: 'INVALID_JSON' });
  await writeFile(path, '\uFEFF[]');
  assert.deepEqual(await readJson(path), []);
});

test('failed serialization cleans temporary files and preserves prior output', async (context) => {
  const directory = await temporary(context);
  const path = join(directory, 'output.json');
  await writeJson(path, { value: 1 });
  const circular = {};
  circular.self = circular;
  await assert.rejects(writeJson(path, circular, true));
  assert.deepEqual(await readJson(path), { value: 1 });
  assert.deepEqual(await readdir(directory), ['output.json']);
});

test('dataset completion manifest is saved last and existing files are protected', async (context) => {
  const directory = await temporary(context);
  await writeDataset(directory, {
    claims: [],
    labels: [],
    manifest: { complete: true },
  });
  await assert.rejects(
    writeDataset(directory, { claims: [], labels: [], manifest: {} }),
    { code: 'OUTPUT_EXISTS' },
  );
  assert.match(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
    /complete/,
  );
});

test('failed dataset write removes completion marker', async (context) => {
  const directory = await temporary(context);
  await writeDataset(directory, {
    claims: [],
    labels: [],
    manifest: { complete: true },
  });
  const circular = {};
  circular.self = circular;
  await assert.rejects(
    writeDataset(
      directory,
      { claims: circular, labels: [], manifest: {} },
      true,
    ),
  );
  assert.ok(!(await readdir(directory)).includes('manifest.json'));
});
