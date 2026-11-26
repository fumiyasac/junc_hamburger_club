---
name: playwright-e2e-flow
description: webfront (Next.js) の E2E フローを Playwright で追加するとき、tests/e2e/ の既存規約 (getByRole 優先 + 限定的な data-testid / global-setup / API ヘルパ / バックエンド起動前提) に沿わせる。「webfront の E2E 追加」「管理画面の Playwright テスト」「Next.js 側の受け入れテスト」などで使用する。Flutter/mobile の E2E は maestro-e2e-flow を参照。
---

# Playwright E2E フロー追加 (webfront)

Web (Next.js) の E2E は Playwright で `tests/e2e/` に書く。Flutter は Maestro (`maestro-e2e-flow` Skill) 。

前提:
- `local-dev-env` Skill の `scripts/dev-up.sh` でバックエンド起動済み
- `junc_hamburger_club_webfront/CLAUDE.md`
- `.claude/skills/api-smoke-test/SKILL.md` (テスト用データを API 経由で作る方針)

## クイック実行

```bash
cd junc_hamburger_club_webfront
npm run build && npm run start &    # 3002
npm run e2e                           # Playwright 実行
npm run e2e:ui                        # UI モード (デバッグ用)
```

## ディレクトリ

```
junc_hamburger_club_webfront/
├── playwright.config.ts              # baseURL / trace / webServer
├── tests/e2e/
│   ├── helpers/
│   │   ├── api.ts                    # User API / Admin API を叩くヘルパ (registerTestUser 等)
│   │   └── admin-auth.ts             # localStorage に admin token を書く loginAsAdmin
│   ├── admin/
│   │   ├── login-dashboard.spec.ts
│   │   ├── orders.spec.ts
│   │   ├── options.spec.ts
│   │   └── pickup-settings.spec.ts
│   └── public/
│       ├── menu.spec.ts
│       └── news.spec.ts
```

## 規約

### 1. 要素特定の優先順位

| 優先 | 手法 | 用途 |
|---|---|---|
| 1 | `page.getByRole('heading', { name: '...', exact: true })` | 見出し、ボタン、リンク (重複のない静的要素) |
| 2 | `page.getByLabel('ラベル')` | TextField、form 要素 |
| 3 | `page.getByText(/正規表現/)` | 動的データのプレフィクス一致 |
| 4 | `data-testid` | 動的 ID を含むカード・ボタン (`order-card-${id}`, `status-btn-${status}` など) |

**data-testid の追加は最後の手段**。追加する場合は `<screen>-<element>-<id?>` の形で命名:

既存 testid 命名パターン:
- `order-card-<id>` / `status-btn-<status>` (orders)
- `option-row-<id>` / `option-availability-<id>` / `toggle-availability-<id>` (options)

### 2. テストデータの作り方

**既存の seed に依存しない**: テストの前に `tests/e2e/helpers/api.ts` の関数で User API を叩いて必要なレコードを作る:

```ts
import { registerTestUser, createReceivedOrder, adminLogin } from '../helpers/api'

// 毎回ユニークな email でユーザー登録 (DB 残りが干渉しない)
const user = await registerTestUser()
const order = await createReceivedOrder(user.accessToken)
```

- unique email: `e2e-${Date.now()}-${random}@example.com` で衝突回避
- 注文は Idempotency-Key 付きで作成
- **複数テスト間での干渉を避けたい場合はテスト内で明示的に作成** (afterEach で消す必要がない限り)

### 3. 時刻依存の扱い

受け取り枠は `lead_time` で埋まることがあるため、`helpers/api.ts` の `createReceivedOrder` は **7 日先まで** 順に available slot を探す。固定の日付や「今日の 12 時」等をハードコードしない。

### 4. 待機

- **固定 sleep 禁止**。`await expect(...).toBeVisible()` の auto-wait に任せる
- API レスポンス待ちは `await expect(page.getByText(/保存しました/)).toBeVisible({ timeout: 10_000 })` のように expect で待つ
- `page.waitForTimeout(...)` は禁止

### 5. 認証

- **admin**: `helpers/admin-auth.ts` の `loginAsAdmin(page)` で localStorage に `junc_admin_token` を書く → 認証済みページを開ける
- **公開ユーザー**: 必要に応じて `registerTestUser()` で accessToken を取得し、`page.evaluate` で `localStorage` に入れる or `useAuth` の仕様に合わせる

### 6. シークレットの扱い

- **ハードコード禁止**。環境変数から読む:
  - `E2E_USER_API_URL` / `E2E_ADMIN_API_URL` (default: localhost)
  - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD_PLAIN` (`.env` の `ADMIN_PASSWORD_HASH` に対応する平文)
- CI では workflow の `env:` で注入

### 7. トレース・スクリーンショット

`playwright.config.ts` で以下を設定済み:
- `trace: 'retain-on-failure'` → 失敗時のみ保存
- `screenshot: 'only-on-failure'`
- `video: 'retain-on-failure'`

ローカル確認: `npx playwright show-trace test-results/<dir>/trace.zip`

## 作業手順

1. どの画面・業務フローをカバーするか決める (verification_manual.md の項目番号を参照)
2. 既存 spec の近い例をコピー (`admin/orders.spec.ts` や `public/menu.spec.ts`)
3. **要素特定を getByRole で書けないか試す** → 無理なら最小限の data-testid を追加
4. テストデータが必要なら `helpers/api.ts` の関数を使うか、新しい関数を追加
5. ローカルで `./scripts/dev-up.sh` → `cd webfront && npm run dev` → `npm run e2e` で検証
6. CI (`webfront.yml` の e2e ジョブ) が緑になるか push 後に確認

## 最終チェックリスト

- [ ] `getByRole` / `getByLabel` / `getByText` を使い、やむを得ない場合のみ `data-testid` を追加
- [ ] 固定 sleep / `waitForTimeout` を使っていない
- [ ] seed に依存せず、テストで必要なデータは API で作成
- [ ] 時刻・現在日に依存するロジックを避けた (受け取り枠の pickup slot 等)
- [ ] シークレットは env 経由
- [ ] ローカルで `npm run e2e` が緑
- [ ] CI 緑 (webfront.yml の e2e ジョブ)

## 禁止事項

- **固定 sleep** (`page.waitForTimeout`)
- **シード依存のテスト** (特定の email や特定の注文番号を前提)
- **シークレットのハードコード**
- **Flutter / mobile の E2E をここに書く** (`maestro-e2e-flow` に分離)
- **並列実行** (管理操作が多いので `workers: 1`、必要に応じて spec を分離)
