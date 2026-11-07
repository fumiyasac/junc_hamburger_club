# CLAUDE.md — Web フロントエンド (Next.js)

Next.js 15 (App Router) + TypeScript + Tailwind 3。詳細は [`../README.md`](../README.md) §7 を参照。

## ルートグループ

```
src/app/
├── (public)/   # 公開サイト — Header / Footer あり / 基本 RSC
│   ├── page.tsx                トップ
│   ├── menu/page.tsx           メニュー一覧
│   ├── menu/[id]/page.tsx      メニュー詳細
│   └── auth/page.tsx           ログイン / 新規登録
└── (admin)/    # 管理画面 — AdminSidebar / 全て Client Component ("use client")
    └── admin/
        ├── login/              管理者ログイン
        ├── dashboard/
        ├── orders/
        ├── burgers/
        └── users/
```

- `(public)` 配下はデフォルト RSC。フェッチはサーバー側で `burgerApi.*` を直接 await。`export const revalidate = 60` などで ISR 制御
- `(admin)` 配下はインタラクション中心なので全ページ Client Component。認証は `src/hooks/useAdminAuth.ts`

## API クライアントと環境変数

- クライアント: `src/lib/api.ts` (`burgerApi` / `adminBurgerApi` など)
- 型: `src/lib/types.ts`
- `.env.local` に以下を設定:

```
NEXT_PUBLIC_USER_API_URL=http://localhost:3100/api/v1
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:8080/api/v1/admin
```

## バーガー画像

- ローカル画像は `public/burgers/{id}.jpg` (id: 1〜20)
- 解決は `src/lib/utils.ts` の `resolveBurgerImage(id, fallback)` を使う。ID が 1〜20 にあればローカル画像、それ以外は API 由来 `imageUrl` にフォールバック
- 新しい外部ドメインから画像を読み込みたい場合は `next.config.ts` の `images.remotePatterns` を追加する必要あり

## カラートークン

カラーは Tailwind トークン (`tailwind.config.ts`) と CSS 変数 (`src/app/globals.css`) の 2 箇所で定義されている。**値を変える時は必ず両方を同じ値で更新する**。ハードコードされた `#` 値ではなく `primary` / `secondary` / `accent` / `primary-dark` / `primary-light` / `background` を使うこと。

## 常用コマンド

```bash
npm install
npm run dev          # http://localhost:3002
npm run build
npm run start
npx tsc --noEmit     # 型チェックのみ
```

`autoprefixer` は PostCSS 経由で必須依存。削除しないこと。
