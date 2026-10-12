import 'dotenv/config';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ObserveModule } from './observe';

// Controllers
import {
  HealthController,
  UsersController,
  PostsController,
} from '@/controllers';

// Services & Models
import {
  CacheService,
  HealthService,
  PrismaHealthIndicator,
  UsersService,
  PostsService,
} from '@/services';
import { PrismaService } from '@/models';

// Interceptors
import { LoggingInterceptor } from '@/interceptors';

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? '',
      appSecret: process.env.OBSERVE_APP_SECRET ?? '',
      serviceId: 'nest-learing',
    }),

    // Rate limiting: env-driven, defaults to 100 req / 60 s per IP
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env['THROTTLE_TTL_MS'] ?? 60_000),
        limit: Number(process.env['THROTTLE_LIMIT'] ?? 100),
      },
    ]),

    // Health checks (DB liveness via Terminus)
    TerminusModule,
  ],
  controllers: [HealthController, UsersController, PostsController],
  providers: [
    // Models / ORM & Caching
    PrismaService,
    CacheService,

    // Services (Business Logic)
    HealthService,
    PrismaHealthIndicator,
    UsersService,
    PostsService,

    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global Form & Data Validation Pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: true,
        transform: true,
        validateCustomDecorators: false,
      }),
    },

    // HTTP Request Logger
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
