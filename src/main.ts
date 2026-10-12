import 'dotenv/config';
import type { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module';
import { AppLogger, getAppConfig } from '@/config';
import { compressionMiddleware } from '@/interceptors';
import { ObserveInstrument } from './observe';

export async function bootstrap(): Promise<void> {
  const { port } = getAppConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    logger: new AppLogger(),
  });

  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(compressionMiddleware);
  app.enableShutdownHooks();

  const server = (await app.listen(port)) as Server;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

await bootstrap();
