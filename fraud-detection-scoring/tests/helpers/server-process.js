await import('../../src/server.js');
process.on('message', (message) => {
  if (message === 'shutdown') process.emit('SIGTERM');
});
process.channel.unref();
