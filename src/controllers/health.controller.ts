import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ROUTES } from '@/routes/app.routes';
import type { PingResult } from '@/services/health.service';
import {
  HealthService,
  PrismaHealthIndicator,
} from '@/services/health.service';

@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  /** GET /  — lightweight ping, no DB round-trip */
  @Get()
  @SkipThrottle()
  ping(): PingResult {
    return this.healthService.ping();
  }

  /** GET /health  — full liveness check including DB */
  @Get(ROUTES.HEALTH.ROOT)
  @HealthCheck()
  @SkipThrottle()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
    ]);
  }
}
