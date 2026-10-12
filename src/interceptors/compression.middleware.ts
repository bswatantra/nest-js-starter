import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import type { Request, Response, NextFunction } from 'express';

const MIN_COMPRESS_BYTES = 1024;

export function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const acceptEncoding = req.headers['accept-encoding'];
  if (typeof acceptEncoding !== 'string') {
    next();
    return;
  }

  const supportsBr = acceptEncoding.includes('br');
  const supportsGzip = acceptEncoding.includes('gzip');

  if (!supportsBr && !supportsGzip) {
    next();
    return;
  }

  const originalSend = res.send.bind(res);

  res.send = function sendCompressed(body?: unknown): Response {
    if (res.headersSent || res.getHeader('Content-Encoding')) {
      return originalSend(body);
    }

    let buffer: Buffer | undefined;
    if (typeof body === 'string') {
      if (Buffer.byteLength(body) >= MIN_COMPRESS_BYTES) {
        buffer = Buffer.from(body);
      }
    } else if (Buffer.isBuffer(body) && body.length >= MIN_COMPRESS_BYTES) {
      buffer = body;
    }

    if (!buffer) {
      return originalSend(body);
    }

    res.setHeader('Vary', 'Accept-Encoding');

    if (supportsBr) {
      const compressed = brotliCompressSync(buffer, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 4,
        },
      });
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Content-Length', String(compressed.length));
      return originalSend(compressed);
    }

    const compressed = gzipSync(buffer, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(compressed.length));
    return originalSend(compressed);
  };

  next();
}

