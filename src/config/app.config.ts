import 'dotenv/config';

export interface AppConfig {
  port: number;
  env: string;
  allowedOrigins: string[] | false;
}

export function getAppConfig(): AppConfig {
  const raw = process.env['ALLOWED_ORIGINS'];
  const allowedOrigins = raw
    ? raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : false;

  return {
    port: Number(process.env['PORT'] ?? 3000),
    env: process.env['NODE_ENV'] ?? 'development',
    allowedOrigins,
  };
}
