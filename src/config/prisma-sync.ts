import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { getDatabaseConnection } from './database.config';

export interface PrismaSyncOptions {
  push?: boolean;
}

function extractDatasourceProvider(schemaContent: string): string | undefined {
  const match = schemaContent.match(
    /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"(sqlite|mysql|postgresql)"/,
  );
  return match?.[1];
}

function runPrismaCli(args: string[], databaseUrl: string): void {
  const prismaCliPath = resolve(
    process.cwd(),
    'node_modules/prisma/build/index.js',
  );
  const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `Prisma CLI command "prisma ${args.join(' ')}" exited with status ${String(result.status)}`,
    );
  }
}

/**
 * Synchronizes prisma/schema.prisma datasource provider with DB_CONNECTION from .env,
 * automatically regenerates @prisma/client when the provider changes, and optionally pushes schema.
 */
export function syncPrismaSchemaProvider(options?: PrismaSyncOptions): void {
  const connection = getDatabaseConnection();
  process.env['DATABASE_URL'] = connection.url;

  const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
  const currentSchema = readFileSync(schemaPath, 'utf-8');

  const updatedSchema = currentSchema.replace(
    /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"(sqlite|mysql|postgresql)"/,
    (match) =>
      match.replace(
        /provider\s*=\s*"(sqlite|mysql|postgresql)"/,
        `provider = "${connection.driver}"`,
      ),
  );

  const schemaChanged = updatedSchema !== currentSchema;
  if (schemaChanged) {
    writeFileSync(schemaPath, updatedSchema, 'utf-8');
  }

  const generatedSchemaPath = resolve(
    process.cwd(),
    'node_modules/.prisma/client/schema.prisma',
  );
  const generatedProvider = existsSync(generatedSchemaPath)
    ? extractDatasourceProvider(readFileSync(generatedSchemaPath, 'utf-8'))
    : undefined;

  if (schemaChanged || generatedProvider !== connection.driver) {
    runPrismaCli(['generate'], connection.url);
  }

  if (options?.push) {
    runPrismaCli(['db', 'push'], connection.url);
  }
}

if (import.meta.main) {
  const shouldPush = process.argv.includes('--push');
  syncPrismaSchemaProvider({ push: shouldPush });
}
