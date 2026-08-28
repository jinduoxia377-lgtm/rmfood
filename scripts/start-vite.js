const { createServer } = require('./node_modules/vite/dist/node/index.js');
console.log('vite imported successfully');
console.log('createServer type:', typeof createServer);

async function main() {
  const server = await createServer({
    configFile: './vite.config.ts',
    port: 3000,
    root: '.',
  });
  await server.listen();
  console.log('Vite server running on http://localhost:' + server.config.server.port);
}
main().catch(err => {
  console.error('Failed to start:', err.message);
  console.error(err.stack);
  process.exit(1);
});
