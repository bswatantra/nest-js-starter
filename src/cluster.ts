import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { Logger } from '@nestjs/common';

const logger = new Logger('Cluster');
const numCPUs = Number(
  process.env['CLUSTER_WORKERS'] ?? availableParallelism(),
);

if (cluster.isPrimary) {
  logger.log(
    `Primary process ${process.pid} is running — forking ${numCPUs} workers`,
  );

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(
      `Worker ${worker.process.pid} exited (code: ${code}, signal: ${signal}). Respawning...`,
    );
    cluster.fork();
  });
} else {
  await import('./main');
}
