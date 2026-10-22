import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { runNode } from '../helpers/process.js';

test('server rejects invalid runtime configuration with a usage exit', async () => {
  for (const environment of [
    { HOST: 'not a host', PORT: '3000' },
    { HOST: '127.0.0.1', PORT: '0' },
    { HOST: '127.0.0.1', PORT: '1.5' },
    { HOST: '127.0.0.1', PORT: '65536' },
  ]) {
    const result = await runNode(['src/server.js'], {
      env: { ...process.env, ...environment },
    });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /HOST.*PORT/);
  }
});

test(
  'server entry point starts and serves the health endpoint',
  { timeout: 10000 },
  async (context) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const child = spawn(process.execPath, ['src/server.js'], {
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
      shell: false,
    });
    const closed = once(child, 'close');
    context.after(async () => {
      child.kill();
      await closed;
    });
    await Promise.race([
      once(child.stdout, 'data'),
      closed.then(() => {
        throw new Error('Server exited before becoming ready');
      }),
    ]);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
  },
);
