import { createRuntimeServer } from './http-server.js';

const runtime = createRuntimeServer();

async function shutdown(signal) {
  try {
    await runtime.close();
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'runtime_shutdown_failed',
      signal,
      error: String(error?.message ?? error)
    }));
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  const address = await runtime.start();
  console.log(JSON.stringify({
    event: 'runtime_started',
    service: 'imigrasi24jam',
    host: address.host,
    port: address.port
  }));
} catch (error) {
  console.error(JSON.stringify({
    event: 'runtime_start_failed',
    error: String(error?.message ?? error)
  }));
  process.exit(1);
}
