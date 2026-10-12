import { Controller, Get } from '@nestjs/common';
import { ROUTES } from '@/routes/app.routes';
import type { HealthCheckResult } from '@/services/health.service';
import { HealthService } from '@/services/health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthCheckResult {
    return this.healthService.check();
  }

  @Get(ROUTES.HEALTH.ROOT)
  health(): HealthCheckResult {
    return this.healthService.check();
  }
}
