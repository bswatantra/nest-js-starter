import 'dotenv/config';

export interface AppConfig {
  port: number;
  env: string;
}

export function getAppConfig(): AppConfig {
  return {
    port: Number(process.env['PORT'] ?? 3000),
    env: process.env['NODE_ENV'] ?? 'development',
  };
}

