import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  getDatabaseConnection,
  type DatabaseConnectionConfig,
  type DatabaseDriver,
} from '@/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public readonly connectionConfig: DatabaseConnectionConfig;

  constructor() {
    const connection = getDatabaseConnection();
    process.env['DATABASE_URL'] = connection.url;

    super({
      datasources: {
        db: {
          url: connection.url,
        },
      },
    });

    this.connectionConfig = connection;
  }

  getActiveDriver(): DatabaseDriver {
    return this.connectionConfig.driver;
  }

  static createClientForDriver(driver: DatabaseDriver): PrismaClient {
    const connection = getDatabaseConnection(driver);
    return new PrismaClient({
      datasources: {
        db: {
          url: connection.url,
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    if (this.connectionConfig.driver === 'sqlite') {
      await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
      await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
      await this.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
      await this.$queryRawUnsafe('PRAGMA cache_size = -64000;');
      await this.$queryRawUnsafe('PRAGMA mmap_size = 268435456;');
      await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    } else {
      // Pre-warm TCP/TLS database connection pool so the first request pays zero handshake latency
      await this.$queryRawUnsafe('SELECT 1;');
    }

    this.logger.log(
      `Connected to "${this.connectionConfig.driver}" database (${this.connectionConfig.database})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
