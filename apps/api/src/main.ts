import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { rateLimitMiddleware } from './common/rate-limit.middleware';
import { assertProductionSecrets, isStrictSecretsMode } from './common/production-secrets';

async function bootstrap() {
  if (process.env.AUTH_DISABLED === '1' && (process.env.NODE_ENV === 'production' || isStrictSecretsMode())) {
    throw new Error('AUTH_DISABLED=1 is forbidden in production.');
  }
  assertProductionSecrets();

  // Legacy check kept for NODE_ENV=production without TUMBU_ENV (soft path)
  if (process.env.NODE_ENV === 'production' && !isStrictSecretsMode()) {
    const provider = (process.env.PAYMENT_PROVIDER || 'stub').toLowerCase();
    const stubSecret = process.env.STUB_WEBHOOK_SECRET || '';
    if ((provider === 'xendit' || process.env.ALLOW_STUB_WEBHOOK === '1')
      && (stubSecret === '' || stubSecret === 'stub-dev-secret')) {
      throw new Error(
        'Production: STUB_WEBHOOK_SECRET harus di-set dan bukan default stub-dev-secret '
        + '(wajib jika PAYMENT_PROVIDER=xendit atau ALLOW_STUB_WEBHOOK=1). '
        + 'Untuk gate R4 penuh set TUMBU_ENV=production.',
      );
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Excel import sends base64 JSON — default 100kb is far too small
  app.useBodyParser('json', {
    limit: '25mb',
    verify: (req: { originalUrl?: string; url?: string; rawBody?: Buffer }, _res: unknown, buf: Buffer) => {
      const path = String(req.originalUrl || req.url || '');
      if (path.includes('/payment/webhooks')) req.rawBody = Buffer.from(buf);
    },
  } as never);
  app.useBodyParser('urlencoded', { limit: '25mb', extended: true });
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // trycloudflare: default ON for local OR; OFF when strict production secrets mode
  const allowTryCloudflare = isStrictSecretsMode()
    ? false
    : (process.env.CORS_ALLOW_TRYCLOUDFLARE || '1') !== '0';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!origins.length || origins.includes('*') || origins.includes(origin)) {
        return callback(null, true);
      }
      if (allowTryCloudflare && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production' || isStrictSecretsMode()) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(rateLimitMiddleware);
  app.setGlobalPrefix('api');
  await app.listen(process.env.API_PORT ?? 3001);
}
bootstrap();
