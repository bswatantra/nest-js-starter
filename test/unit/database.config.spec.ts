import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppConfig } from '@/config/app.config';
import {
  getDatabaseConfig,
  getDatabaseConnection,
} from '@/config/database.config';

describe('App & Database Configuration (Multi-DB)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['DB_CONNECTION'];
    delete process.env['DATABASE_URL'];
    delete process.env['SQLITE_DATABASE_URL'];
    delete process.env['MYSQL_DATABASE_URL'];
    delete process.env['POSTGRESQL_DATABASE_URL'];
    delete process.env['DB_POOL_SIZE'];
    delete process.env['DB_POOL_TIMEOUT'];
    delete process.env['ALLOWED_ORIGINS'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('parses app config and ALLOWED_ORIGINS list', () => {
    expect(getAppConfig().allowedOrigins).toBe(false);
    process.env['ALLOWED_ORIGINS'] = 'http://localhost:5173, https://app.com ';
    expect(getAppConfig().allowedOrigins).toEqual([
      'http://localhost:5173',
      'https://app.com',
    ]);
  });

  it('defaults to sqlite connection when DB_CONNECTION is not specified', () => {
    process.env['SQLITE_DATABASE_PATH'] = './test.db';

    const config = getDatabaseConfig();
    expect(config.default).toBe('sqlite');
    expect(config.connections.sqlite).toEqual({
      driver: 'sqlite',
      database: './test.db',
      url: 'file:./test.db',
    });
  });

  it('builds mysql connection URL from environment variables', () => {
    process.env['DB_CONNECTION'] = 'mysql';
    process.env['DB_HOST'] = 'db.mysql.local';
    process.env['DB_PORT'] = '3307';
    process.env['DB_USERNAME'] = 'admin';
    process.env['DB_PASSWORD'] = 'secret123';
    process.env['DB_DATABASE'] = 'shop_db';

    const active = getDatabaseConnection();
    expect(active.driver).toBe('mysql');
    expect(active.url).toBe(
      'mysql://admin:secret123@db.mysql.local:3307/shop_db',
    );

    const mysqlConn = getDatabaseConnection('mysql');
    expect(mysqlConn.host).toBe('db.mysql.local');
    expect(mysqlConn.port).toBe(3307);
    expect(mysqlConn.database).toBe('shop_db');
  });

  it('builds postgresql connection URL from environment variables', () => {
    process.env['DB_CONNECTION'] = 'postgresql';
    process.env['DB_HOST'] = 'db.pg.local';
    process.env['DB_PORT'] = '5433';
    process.env['DB_USERNAME'] = 'pguser';
    process.env['DB_PASSWORD'] = 'pgpass';
    process.env['DB_DATABASE'] = 'analytics_db';
    process.env['DB_SCHEMA'] = 'custom_schema';

    const active = getDatabaseConnection();
    expect(active.driver).toBe('postgresql');
    expect(active.url).toBe(
      'postgresql://pguser:pgpass@db.pg.local:5433/analytics_db?schema=custom_schema',
    );

    const pgConn = getDatabaseConnection('postgresql');
    expect(pgConn.host).toBe('db.pg.local');
    expect(pgConn.port).toBe(5433);
    expect(pgConn.schema).toBe('custom_schema');
  });

  it('extracts host, port, and database metadata when POSTGRESQL_DATABASE_URL is set', () => {
    process.env['DB_CONNECTION'] = 'postgresql';
    process.env['POSTGRESQL_DATABASE_URL'] =
      'postgres://myuser:mypass@pooled.db.prisma.io:5432/postgres?sslmode=require';

    const pgConn = getDatabaseConnection('postgresql');
    expect(pgConn.driver).toBe('postgresql');
    expect(pgConn.host).toBe('pooled.db.prisma.io');
    expect(pgConn.port).toBe(5432);
    expect(pgConn.database).toBe('postgres');
    expect(pgConn.url).toBe(
      'postgres://myuser:mypass@pooled.db.prisma.io:5432/postgres?sslmode=require&pgbouncer=true',
    );
  });

  it('appends connection_limit and pool_timeout when DB_POOL_SIZE is configured', () => {
    process.env['DB_CONNECTION'] = 'postgresql';
    process.env['DB_HOST'] = '127.0.0.1';
    process.env['DB_PORT'] = '5432';
    process.env['DB_USERNAME'] = 'postgres';
    process.env['DB_PASSWORD'] = 'postgres';
    process.env['DB_DATABASE'] = 'nest_learning';
    process.env['DB_SCHEMA'] = 'public';
    process.env['DB_POOL_SIZE'] = '20';
    process.env['DB_POOL_TIMEOUT'] = '15';

    const pgConn = getDatabaseConnection('postgresql');
    expect(pgConn.poolSize).toBe(20);
    expect(pgConn.poolTimeout).toBe(15);
    expect(pgConn.url).toBe(
      'postgresql://postgres:postgres@127.0.0.1:5432/nest_learning?schema=public&connection_limit=20&pool_timeout=15',
    );
  });

  it('allows retrieving any configured database driver on demand', () => {
    const sqlite = getDatabaseConnection('sqlite');
    const mysql = getDatabaseConnection('mysql');
    const postgresql = getDatabaseConnection('postgresql');

    expect(sqlite.driver).toBe('sqlite');
    expect(mysql.driver).toBe('mysql');
    expect(postgresql.driver).toBe('postgresql');
  });
});
