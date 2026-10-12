import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '@/controllers/health.controller';
import {
  HealthService,
  PrismaHealthIndicator,
} from '@/services/health.service';
import { PrismaService } from '@/models/prisma.service';

// ─── Stub PrismaService ───────────────────────────────────────────────────────

const prismaMock = {
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
};

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule.forRoot({ logger: false })],
      controllers: [HealthController],
      providers: [
        HealthService,
        PrismaHealthIndicator,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('ping (GET /)', () => {
    it('returns status ok, uptime, and timestamp', () => {
      const result = healthController.ping();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('check (GET /health)', () => {
    it('returns terminus health result with database indicator up', async () => {
      const result = await healthController.check();
      expect(result.status).toBe('ok');
      expect(result.info?.['database']?.['status']).toBe('up');
    });

    it('returns status error when DB is unreachable', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(
        new Error('Connection refused'),
      );
      await expect(healthController.check()).rejects.toThrow();
    });
  });
});
