import { appOrigin, formatExpiresId, publicAssetUrl } from './email.types';
import { renderEmail } from './email.templates';
import { EmailService } from './email.service';

describe('appOrigin (email links)', () => {
  const prev: Record<string, string | undefined> = {};
  function stash(keys: string[]) {
    for (const k of keys) prev[k] = process.env[k];
  }
  afterEach(() => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k]!;
    }
  });

  it('uses APP_URL and ignores CORS trycloudflare', () => {
    stash(['APP_URL', 'PUBLIC_APP_URL', 'CORS_ORIGIN']);
    process.env.APP_URL = 'https://tumbu.web.id';
    process.env.CORS_ORIGIN = 'https://abc.trycloudflare.com,https://tumbu.web.id';
    expect(appOrigin()).toBe('https://tumbu.web.id');
    expect(appOrigin()).not.toMatch(/trycloudflare|localhost/);
  });

  it('rejects trycloudflare APP_URL and falls back to production domain', () => {
    stash(['APP_URL', 'PUBLIC_APP_URL', 'CORS_ORIGIN']);
    process.env.APP_URL = 'https://foo.trycloudflare.com';
    delete process.env.PUBLIC_APP_URL;
    delete process.env.CORS_ORIGIN;
    expect(appOrigin()).toBe('https://tumbu.web.id');
  });

  it('builds asset URLs on APP_URL', () => {
    stash(['APP_URL', 'PUBLIC_APP_URL']);
    process.env.APP_URL = 'https://tumbu.web.id';
    expect(publicAssetUrl('/tumbu-logo-light.svg')).toBe('https://tumbu.web.id/tumbu-logo-light.svg');
  });
});

describe('email.templates redesign', () => {
  beforeAll(() => {
    process.env.APP_URL = 'https://tumbu.web.id';
  });

  it('verify email uses APP_URL and shows logo + CTA', () => {
    const r = renderEmail({
      kind: 'EMAIL_VERIFY',
      to: 'a@b.c',
      name: 'Ada',
      token: 'tok123',
      expiresAt: '2026-12-01T10:00:00.000Z',
    });
    expect(r.html).toContain('https://tumbu.web.id/?verify=tok123');
    expect(r.html).not.toMatch(/trycloudflare|localhost/);
    expect(r.html).toContain('tumbu-logo-light.svg');
    expect(r.html).toContain('Verifikasi Email Saya');
    expect(r.html).toContain('Tautan berlaku hingga');
    expect(r.text).toContain('tok123');
    expect(formatExpiresId('2026-12-01T10:00:00.000Z')).toMatch(/2026|Des|Desember|12/i);
  });

  it('renders all kinds without forbidden hosts', () => {
    const kinds = [
      'EMAIL_VERIFY', 'PASSWORD_RESET', 'PASSWORD_RESET_DONE', 'WELCOME',
      'INVOICE_CREATED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED',
      'TRIAL_REMINDER', 'SUBSCRIPTION_EXPIRED',
    ] as const;
    for (const kind of kinds) {
      const r = renderEmail({ kind, to: 'x@y.z', name: 'X', token: 't', invoiceNumber: 'INV-1', amount: 49000 });
      expect(r.html).toContain('tumbu-logo');
      expect(r.html + r.text).not.toMatch(/trycloudflare|localhost:|127\.0\.0\.1/);
    }
  });
});

describe('EmailService status', () => {
  const prev: Record<string, string | undefined> = {};
  afterEach(() => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
  function stash(keys: string[]) {
    for (const k of keys) prev[k] = process.env[k];
  }

  it('reports configured when resend env present', () => {
    stash(['EMAIL_PROVIDER', 'RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL']);
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'TUMBU <halo@tumbu.web.id>';
    process.env.APP_URL = 'https://tumbu.web.id';
    const svc = new EmailService();
    const s = svc.status();
    expect(s.provider).toBe('resend');
    expect(s.configured).toBe(true);
    expect(s.appUrl).toBe('https://tumbu.web.id');
  });

  it('send returns accepted:false without crashing when key missing', async () => {
    stash(['EMAIL_PROVIDER', 'RESEND_API_KEY', 'EMAIL_FROM']);
    process.env.EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = 'TUMBU <halo@tumbu.web.id>';
    const svc = new EmailService();
    const r = await svc.sendSafe({ kind: 'WELCOME', to: 'user@example.com', name: 'U' });
    expect(r.accepted).toBe(false);
    expect(r.channel).toBe('resend');
  });
});
