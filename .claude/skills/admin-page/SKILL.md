---
name: admin-page
description: Next.js 管理画面 (junc_hamburger_club_webfront/src/app/(admin)/admin/) に一覧・詳細・編集ページを追加するとき、useAdminAuth + AdminSidebar + src/lib/api.ts の既存パターンと Tailwind のデザイントークンに揃える。「管理画面にページ追加」「admin に一覧を」「Next.js の admin ページ」などの依頼で使用する。
---

# Next.js 管理画面ページ追加の手順

管理画面は `src/app/(admin)/admin/<topic>/page.tsx` の形式で配置される。全ページ `'use client'` で、認証・API 呼び出し・レイアウトに定型パターンがある。

前提は [`junc_hamburger_club_webfront/CLAUDE.md`](../../../junc_hamburger_club_webfront/CLAUDE.md) 参照。

## 既存ルート

```
src/app/(admin)/admin/
├── login/              管理者ログイン (唯一認証不要)
├── dashboard/          ダッシュボード
├── orders/             注文管理 (status フィルタ + ステータス更新)
├── burgers/            バーガー CRUD
└── users/              ユーザー有効/無効切替
```

新規追加は `src/app/(admin)/admin/<topic>/page.tsx` を作る。

## 共通規約

| 項目 | ルール |
|---|---|
| ファイル先頭 | `'use client'` (admin 配下は全て Client Component) |
| 認証 | [`useAdminAuth()`](../../../junc_hamburger_club_webfront/src/hooks/useAdminAuth.ts) から `token` / `isLoading` / `isAuthenticated` を取得、未認証なら `router.replace('/admin/login')` |
| API 呼び出し | [`src/lib/api.ts`](../../../junc_hamburger_club_webfront/src/lib/api.ts) の `request<T>` 経由。認証付きは `authHeader(token)` を渡す |
| 型 | [`src/lib/types.ts`](../../../junc_hamburger_club_webfront/src/lib/types.ts) に追加。**ID は必ず string** |
| レイアウト | `<div className="flex min-h-screen"><AdminSidebar /><main className="flex-1 p-8">...</main></div>` |
| カラー | Tailwind トークン (`primary` / `primary-dark` / `primary-light` 等)。hex ハードコード禁止 |
| ユーティリティ | `clsx` で条件付き className。`formatPrice()` / `formatDate()` は `src/lib/utils.ts` |
| 削除・破壊的操作 | `confirm('<msg>')` でブラウザ確認ダイアログ → 成功後に一覧を再フェッチ |

## 作業順序

### 1. API クライアント追加

[`src/lib/api.ts`](../../../junc_hamburger_club_webfront/src/lib/api.ts) の `// ── Admin API ──` 以降に `adminXxxApi` オブジェクトを追加。認証必須なので全メソッドで `token` を受け取る。

[`templates/api-client-section.ts`](templates/api-client-section.ts) を参考に追加。

### 2. 型定義

[`src/lib/types.ts`](../../../junc_hamburger_club_webfront/src/lib/types.ts) に interface を追加。ID は string。既存の `Order` を拡張するなら `extends Order` + 追加フィールド。

### 3. サイドバーにナビゲーション追加 (トップレベル項目の場合)

[`src/components/admin/AdminSidebar.tsx`](../../../junc_hamburger_club_webfront/src/components/admin/AdminSidebar.tsx) の `NAV` 定数に追加:

```tsx
const NAV = [
  { href: '/admin/dashboard', label: 'ダッシュボード', icon: '📊' },
  // ...
  { href: '/admin/reviews', label: 'レビュー管理', icon: '⭐' },
]
```

既存ページ配下の詳細/編集ページ (`/admin/reviews/[id]` 等) なら NAV 変更不要。

### 4. ページを作成

`src/app/(admin)/admin/<topic>/page.tsx` を作成。[`templates/list-page.tsx`](templates/list-page.tsx) が一覧ページの典型。

**認証の定型**:

```tsx
const { token, isLoading, isAuthenticated } = useAdminAuth()
const router = useRouter()

useEffect(() => {
  if (!isLoading && !isAuthenticated) router.replace('/admin/login')
}, [isLoading, isAuthenticated, router])

if (isLoading) return null
```

**データ取得の定型** (useCallback + useEffect で安定化):

```tsx
const fetchItems = useCallback(async () => {
  if (!token) return
  setLoading(true)
  try {
    const result = await adminReviewApi.list(token)
    setItems(result.items)
  } catch (err) {
    console.error(err)
  } finally {
    setLoading(false)
  }
}, [token])

useEffect(() => { fetchItems() }, [fetchItems])
```

### 5. 動作確認

```bash
# バックエンド起動
cd junc_hamburger_club_backend && docker compose up -d --build

# Next.js 起動
cd junc_hamburger_club_webfront && npm run dev
# → http://localhost:3002/admin/login で管理者ログイン後、/admin/<topic> を確認

# 型チェック
npx tsc --noEmit
```

## UI パーツの定型

### テーブル (一覧表示)

```tsx
<div className="card overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
      <tr>
        <th className="text-left px-4 py-3">名前</th>
        <th className="text-right px-4 py-3">価格</th>
        <th className="text-center px-4 py-3">操作</th>
      </tr>
    </thead>
    <tbody>
      {items.map(it => (
        <tr key={it.id} className="border-t">...</tr>
      ))}
    </tbody>
  </table>
</div>
```

### ステータスバッジ

```tsx
<span className="badge bg-primary-light text-primary">人気</span>
```

### アクションボタン

```tsx
<button
  onClick={() => toggleAvailability(it.id)}
  className="text-primary hover:underline"
>
  切り替え
</button>
```

## 最終チェックリスト

- [ ] ファイル先頭に `'use client'`
- [ ] `useAdminAuth()` で認証チェックし、未認証なら `/admin/login` にリダイレクト
- [ ] `AdminSidebar` を左に配置
- [ ] API は `src/lib/api.ts` の `adminXxxApi` 経由 (直接 `fetch` 書かない)
- [ ] 型は `src/lib/types.ts` に追加し、ID は string
- [ ] tailwind トークン使用 (`primary` 等)、hex ハードコードなし
- [ ] 破壊的操作は `confirm()` で確認、成功後に再フェッチ
- [ ] `npx tsc --noEmit` エラーなし
- [ ] `npm run dev` で起動、該当ページを目視確認

## 禁止事項

- **サーバーサイドで管理 API を叩かない**: admin ページは RSC ではなく Client Component (`'use client'`) で、クライアントから直接 `localStorage` の token を使う。Server Components から fetch する構成にしない
- **`fetch` の直書き禁止**: 必ず `src/lib/api.ts` の `request<T>` 経由
- **既存 `(public)` ルート配下に admin ページを置かない** (Header/Footer が付いてしまう)
