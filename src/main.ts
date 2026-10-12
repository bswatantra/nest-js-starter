import 'dotenv/config';
import type { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { AppLogger, getAppConfig } from '@/config';
import { compressionMiddleware } from '@/interceptors';
import { ObserveInstrument } from './observe';

export async function bootstrap(): Promise<void> {
  const { port, allowedOrigins } = getAppConfig();
  const logger = new AppLogger();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    logger,
  });

  // Security headers
  app.use(helmet());
  app.disable('x-powered-by');
  app.set('etag', false);

  // CORS — locked to ALLOWED_ORIGINS env var; disabled (false) if not set
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  app.useBodyParser('json', { limit: '100kb' });
  app.use(compressionMiddleware);
  app.enableShutdownHooks();

  const server = (await app.listen(port)) as Server;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.once('close', () => logger.close());
}

await bootstrap();
