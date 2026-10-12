import 'dotenv/config';
import { availableParallelism } from 'node:os';

export type DatabaseDriver = 'sqlite' | 'mysql' | 'postgresql';

export interface SqliteConnectionConfig {
  driver: 'sqlite';
  database: string;
  url: string;
}

export interface SqlConnectionFields {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  poolTimeout: number;
  url: string;
}

export interface MysqlConnectionConfig extends SqlConnectionFields {
  driver: 'mysql';
}

export interface PostgresqlConnectionConfig extends SqlConnectionFields {
  driver: 'postgresql';
  schema: string;
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

interface SqlDriverDefaults {
  envPrefix: 'MYSQL' | 'POSTGRES';
  isActive: boolean;
  defaultPort: number;
  defaultUser: string;
  urlMeta: ParsedUrlMetadata;
  poolSize: number;
  poolTimeout: number;
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

function resolveSqlBaseConfig(
  options: SqlDriverDefaults,
): Omit<SqlConnectionFields, 'url'> {
  const {
    envPrefix,
    isActive,
    defaultPort,
    defaultUser,
    urlMeta,
    poolSize,
    poolTimeout,
  } = options;

  return {
    host:
      process.env[`${envPrefix}_HOST`] ??
      process.env['DB_HOST'] ??
      urlMeta.host ??
      '127.0.0.1',
    port: Number(
      process.env[`${envPrefix}_PORT`] ??
        (isActive ? process.env['DB_PORT'] : undefined) ??
        urlMeta.port ??
        defaultPort,
    ),
    username:
      process.env[`${envPrefix}_USERNAME`] ??
      process.env['DB_USERNAME'] ??
      urlMeta.username ??
      defaultUser,
    password:
      process.env[`${envPrefix}_PASSWORD`] ??
      process.env['DB_PASSWORD'] ??
      urlMeta.password ??
      '',
    database:
      process.env[`${envPrefix}_DATABASE`] ??
      process.env['DB_DATABASE'] ??
      urlMeta.database ??
      'nest_learning',
    poolSize,
    poolTimeout,
  };
}

function ensurePgBouncerParam(url: string, host: string): string {
  if (!host.includes('pooled.') || url.includes('pgbouncer=')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}pgbouncer=true`;
}

function buildSqlConnectionUrl(
  protocol: 'mysql' | 'postgresql',
  config: Omit<SqlConnectionFields, 'url'>,
  options: { schema?: string; appendPoolParams: boolean },
): string {
  const auth = config.password
    ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}`
    : encodeURIComponent(config.username);
  const base = `${protocol}://${auth}@${config.host}:${config.port}/${config.database}`;
  const queryParams: string[] = [];

  if (options.schema) {
    queryParams.push(`schema=${encodeURIComponent(options.schema)}`);
  }
  if (options.appendPoolParams) {
    queryParams.push(
      `connection_limit=${config.poolSize}`,
      `pool_timeout=${config.poolTimeout}`,
    );
  }

  return queryParams.length > 0 ? `${base}?${queryParams.join('&')}` : base;
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
  const mysqlBase = resolveSqlBaseConfig({
    envPrefix: 'MYSQL',
    isActive: activeDriver === 'mysql',
    defaultPort: 3306,
    defaultUser: 'root',
    urlMeta: parseUrlMetadata(explicitMysqlUrl),
    poolSize,
    poolTimeout,
  });

  const mysqlConfig: MysqlConnectionConfig = {
    driver: 'mysql',
    ...mysqlBase,
    url:
      explicitMysqlUrl ??
      buildSqlConnectionUrl('mysql', mysqlBase, { appendPoolParams }),
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
  const postgresqlBase = resolveSqlBaseConfig({
    envPrefix: 'POSTGRES',
    isActive: activeDriver === 'postgresql',
    defaultPort: 5432,
    defaultUser: 'postgres',
    urlMeta: pgUrlMeta,
    poolSize,
    poolTimeout,
  });
  const schema =
    process.env['POSTGRES_SCHEMA'] ??
    process.env['DB_SCHEMA'] ??
    pgUrlMeta.schema ??
    'public';

  const rawPostgresqlUrl =
    explicitPostgresqlUrl ??
    buildSqlConnectionUrl('postgresql', postgresqlBase, {
      schema,
      appendPoolParams,
    });

  const postgresqlConfig: PostgresqlConnectionConfig = {
    driver: 'postgresql',
    ...postgresqlBase,
    schema,
    url: ensurePgBouncerParam(rawPostgresqlUrl, postgresqlBase.host),
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
