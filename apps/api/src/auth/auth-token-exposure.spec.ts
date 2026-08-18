/**
 * Auth token exposure gate — production must never leak verify/reset tokens in API responses.
 * Exposure only when AUTH_EXPOSE_* = 1 outside production gate (Resend production never exposes).
 */

function shouldExposeAuthToken(opts: {
  tumuEnv?: string;
  requireStrict?: string;
  exposeFlag?: string;
  tokenKind: 'verify' | 'reset';
}): boolean {
  const isProdGate =
    opts.tumuEnv === 'production' || opts.requireStrict === '1';
  const exposeFlag =
    opts.tokenKind === 'verify'
      ? opts.exposeFlag ?? process.env.AUTH_EXPOSE_VERIFY_TOKEN
      : opts.exposeFlag ?? process.env.AUTH_EXPOSE_RESET_TOKEN;
  return !isProdGate && exposeFlag === '1';
}

describe('Auth token exposure (production hardening)', () => {
  it('never exposes tokens when TUMBU_ENV=production', () => {
    expect(
      shouldExposeAuthToken({
        tumuEnv: 'production',
        exposeFlag: '1',
        tokenKind: 'verify',
      }),
    ).toBe(false);
    expect(
      shouldExposeAuthToken({
        requireStrict: '1',
        exposeFlag: '1',
        tokenKind: 'reset',
      }),
    ).toBe(false);
  });

  it('never exposes when AUTH_EXPOSE flags are 0', () => {
    expect(
      shouldExposeAuthToken({
        tumuEnv: 'development',
        exposeFlag: '0',
        tokenKind: 'verify',
      }),
    ).toBe(false);
  });

  it('allows expose only outside production when flag is 1', () => {
    expect(
      shouldExposeAuthToken({
        tumuEnv: 'development',
        exposeFlag: '1',
        tokenKind: 'verify',
      }),
    ).toBe(true);
  });
});

export { shouldExposeAuthToken };
