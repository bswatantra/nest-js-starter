import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url } = request;
    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (performance.now() - start).toFixed(2);
          this.logger.log(`${method} ${url} ${duration}ms`);
        },
        error: (error: unknown) => {
          const duration = (performance.now() - start).toFixed(2);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`${method} ${url} ${duration}ms - ${errorMessage}`);
        },
      }),
    );
  }
}
