import { once } from 'node:events';

export async function serve(app, context) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

export function post(url, body) {
  return fetch(`${url}/api/v1/score`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
