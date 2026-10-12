import 'dotenv/config';
import { availableParallelism } from 'node:os';

export type DatabaseDriver = 'sqlite' | 'mysql' | 'postgresql';

export interface SqliteConnectionConfig {
  driver: 'sqlite';
  database: string;
  url: string;
}

export interface MysqlConnectionConfig {
  driver: 'mysql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  poolTimeout: number;
  url: string;
}

export interface PostgresqlConnectionConfig {
  driver: 'postgresql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  schema: string;
  poolSize: number;
  poolTimeout: number;
  url: string;
}

export type DatabaseConnectionConfig =
  SqliteConnectionConfig | MysqlConnectionConfig | PostgresqlConnectionConfig;

export interface DatabaseConnectionsMap {
  sqlite: SqliteConnectionConfig;
  mysql: MysqlConnectionConfig;
  postgresql: PostgresqlConnectionConfig;
}

export interface DatabaseConfig {
  default: DatabaseDriver;
  connections: DatabaseConnectionsMap;
}

interface ParsedUrlMetadata {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
}

function resolveDriver(rawDriver: string | undefined): DatabaseDriver {
  const normalized = rawDriver?.trim().toLowerCase();
  if (normalized === 'mysql') {
    return 'mysql';
  }
  if (
    normalized === 'postgresql' ||
    normalized === 'postgres' ||
    normalized === 'pgsql'
  ) {
    return 'postgresql';
  }
  return 'sqlite';
}

function parseUrlMetadata(rawUrl: string | undefined): ParsedUrlMetadata {
  if (!rawUrl) {
    return {};
  }
  try {
    const parsed = new URL(rawUrl);
    const dbName = parsed.pathname.replace(/^\/+/, '');
    const schema = parsed.searchParams.get('schema') ?? undefined;
    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? Number(parsed.port) : undefined,
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      database: dbName || undefined,
      schema,
    };
  } catch {
    return {};
  }
}

function buildMysqlUrl(
  config: Omit<MysqlConnectionConfig, 'url'>,
  appendPoolParams: boolean,
): string {
  const auth = config.password
    ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`
    : encodeURIComponent(config.username);
  const base = `mysql://${auth}@${config.host}:${config.port}/${config.database}`;
  if (!appendPoolParams) {
    return base;
  }
  return `${base}?connection_limit=${config.poolSize}&pool_timeout=${config.poolTimeout}`;
}

function buildPostgresqlUrl(
  config: Omit<PostgresqlConnectionConfig, 'url'>,
  appendPoolParams: boolean,
): string {
  const auth = config.password
    ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`
    : encodeURIComponent(config.username);
  const base = `postgresql://${auth}@${config.host}:${config.port}/${config.database}?schema=${encodeURIComponent(config.schema)}`;
  if (!appendPoolParams) {
    return base;
  }
  return `${base}&connection_limit=${config.poolSize}&pool_timeout=${config.poolTimeout}`;
}

export function getDatabaseConfig(): DatabaseConfig {
  const activeDriver = resolveDriver(process.env['DB_CONNECTION']);
  const envDatabaseUrl = process.env['DATABASE_URL'];
  const defaultPoolSize = availableParallelism() * 2 + 1;
  const poolSize = Number(process.env['DB_POOL_SIZE'] ?? defaultPoolSize);
  const poolTimeout = Number(process.env['DB_POOL_TIMEOUT'] ?? 10);
  const appendPoolParams = process.env['DB_POOL_SIZE'] !== undefined;

  // 1. SQLite Configuration
  const sqliteFile =
    process.env['SQLITE_DATABASE_PATH'] ??
    (activeDriver === 'sqlite' ? process.env['DB_DATABASE'] : undefined) ??
    './dev.db';
  const sqliteUrl =
    process.env['SQLITE_DATABASE_URL'] ??
    (activeDriver === 'sqlite' && envDatabaseUrl?.startsWith('file:')
      ? envDatabaseUrl
      : `file:${sqliteFile}`);

  const sqliteConfig: SqliteConnectionConfig = {
    driver: 'sqlite',
    database: sqliteFile,
    url: sqliteUrl,
  };

  // 2. MySQL Configuration
  const explicitMysqlUrl =
    process.env['MYSQL_DATABASE_URL'] ??
    (activeDriver === 'mysql' && envDatabaseUrl?.startsWith('mysql://')
      ? envDatabaseUrl
      : undefined);
  const mysqlUrlMeta = parseUrlMetadata(explicitMysqlUrl);

  const mysqlBase: Omit<MysqlConnectionConfig, 'url'> = {
    driver: 'mysql',
    host:
      process.env['MYSQL_HOST'] ??
      process.env['DB_HOST'] ??
      mysqlUrlMeta.host ??
      '127.0.0.1',
    port: Number(
      process.env['MYSQL_PORT'] ??
        (activeDriver === 'mysql' ? process.env['DB_PORT'] : undefined) ??
        mysqlUrlMeta.port ??
        3306,
    ),
    username:
      process.env['MYSQL_USERNAME'] ??
      process.env['DB_USERNAME'] ??
      mysqlUrlMeta.username ??
      'root',
    password:
      process.env['MYSQL_PASSWORD'] ??
      process.env['DB_PASSWORD'] ??
      mysqlUrlMeta.password ??
      '',
    database:
      process.env['MYSQL_DATABASE'] ??
      process.env['DB_DATABASE'] ??
      mysqlUrlMeta.database ??
      'nest_learning',
    poolSize,
    poolTimeout,
  };
  const mysqlUrl =
    explicitMysqlUrl ?? buildMysqlUrl(mysqlBase, appendPoolParams);

  const mysqlConfig: MysqlConnectionConfig = {
    ...mysqlBase,
    url: mysqlUrl,
  };

  // 3. PostgreSQL Configuration
  const explicitPostgresqlUrl =
    process.env['POSTGRESQL_DATABASE_URL'] ??
    (activeDriver === 'postgresql' &&
    (envDatabaseUrl?.startsWith('postgresql://') ||
      envDatabaseUrl?.startsWith('postgres://'))
      ? envDatabaseUrl
      : undefined);
  const pgUrlMeta = parseUrlMetadata(explicitPostgresqlUrl);

  const postgresqlBase: Omit<PostgresqlConnectionConfig, 'url'> = {
    driver: 'postgresql',
    host:
      process.env['POSTGRES_HOST'] ??
      process.env['DB_HOST'] ??
      pgUrlMeta.host ??
      '127.0.0.1',
    port: Number(
      process.env['POSTGRES_PORT'] ??
        (activeDriver === 'postgresql' ? process.env['DB_PORT'] : undefined) ??
        pgUrlMeta.port ??
        5432,
    ),
    username:
      process.env['POSTGRES_USERNAME'] ??
      process.env['DB_USERNAME'] ??
      pgUrlMeta.username ??
      'postgres',
    password:
      process.env['POSTGRES_PASSWORD'] ??
      process.env['DB_PASSWORD'] ??
      pgUrlMeta.password ??
      '',
    database:
      process.env['POSTGRES_DATABASE'] ??
      process.env['DB_DATABASE'] ??
      pgUrlMeta.database ??
      'nest_learning',
    schema:
      process.env['POSTGRES_SCHEMA'] ??
      process.env['DB_SCHEMA'] ??
      pgUrlMeta.schema ??
      'public',
    poolSize,
    poolTimeout,
  };
  const postgresqlUrl =
    explicitPostgresqlUrl ??
    buildPostgresqlUrl(postgresqlBase, appendPoolParams);

  const postgresqlConfig: PostgresqlConnectionConfig = {
    ...postgresqlBase,
    url: postgresqlUrl,
  };

  return {
    default: activeDriver,
    connections: {
      sqlite: sqliteConfig,
      mysql: mysqlConfig,
      postgresql: postgresqlConfig,
    },
  };
}

export function getDatabaseConnection<T extends DatabaseDriver>(
  driver: T,
): DatabaseConnectionsMap[T];
export function getDatabaseConnection(
  driver?: DatabaseDriver,
): DatabaseConnectionConfig;
export function getDatabaseConnection(
  driver?: DatabaseDriver,
): DatabaseConnectionConfig {
  const config = getDatabaseConfig();
  const targetDriver = driver ?? config.default;
  return config.connections[targetDriver];
}
