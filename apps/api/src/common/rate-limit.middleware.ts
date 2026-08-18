import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Express middleware — rate-limit login & public leads. */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = String(req.originalUrl || req.url || '');
  const method = String(req.method || 'GET').toUpperCase();
  let limit = 0;
  let windowMs = 60_000;

  if (method === 'POST' && path.includes('/auth/login')) {
    limit = 20;
    windowMs = 15 * 60_000;
  } else if (method === 'POST' && path.includes('/auth/register')) {
    limit = 10;
    windowMs = 60 * 60_000;
  } else if (method === 'POST' && path.includes('/leads') && !path.includes('/platform')) {
    limit = 10;
    windowMs = 60 * 60_000;
  }

  if (!limit) return next();

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const key = `${ip}:${path.split('?')[0]}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  if (bucket.count > limit) {
    res.status(429).json({ statusCode: 429, message: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    return;
  }
  next();
}
