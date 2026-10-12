import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  type HealthCheckAttempt,
} from '@nestjs/terminus';
import { PrismaService } from '@/models';

// ─── Lightweight ping shape (used by GET /) ──────────────────────────────────

export interface PingResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

// ─── Prisma DB health indicator (uses Terminus HealthIndicatorService) ───────

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  isHealthy(key: string): HealthCheckAttempt<string> {
    return this.healthIndicatorService.check(key).attempt(async () => {
      await this.prisma.$queryRaw`SELECT 1`;
    });
  }
}

// ─── Static ping service (kept lightweight — no DB) ──────────────────────────

@Injectable()
export class HealthService {
  ping(): PingResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
