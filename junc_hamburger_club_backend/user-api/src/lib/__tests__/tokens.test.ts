// Access token / Refresh token の発行とハッシュ化のみの純粋関数テスト。
// (DB を使う rotation の統合テストは jest-integration or curl E2E でカバー)
process.env.JWT_SECRET = 'test_secret_at_least_32_chars_long_xxxx';

import { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from '../tokens';

describe('access token', () => {
  test('sign/verify round trip', () => {
    const token = signAccessToken({ userId: 1, email: 'a@b.com', sid: 'abc' });
    const p = verifyAccessToken(token);
    expect(p.userId).toBe(1);
    expect(p.email).toBe('a@b.com');
    expect(p.sid).toBe('abc');
  });
  test('tampered token fails verify', () => {
    const token = signAccessToken({ userId: 1, email: 'a@b.com', sid: 'abc' });
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe('refresh token', () => {
  test('generateRefreshToken returns 64-hex plaintext + 64-hex hash', () => {
    const { plaintext, hash } = generateRefreshToken();
    expect(plaintext).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(plaintext).not.toBe(hash);
  });
  test('two generations are different', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.plaintext).not.toBe(b.plaintext);
  });
  test('hashToken is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
