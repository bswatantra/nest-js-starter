import { describe, it, expect, vi } from 'vitest';
import { of, throwError, lastValueFrom } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { compressionMiddleware } from '@/interceptors/compression.middleware';
import { LoggingInterceptor } from '@/interceptors/logging.interceptor';

describe('Interceptors & Middleware', () => {
  it('compresses large responses with brotli or gzip and skips small payloads', () => {
    const headers = new Map<string, string>();
    const sendSpy = vi.fn();

    const makeRes = (): Response =>
      ({
        headersSent: false,
        getHeader: (k: string) => headers.get(k),
        setHeader: (k: string, v: string) => {
          headers.set(k, v);
        },
        send: sendSpy,
      }) as unknown as Response;

    // 1. No accept-encoding header
    const res1 = makeRes();
    compressionMiddleware({ headers: {} } as Request, res1, vi.fn());
    expect(res1.send).toBe(sendSpy);

    // 2. Brotli compression on >= 1024 bytes
    headers.clear();
    const res2 = makeRes();
    compressionMiddleware(
      { headers: { 'accept-encoding': 'br, gzip' } } as unknown as Request,
      res2,
      vi.fn(),
    );
    res2.send('x'.repeat(1200));
    expect(headers.get('Content-Encoding')).toBe('br');

    // 3. Gzip compression on >= 1024 bytes Buffer
    headers.clear();
    const res3 = makeRes();
    compressionMiddleware(
      { headers: { 'accept-encoding': 'gzip' } } as unknown as Request,
      res3,
      vi.fn(),
    );
    res3.send(Buffer.alloc(1200, 'a'));
    expect(headers.get('Content-Encoding')).toBe('gzip');

    // 4. Small payload skipped
    headers.clear();
    const res4 = makeRes();
    compressionMiddleware(
      { headers: { 'accept-encoding': 'gzip' } } as unknown as Request,
      res4,
      vi.fn(),
    );
    res4.send('small');
    expect(headers.get('Content-Encoding')).toBeUndefined();
  });

  it('logs successful and failed HTTP requests in LoggingInterceptor', async () => {
    const interceptor = new LoggingInterceptor();
    const logSpy = vi
      .spyOn(
        (interceptor as unknown as { logger: { log: () => void } }).logger,
        'log',
      )
      .mockImplementation(() => undefined);
    const errSpy = vi
      .spyOn(
        (interceptor as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/users' }),
      }),
    } as unknown as ExecutionContext;

    const okHandler: CallHandler = { handle: () => of('ok') };
    expect(await lastValueFrom(interceptor.intercept(context, okHandler))).toBe(
      'ok',
    );
    expect(logSpy).toHaveBeenCalledTimes(1);

    const errHandler: CallHandler = {
      handle: () => throwError(() => new Error('Boom')),
    };
    await expect(
      lastValueFrom(interceptor.intercept(context, errHandler)),
    ).rejects.toThrow('Boom');
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});
