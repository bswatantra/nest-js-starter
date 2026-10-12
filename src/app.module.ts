import 'dotenv/config';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
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
  ],
  controllers: [
    HealthController,
    UsersController,
    PostsController,
  ],
  providers: [
    // Models / ORM & Caching
    PrismaService,
    CacheService,

    // Services (Business Logic)
    HealthService,
    UsersService,
    PostsService,

    // Global Form & Data Validation Pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
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
