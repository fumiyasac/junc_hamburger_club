// 起動時の環境変数検証。危険なデフォルト値が本番に漏れないよう明示的に fail する。

const MIN_SECRET_LEN = 32;

function requireEnv(name: string, opts: { minLength?: number } = {}): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[env] ${name} is required`);
  }
  if (opts.minLength && value.length < opts.minLength) {
    throw new Error(`[env] ${name} must be at least ${opts.minLength} chars (got ${value.length})`);
  }
  if (value === 'secret' || value === 'change_me') {
    throw new Error(`[env] ${name} must not be a placeholder value`);
  }
  return value;
}

export const env = {
  JWT_SECRET: requireEnv('JWT_SECRET', { minLength: MIN_SECRET_LEN }),
  ACCESS_TOKEN_TTL_SEC: Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 15 * 60),
  REFRESH_TOKEN_TTL_SEC: Number(process.env.REFRESH_TOKEN_TTL_SEC ?? 30 * 24 * 60 * 60),
  REFRESH_ROTATION_GRACE_SEC: Number(process.env.REFRESH_ROTATION_GRACE_SEC ?? 90),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
