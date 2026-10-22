import { isIP } from 'node:net';
import { createApp } from './app.js';

const host = process.env.HOST ?? '127.0.0.1';
const portValue = process.env.PORT ?? '3000';
if (
  (!isIP(host) && host !== 'localhost') ||
  !/^\d+$/.test(portValue) ||
  Number(portValue) < 1 ||
  Number(portValue) > 65535
) {
  process.stderr.write(
    'HOST must be an IP address or localhost; PORT must be an integer from 1 to 65535\n',
  );
  process.exitCode = 2;
} else {
  const server = createApp().listen(Number(portValue), host);
  server.on('listening', () =>
    process.stdout.write(`Listening on http://${host}:${portValue}\n`),
  );
  server.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
  const shutdown = () => {
    server.close(() => {
      clearTimeout(timer);
    });
    server.closeIdleConnections();
    const timer = setTimeout(() => server.closeAllConnections(), 5000);
    timer.unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
