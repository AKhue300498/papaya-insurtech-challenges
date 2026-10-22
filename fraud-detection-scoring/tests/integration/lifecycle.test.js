import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import {
  mkdtemp,
  readdir,
  readFile,
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../src/app.js';
import { serve, post } from '../helpers/http.js';
import { runNode } from '../helpers/process.js';
import { claim } from '../fixtures/claims.js';

async function temporary(context) {
  const directory = await mkdtemp(join(tmpdir(), 'fraud-lifecycle-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test(
  'loopback service handles shutdown gracefully without forced termination',
  { timeout: 10000 },
  async (context) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const child = fork(
      new URL('../helpers/server-process.js', import.meta.url),
      [],
      {
        env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
        silent: true,
      },
    );
    const closed = once(child, 'close');
    context.after(async () => {
      if (child.exitCode === null) child.kill();
      await closed;
    });
    await Promise.race([
      once(child.stdout, 'data'),
      closed.then(() => {
        throw new Error('Server exited before readiness');
      }),
    ]);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    await response.json();
    child.send('shutdown');
    const [code, signal] = await closed;
    assert.equal(code, 0);
    assert.equal(signal, null);
    await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));
  },
);

test(
  'aborted HTTP bodies do not persist artifacts and the service remains healthy',
  { timeout: 10000 },
  async (context) => {
    const app = createApp();
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    context.after(
      () =>
        new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        }),
    );
    const beforeNames = await readdir(
      new URL('../../output/', import.meta.url),
    );
    const before = await Promise.all(
      ['scored', 'metrics'].map((name) =>
        readFile(new URL(`../../output/${name}.json`, import.meta.url), 'utf8'),
      ),
    );
    const received = once(server, 'request');
    const socket = connect(server.address().port, '127.0.0.1');
    context.after(() => socket.destroy());
    await once(socket, 'connect');
    socket.write(
      'POST /api/v1/score HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 10000\r\n\r\n{"claims":[',
    );
    await received;
    const disconnected = once(socket, 'close');
    socket.destroy();
    await disconnected;
    const health = await fetch(
      `http://127.0.0.1:${server.address().port}/health`,
    );
    assert.equal(health.status, 200);
    await health.json();
    const after = await Promise.all(
      ['scored', 'metrics'].map((name) =>
        readFile(new URL(`../../output/${name}.json`, import.meta.url), 'utf8'),
      ),
    );
    assert.deepEqual(after, before);
    assert.deepEqual(
      await readdir(new URL('../../output/', import.meta.url)),
      beforeNames,
    );
  },
);

test('concurrent request overrides never mutate another request or published configuration', async (context) => {
  const url = await serve(createApp(), context);
  const input = { claims: [claim({ submitted_amount: 49500 })] };
  const responses = await Promise.all([
    post(url, { ...input, weights: { amount_clustering: 5 } }),
    post(url, input),
  ]);
  const [changed, normal] = await Promise.all(
    responses.map((response) => response.json()),
  );
  assert.equal(changed.metadata.effective_weights.amount_clustering, 5);
  assert.equal(normal.metadata.effective_weights.amount_clustering, 2);
  const configuration = await (await fetch(`${url}/api/v1/config`)).json();
  assert.equal(configuration.weights.amount_clustering, 2);
  assert.equal(
    (await (await post(url, input)).json()).results[0].risk_score,
    6.9,
  );
});

test('CLI write failure leaves no temporary files or completed output', async (context) => {
  const directory = await temporary(context);
  const input = join(directory, 'claims.json');
  const output = join(directory, 'scored.json');
  await writeFile(input, JSON.stringify([claim()]));
  await mkdir(output);
  const result = await runNode([
    'src/cli/score.js',
    '--input',
    input,
    '--output',
    output,
    '--force',
  ]);
  assert.equal(result.code, 1);
  assert.deepEqual(await readdir(output), []);
  assert.deepEqual((await readdir(directory)).sort(), [
    'claims.json',
    'scored.json',
  ]);
  assert.ok(JSON.parse(result.stderr).error.code);
});
