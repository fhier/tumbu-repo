/** Production / R4-1 secret gate — fail fast if development defaults are active. */

const DEV_ADMIN = 'tumbu123';
const DEV_DEMO = 'TumbuDemo123!';
const DEV_PG = 'tumbu_dev_password';
const DEV_STUB = 'stub-dev-secret';

export function isStrictSecretsMode(): boolean {
  return (
    process.env.TUMBU_ENV === 'production'
    || process.env.REQUIRE_STRICT_SECRETS === '1'
  );
}

function fail(msg: string): never {
  throw new Error(`R4-1 secrets: ${msg}`);
}

/** Call at API boot when TUMBU_ENV=production or REQUIRE_STRICT_SECRETS=1. */
export function assertProductionSecrets(): void {
  if (!isStrictSecretsMode()) return;

  if (process.env.AUTH_DISABLED === '1') {
    fail('AUTH_DISABLED=1 dilarang.');
  }
  if (process.env.AUTH_EXPOSE_VERIFY_TOKEN === '1' || process.env.AUTH_EXPOSE_RESET_TOKEN === '1') {
    fail('AUTH_EXPOSE_*_TOKEN=1 dilarang di produksi (token tidak boleh bocor ke API).');
  }

  const isPlaceholder = (v: string) => v.startsWith('CHANGE_ME');

  const admin = process.env.ADMIN_PASSWORD || '';
  if (!admin || admin === DEV_ADMIN || isPlaceholder(admin)) {
    fail('ADMIN_PASSWORD wajib di-set dan bukan password pengembangan.');
  }
  if (admin.length < 12) {
    fail('ADMIN_PASSWORD minimal 12 karakter.');
  }

  const demo = process.env.DEMO_USER_PASSWORD || '';
  if (!demo || demo === DEV_DEMO || isPlaceholder(demo)) {
    fail('DEMO_USER_PASSWORD tidak boleh memakai nilai pengembangan / placeholder.');
  }
  if (demo.length < 12) {
    fail('DEMO_USER_PASSWORD minimal 12 karakter.');
  }

  const pg = process.env.POSTGRES_PASSWORD || '';
  const dbUrl = process.env.DATABASE_URL || '';
  if (!pg || pg === DEV_PG || isPlaceholder(pg)) {
    fail('POSTGRES_PASSWORD wajib di-set dan bukan password pengembangan.');
  }
  if (pg.length < 12) {
    fail('POSTGRES_PASSWORD minimal 12 karakter.');
  }
  if (dbUrl.includes(DEV_PG) || dbUrl.includes('CHANGE_ME')) {
    fail('DATABASE_URL masih mengandung password pengembangan / placeholder.');
  }

  const cors = (process.env.CORS_ORIGIN || '').trim();
  if (!cors || cors === '*') {
    fail('CORS_ORIGIN wajib di-set ke origin produksi (bukan *).');
  }
  if ((process.env.CORS_ALLOW_TRYCLOUDFLARE || '0') !== '0') {
    fail('CORS_ALLOW_TRYCLOUDFLARE harus 0 di produksi.');
  }

  const provider = (process.env.PAYMENT_PROVIDER || 'stub').toLowerCase();
  const stubSecret = process.env.STUB_WEBHOOK_SECRET || '';
  if (stubSecret === '' || stubSecret === DEV_STUB || isPlaceholder(stubSecret)) {
    fail('STUB_WEBHOOK_SECRET wajib di-set dan bukan secret pengembangan (juga jika PAYMENT_PROVIDER=stub).');
  }
  if (stubSecret.length < 16) {
    fail('STUB_WEBHOOK_SECRET minimal 16 karakter.');
  }

  if (provider === 'xendit') {
    if (!(process.env.XENDIT_SECRET_KEY || '').trim()) {
      fail('XENDIT_SECRET_KEY wajib jika PAYMENT_PROVIDER=xendit.');
    }
    if (!(process.env.XENDIT_CALLBACK_TOKEN || '').trim()) {
      fail('XENDIT_CALLBACK_TOKEN wajib jika PAYMENT_PROVIDER=xendit.');
    }
  }
}
