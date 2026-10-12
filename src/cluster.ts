import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { AppLogger } from '@/config';

const logger = new AppLogger();
logger.setContext('Cluster');

const numCPUs = Number(
  process.env['CLUSTER_WORKERS'] ?? availableParallelism(),
);

if (cluster.isPrimary) {
  let isShuttingDown = false;

  logger.log(
    `Primary process ${process.pid} is running — forking ${numCPUs} workers`,
  );

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  const shutdown = (): void => {
    isShuttingDown = true;
    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.kill();
    }
    logger.close();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  cluster.on('exit', (worker, code, signal) => {
    if (isShuttingDown) {
      return;
    }
    logger.warn(
      `Worker ${String(worker.process.pid)} exited (code: ${String(code)}, signal: ${String(signal)}). Respawning...`,
    );
    cluster.fork();
  });
} else {
  await import('./main');
}
