# 🍔 JUNC Hamburger Club

ハンバーガーのモバイルオーダーアプリのサンプルプロジェクトです。  
Flutter モバイルアプリ・TypeScript/Go バックエンド・Next.js Web フロントエンドの 3 コンポーネントで構成されています。

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [ディレクトリ構成](#2-ディレクトリ構成)
3. [技術スタック](#3-技術スタック)
4. [デザインシステム](#4-デザインシステム)
5. [事前準備（共通）](#5-事前準備共通)
6. [バックエンド セットアップ](#6-バックエンド-セットアップ)
7. [Web フロントエンド セットアップ](#7-web-フロントエンド-セットアップ)
8. [Flutter モバイルアプリ セットアップ](#8-flutter-モバイルアプリ-セットアップ)
9. [iOS 検証手順](#9-ios-検証手順)
10. [Android 検証手順](#10-android-検証手順)
11. [API ドキュメント](#11-api-ドキュメント)
12. [主要な画面フロー](#12-主要な画面フロー)
13. [トラブルシューティング](#13-トラブルシューティング)

---

## 1. プロジェクト概要

| コンポーネント | 内容 | ポート |
|---|---|---|
| **Flutter モバイルアプリ** | ユーザー向けオーダーアプリ (iOS/Android) | — |
| **TypeScript User API** | ユーザー向け REST API (Express.js) | 3000 |
| **Go Admin API** | 管理者向け REST API (Gin) | 8080 |
| **MySQL** | データベース | 3306 |
| **Next.js Web** | 公開サイト + 管理画面 | 3001 |

### 実装済み機能

- オンボーディング・会員登録 / ログイン
- バーガー一覧 (カテゴリフィルタ・人気商品)
- バーガー検索 (400ms デバウンス)
- バーガー詳細（食材・タグ・評価）
- カート管理（数量変更・削除）
- 注文作成・注文完了画面
- 注文ステータス リアルタイム追跡 (5 秒ポーリング)
- 管理画面 (ダッシュボード・注文管理・バーガー管理・ユーザー管理)

---

## 2. ディレクトリ構成

```
junc_hamburger_club/
├── junc_hamburger_club_mobile/     # Flutter アプリ
│   └── lib/
│       ├── core/
│       │   ├── constants/          # API エンドポイント定数
│       │   ├── router/             # GoRouter 設定
│       │   ├── services/           # Dio HTTP クライアント
│       │   └── theme/              # AppColors / AppTheme
│       ├── data/
│       │   ├── models/             # Burger / CartItem / Order / User
│       │   ├── repositories/       # Repository 実装 (Mock)
│       │   └── sources/            # mock_data.dart
│       ├── presentation/
│       │   ├── screens/            # 各画面
│       │   └── widgets/            # 共通ウィジェット
│       ├── providers/              # Riverpod Provider 定義
│       └── viewmodels/             # MVVM ViewModels
│
├── junc_hamburger_club_backend/    # バックエンド
│   ├── docker-compose.yml
│   ├── Dockerfile.user-api
│   ├── .env.example
│   ├── init-db/
│   │   ├── 01_schema.sql           # テーブル定義
│   │   └── 02_seed_data.sql        # 初期データ (20 バーガー)
│   ├── user-api/                   # TypeScript Express API
│   │   ├── src/
│   │   │   ├── controllers/        # auth / burger / cart / order / user
│   │   │   ├── middleware/         # JWT 認証 / エラーハンドラー
│   │   │   ├── routes/             # ルート定義
│   │   │   ├── config/             # MySQL 接続設定
│   │   │   └── types/              # 型定義
│   │   └── swagger/openapi.yaml    # OpenAPI 3.0 仕様書
│   └── admin-api/                  # Go Gin API
│       ├── config/                 # 設定 / DB 接続
│       ├── handlers/               # auth / burger / order / user / dashboard
│       ├── middleware/             # JWT 認証 / CORS
│       ├── models/                 # モデル定義
│       ├── router/                 # Gin ルーター
│       ├── docs/swagger.yaml       # OpenAPI 3.0 仕様書
│       └── Dockerfile
│
└── junc_hamburger_club_webfront/   # Next.js フロントエンド
    └── src/
        ├── app/
        │   ├── (public)/           # 公開サイト (Header+Footer あり)
        │   │   ├── page.tsx        # トップ
        │   │   ├── menu/           # メニュー一覧・詳細
        │   │   └── auth/           # ログイン/登録
        │   └── (admin)/            # 管理画面 (ダークテーマ)
        │       └── admin/
        │           ├── login/
        │           ├── dashboard/
        │           ├── orders/
        │           ├── burgers/
        │           └── users/
        ├── components/
        │   ├── public/             # Header / Footer
        │   └── admin/              # AdminSidebar
        ├── hooks/                  # useAuth / useAdminAuth
        └── lib/                    # api.ts / types.ts / utils.ts
```

---

## 3. 技術スタック

### Flutter モバイルアプリ

| 項目 | 技術 |
|---|---|
| フレームワーク | Flutter 3.x (Dart) |
| 状態管理 | **Riverpod 3.x** (Notifier / AsyncNotifier) |
| アーキテクチャ | MVVM + Repository パターン |
| ルーティング | GoRouter 14.x (ShellRoute) |
| HTTP クライアント | Dio 5.x |
| ローカルストレージ | SharedPreferences |
| UI | Material 3, Google Fonts (Nunito), shimmer |

> **重要**: freezed・StateNotifier・コード生成 (@riverpod) は**一切使用していません**。

### バックエンド

| 項目 | 技術 |
|---|---|
| DB | MySQL 8.0 (Docker) |
| User API | TypeScript + Express.js + mysql2 |
| Admin API | Go 1.22 + Gin + go-sql-driver |
| 認証 | JWT (HS256, 7d / 24h) |
| API 仕様 | OpenAPI 3.0 (Swagger) |
| インフラ | Docker Compose |

### Web フロントエンド

| 項目 | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS 3 |
| レンダリング | RSC (公開サイト) + Client Components (管理画面) |

---

## 4. デザインシステム

モバイルアプリ・Web 共通のカラーパレット。

| カラー名 | HEX | 用途 |
|---|---|---|
| Primary | `#FF6B6B` | メインアクション・ボタン・アクセント |
| Secondary | `#FFD93D` | CTA バナー・ハイライト |
| Accent | `#6BCB77` | 成功・アクティブ状態 |
| Background | `#FFF8F8` | 画面背景 |

フォント: **Nunito** (400 / 600 / 700 / 800 / 900)

---

## 5. 事前準備（共通）

### 必須ツール

```bash
# バージョン確認コマンド一覧
flutter --version        # 3.x 以上
dart --version           # 3.3.0 以上
docker --version         # 20.x 以上
docker compose version   # v2.x 以上
node --version           # 20.x 以上
npm --version            # 10.x 以上
go version               # 1.22 以上 (Admin API のローカル開発時のみ)
```

### インストール手順（未インストールの場合）

```bash
# Flutter (公式インストーラー推奨)
# https://docs.flutter.dev/get-started/install/macos

# Docker Desktop for Mac
# https://docs.docker.com/desktop/install/mac-install/

# Node.js (volta 推奨)
curl https://get.volta.sh | bash
volta install node@20

# Go
brew install go
```

---

## 6. バックエンド セットアップ

### 6-1. 環境変数の設定

```bash
cd junc_hamburger_club_backend

# テンプレートをコピーして編集
cp .env.example .env
```

`.env` の編集:

```dotenv
MYSQL_ROOT_PASSWORD=rootpassword        # 任意の強いパスワードに変更
MYSQL_DATABASE=junc_hamburger
MYSQL_USER=junc_user
MYSQL_PASSWORD=junc_password            # 任意の強いパスワードに変更
JWT_SECRET=your_jwt_secret_here         # ランダムな長い文字列に変更
NODE_ENV=development
```

### 6-2. Docker Compose で起動

```bash
cd junc_hamburger_club_backend

# 初回ビルド＆起動 (MySQL 初期化 + シードデータ投入に 30〜60 秒かかります)
docker compose up -d --build

# ログ確認
docker compose logs -f

# 全サービスの状態確認
docker compose ps
```

正常起動時の出力例:

```
NAME              STATUS          PORTS
junc_mysql        running (healthy)   0.0.0.0:3306->3306/tcp
junc_user_api     running         0.0.0.0:3000->3000/tcp
junc_admin_api    running         0.0.0.0:8080->8080/tcp
```

### 6-3. 動作確認

```bash
# User API ヘルスチェック
curl http://localhost:3000/health
# => {"status":"ok","service":"junc-user-api"}

# Admin API ヘルスチェック
curl http://localhost:8080/health
# => {"status":"ok","service":"junc-admin-api"}

# バーガー一覧 (認証不要)
curl http://localhost:3000/api/v1/burgers | jq '.data.burgers | length'
# => 20
```

### 6-4. データベース直接確認

```bash
# MySQL コンテナに接続
docker exec -it junc_mysql mysql -u junc_user -pjunc_password junc_hamburger

# テーブル一覧
SHOW TABLES;

# バーガー確認
SELECT id, name, price FROM burgers LIMIT 5;

# 終了
EXIT;
```

### 6-5. サービスの停止・再起動

```bash
# 停止 (データは保持)
docker compose down

# データも含めて完全削除 (初期化したいとき)
docker compose down -v

# 特定サービスのみ再起動
docker compose restart user-api
docker compose restart admin-api
```

---

## 7. Web フロントエンド セットアップ

### 7-1. 依存パッケージのインストール

```bash
cd junc_hamburger_club_webfront

npm install
```

### 7-2. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` の内容:

```dotenv
NEXT_PUBLIC_USER_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:8080/api/v1/admin
```

### 7-3. 開発サーバー起動

```bash
npm run dev
# => http://localhost:3001 で起動
```

### 7-4. 各ページへのアクセス

| URL | 内容 |
|---|---|
| `http://localhost:3001` | トップページ |
| `http://localhost:3001/menu` | メニュー一覧 |
| `http://localhost:3001/menu/:id` | バーガー詳細 |
| `http://localhost:3001/auth` | ログイン / 新規登録 |
| `http://localhost:3001/admin/login` | 管理者ログイン |
| `http://localhost:3001/admin/dashboard` | 管理ダッシュボード |
| `http://localhost:3001/admin/orders` | 注文管理 |
| `http://localhost:3001/admin/burgers` | バーガー管理 |
| `http://localhost:3001/admin/users` | ユーザー管理 |

### 7-5. プロダクションビルド

```bash
npm run build
npm run start  # ポート 3001 で本番起動
```

---

## 8. Flutter モバイルアプリ セットアップ

### 8-1. 依存パッケージの取得

```bash
cd junc_hamburger_club_mobile

flutter pub get
```

### 8-2. Flutter 環境の診断

```bash
flutter doctor -v
```

よく見るべき項目:

- `[✓] Flutter` — SDK バージョン確認
- `[✓] Xcode` — iOS ビルドに必要 (macOS のみ)
- `[✓] Android toolchain` — Android ビルドに必要
- `[✓] Connected device` — 接続デバイス確認

### 8-3. 接続デバイスの確認

```bash
# 利用可能なデバイス・シミュレーター一覧
flutter devices
```

出力例:

```
3 connected devices:
iPhone 16 Pro (mobile)           • 00008140-... • ios           • iOS 18.x
sdk gphone64 arm64 (mobile)      • emulator-5554 • android-arm64 • Android 14
macOS (desktop)                  • macos         • darwin-arm64  • macOS 15.x
```

### 8-4. アプリの起動

```bash
# デフォルトデバイスで起動 (Hot Reload 有効)
flutter run

# デバイスを明示指定
flutter run -d "iPhone 16 Pro"
flutter run -d emulator-5554

# リリースモードで起動 (本番に近いパフォーマンス確認)
flutter run --release
```

### 8-5. ログの確認

```bash
# 詳細ログ付きで起動
flutter run --verbose

# 起動中のアプリのログのみ表示
flutter logs
```

---

## 9. iOS 検証手順

### 9-1. 必要環境

| 必要項目 | 確認方法 |
|---|---|
| macOS | `sw_vers` |
| Xcode 16.x 以上 | `xcode-select -p` → `xcodebuild -version` |
| CocoaPods | `pod --version` |
| iOS シミュレーター または 実機 | Xcode > Window > Devices and Simulators |

```bash
# Xcode コマンドラインツールのインストール (初回のみ)
xcode-select --install

# CocoaPods のインストール (初回のみ)
sudo gem install cocoapods
# または
brew install cocoapods

# iOS 依存関係の解決
cd junc_hamburger_club_mobile/ios
pod install
cd ..
```

### 9-2. iOS シミュレーターでの検証

#### シミュレーターの起動

```bash
# 利用可能なシミュレーター一覧
xcrun simctl list devices available

# 特定シミュレーターで Flutter アプリを起動
flutter run -d "iPhone 16 Pro"
flutter run -d "iPhone 16"
flutter run -d "iPad Pro 13-inch (M4)"
```

または Xcode から直接起動:

1. Xcode を開く
2. `junc_hamburger_club_mobile/ios/Runner.xcworkspace` を開く
3. スキーム「Runner」・デバイスにシミュレーターを選択
4. `⌘ + R` でビルド & 起動

#### シミュレーター上での検証項目

**オンボーディング**

| # | 操作 | 期待動作 |
|---|---|---|
| 1 | アプリ起動 | オンボーディング画面が表示される |
| 2 | 横スワイプ | ページが切り替わる (インジケーター連動) |
| 3 | 3ページ目で「始める」タップ | 登録/ログイン画面に遷移 |

**会員登録 / ログイン**

| # | 操作 | 期待動作 |
|---|---|---|
| 4 | 「新規登録」タブを選択 | 入力フォームが切り替わる |
| 5 | 名前・メール・パスワードを入力して「登録する」 | ホーム画面に遷移する |
| 6 | 一度ログアウトしてから「ログイン」タブで再ログイン | ホーム画面に遷移する |
| 7 | 無効なメールアドレスで登録 | バリデーションエラーが表示される |
| 8 | 7文字以下のパスワードで登録 | バリデーションエラーが表示される |

**ホーム画面**

| # | 操作 | 期待動作 |
|---|---|---|
| 9 | ホーム表示時 | シマー(骨格)ローディングが表示された後データが表示される |
| 10 | カテゴリチップをタップ | 選択されたカテゴリのバーガーのみ表示される |
| 11 | 「人気」セクションを確認 | 人気バーガーが横スクロールで表示される |
| 12 | バーガーカードをタップ | 詳細画面に遷移する |
| 13 | 下プルで更新 | データが再取得される |

**バーガー詳細**

| # | 操作 | 期待動作 |
|---|---|---|
| 14 | 詳細画面表示 | SliverAppBar がヒーロー画像付きで表示される |
| 15 | スクロールダウン | AppBar が収縮してタイトルが表示される |
| 16 | 数量「+」ボタンをタップ | 数量が増加する |
| 17 | 「カートに追加」をタップ | 成功スナックバーが表示される・カートバッジが更新される |
| 18 | 既にカートにある商品をタップ | 「カートに入っています」状態になっている |

**検索**

| # | 操作 | 期待動作 |
|---|---|---|
| 19 | 検索バーに「チーズ」と入力 | 400ms 後に検索結果が表示される |
| 20 | 検索バーをクリア | 空の状態に戻る |
| 21 | ヒットしないキーワードで検索 | 「見つかりませんでした」状態が表示される |

**カート**

| # | 操作 | 期待動作 |
|---|---|---|
| 22 | カートアイコンをタップ | カート画面が表示される |
| 23 | 数量を変更 | 小計・合計がリアルタイム更新される |
| 24 | 「ー」で数量を 1 以下にする | アイテムが削除される |
| 25 | 「注文する」をタップ | 確認ダイアログが表示される |
| 26 | 注文確定 | 注文完了画面にバウンスアニメーションで遷移 |

**注文ステータス**

| # | 操作 | 期待動作 |
|---|---|---|
| 27 | 注文完了画面で「ステータスを確認」 | 注文ステータス画面に遷移 |
| 28 | 画面を開いたまま 15 秒待つ | ステータスが「受付済み」→「調理中」に自動更新される |
| 29 | 40 秒待つ | 「受取可能」に更新される |

### 9-3. 実機での検証 (iPhone)

#### 事前準備

1. **Apple Developer アカウント** (無料でも可)
2. iPhone を USB で Mac に接続
3. iPhone の「設定」>「プライバシーとセキュリティ」>「開発者モード」を ON
4. iPhone を「信頼」する

#### Xcode でのプロビジョニング設定

```bash
# Xcode でプロジェクトを開く
open junc_hamburger_club_mobile/ios/Runner.xcworkspace
```

Xcode で以下を設定:

1. `Runner` プロジェクト > `Signing & Capabilities`
2. `Team` に Apple ID を選択
3. `Bundle Identifier` を一意の値に変更  
   例: `com.yourname.junc-hamburger-club`
4. 「Automatically manage signing」を ON

```bash
# 実機デバイスの確認
flutter devices
# => iPhone の名前が表示されることを確認

# 実機で起動
flutter run -d <device_id>
```

#### 実機固有の確認項目

| # | 確認項目 | 手順 |
|---|---|---|
| 30 | Safe Area 対応 | ノッチ/Dynamic Island がある端末でコンテンツが隠れないか確認 |
| 31 | ダークモード | 設定 > 画面表示と明るさ > ダーク で切り替えて表示崩れがないか確認 |
| 32 | 文字サイズ | 設定 > アクセシビリティ > 文字サイズ を最大にして確認 |
| 33 | 縦横回転 | 横向きにしてレイアウトが崩れないか確認 |
| 34 | バックグラウンド復帰 | ホームボタンで離脱後に復帰して状態が保持されているか確認 |

### 9-4. iOS リリースビルドの確認

```bash
# リリースビルド (Archive は Xcode から)
flutter build ios --release

# 出力確認
ls build/ios/iphoneos/
# => Runner.app が生成される
```

Xcode での Archive 手順:

1. Xcode でデバイスを「Any iOS Device」に設定
2. メニュー > `Product` > `Archive`
3. Organizer から TestFlight または Ad Hoc でデプロイ

---

## 10. Android 検証手順

### 10-1. 必要環境

| 必要項目 | 確認方法 |
|---|---|
| Android Studio (Electric Eel 以上) | `android-studio -v` |
| Android SDK 34 以上 | Android Studio > SDK Manager |
| Java 17 以上 | `java --version` |
| AVD (エミュレーター) または 実機 | Android Studio > Device Manager |

```bash
# Android ツールチェーンの確認
flutter doctor --android-licenses
# → 全てのライセンスに y で承認

# sdkmanager で最新ビルドツールをインストール
sdkmanager "build-tools;34.0.0" "platforms;android-34"
```

### 10-2. Android エミュレーターでの検証

#### エミュレーターの起動

```bash
# 利用可能な AVD 一覧
emulator -list-avds

# AVD を起動 (バックグラウンドで)
emulator -avd Pixel_9_API_34 &

# アプリを起動
flutter run -d emulator-5554
```

または Android Studio から:

1. `Device Manager` > 「▶」 で AVD を起動
2. ターミナルで `flutter run`

#### エミュレーター上での検証項目

**基本動作**

| # | 操作 | 期待動作 |
|---|---|---|
| 1 | アプリ起動 | スプラッシュ後にオンボーディング画面が表示される |
| 2 | 物理バックボタン (ジェスチャー) | 適切に前の画面に戻る (ホーム画面では終了しない) |
| 3 | アプリを強制終了して再起動 | ログイン状態が保持されている |

**Android 固有の UI チェック**

| # | 確認項目 | 期待動作 |
|---|---|---|
| 4 | ステータスバー | 透明になっている (SystemUiOverlayStyle 設定確認) |
| 5 | ナビゲーションバー | 3 ボタン / ジェスチャーナビどちらでも操作できる |
| 6 | スクロール | OverscrollIndicator が表示される (Android 標準挙動) |
| 7 | スナックバー | 画面下部に適切に表示される |

**パーミッション確認**

本アプリは特殊なパーミッションを使用していませんが、以下を確認:

```bash
# アプリのパーミッション確認
adb shell dumpsys package com.junc.junc_hamburger_club | grep permission
```

### 10-3. 実機での検証 (Android)

#### 実機の開発者モード有効化

1. 「設定」>「端末情報」>「ビルド番号」を 7 回タップ
2. 「設定」>「開発者向けオプション」を開く
3. 「USB デバッグ」を ON にする
4. USB で PC に接続し「USBデバッグを許可しますか？」で「許可」

```bash
# 接続確認
adb devices
# => 端末のシリアル番号が表示される

# アプリをインストール & 起動
flutter run -d <device_serial>
```

#### 実機固有の確認項目

| # | 確認項目 | 手順 |
|---|---|---|
| 8 | ノッチ/パンチホール対応 | 全画面表示で UI 要素が隠れていないか確認 |
| 9 | ダークテーマ | 設定 > ダークテーマ ON で表示崩れがないか確認 |
| 10 | フォントサイズ | 設定 > ユーザー補助 > 文字サイズ を最大にして確認 |
| 11 | 低メモリ | Developer Options > Background process limit を「1 process」に設定してバックグラウンド復帰を確認 |
| 12 | 回転 | 横向きにしてレイアウトが崩れないか確認 |

### 10-4. Android リリースビルドの確認

```bash
# APK ビルド (テスト配布用)
flutter build apk --release

# 出力場所
ls build/app/outputs/flutter-apk/
# => app-release.apk

# 実機にインストール
adb install build/app/outputs/flutter-apk/app-release.apk

# AAB ビルド (Google Play 用)
flutter build appbundle --release
# => build/app/outputs/bundle/release/app-release.aab
```

#### APK の署名 (Play Store 公開時)

```bash
# キーストアの作成 (初回のみ)
keytool -genkey -v \
  -keystore ~/junc-release.keystore \
  -alias junc \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# key.properties を android/ に作成
cat > junc_hamburger_club_mobile/android/key.properties << EOF
storePassword=<パスワード>
keyPassword=<パスワード>
keyAlias=junc
storeFile=<keystoreのフルパス>
EOF
```

`android/app/build.gradle.kts` に署名設定を追加後:

```bash
flutter build appbundle --release
```

### 10-5. Android エミュレーターで localhost API に接続する場合

Android エミュレーターから `localhost` はエミュレーター自身を指すため、**ホスト PC の API には接続できません**。

```dart
// lib/core/constants/api_constants.dart を以下のように修正
static const String baseUrl = 'http://10.0.2.2:3000';   // エミュレーター用
// static const String baseUrl = 'http://localhost:3000'; // iOS シミュレーター用
```

または環境変数で切り替え:

```bash
# エミュレーター向けに起動
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

---

## 11. API ドキュメント

### Swagger UI (User API)

バックエンド起動後にブラウザでアクセス:

```
http://localhost:3000/api-docs
```

主要エンドポイント:

| メソッド | パス | 説明 | 認証 |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 会員登録 | 不要 |
| POST | `/api/v1/auth/login` | ログイン | 不要 |
| GET | `/api/v1/burgers` | バーガー一覧 | 不要 |
| GET | `/api/v1/burgers/search?q=` | バーガー検索 | 不要 |
| GET | `/api/v1/burgers/categories` | カテゴリ一覧 | 不要 |
| GET | `/api/v1/burgers/:id` | バーガー詳細 | 不要 |
| GET | `/api/v1/cart` | カート取得 | Bearer JWT |
| POST | `/api/v1/cart` | カートに追加 | Bearer JWT |
| PUT | `/api/v1/cart/:itemId` | 数量更新 | Bearer JWT |
| DELETE | `/api/v1/cart/:itemId` | アイテム削除 | Bearer JWT |
| POST | `/api/v1/orders` | 注文作成 | Bearer JWT |
| GET | `/api/v1/orders` | 注文履歴 | Bearer JWT |
| GET | `/api/v1/orders/:orderId` | 注文詳細 | Bearer JWT |
| GET | `/api/v1/users/me` | プロフィール取得 | Bearer JWT |

### Admin API ドキュメント

OpenAPI 仕様書: `junc_hamburger_club_backend/admin-api/docs/swagger.yaml`

主要エンドポイント (全て `/api/v1/admin/` プレフィックス):

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/login` | 管理者ログイン |
| GET | `/dashboard` | ダッシュボード統計 |
| GET | `/burgers` | バーガー一覧 |
| POST | `/burgers` | バーガー新規作成 |
| PUT | `/burgers/:id` | バーガー更新 |
| PUT | `/burgers/:id/availability` | 販売可否切り替え |
| GET | `/orders` | 注文一覧 (status フィルタ可) |
| PUT | `/orders/:id/status` | 注文ステータス更新 |
| GET | `/users` | ユーザー一覧 |
| PUT | `/users/:id/toggle` | ユーザー有効/無効切り替え |

### API の手動テスト (curl)

```bash
# 1. 会員登録
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"テストユーザー","email":"test@example.com","password":"password123"}' \
  | jq

# 2. ログインしてトークン取得
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.data.token')
echo "TOKEN: $TOKEN"

# 3. カートにバーガーを追加
curl -X POST http://localhost:3000/api/v1/cart \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"burgerId":"1","quantity":2}' \
  | jq

# 4. 注文作成
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"notes":"ソース多めでお願いします"}' \
  | jq
```

---

## 12. 主要な画面フロー

```
アプリ起動
    │
    ├── [未ログイン] → オンボーディング (3ページ)
    │                      └── 登録/ログイン画面
    │                              └── [認証成功] → ホーム
    │
    └── [ログイン済] → ホーム
                         ├── [カテゴリ選択] → カテゴリ別バーガー一覧
                         ├── [バーガータップ] → バーガー詳細
                         │                         └── [カートに追加] → カートバッジ更新
                         ├── [検索タブ] → 検索画面
                         └── [カートタブ] → カート画面
                                              └── [注文する] → 注文完了画面
                                                                   └── [ステータス確認] → 注文ステータス画面
                                                                                          (5秒ポーリングで自動更新)
```

### 注文ステータスの遷移 (モック)

| 経過時間 | ステータス | 絵文字 |
|---|---|---|
| 0〜15秒 | 受付済み (received) | 📋 |
| 15〜40秒 | 調理中 (preparing) | 👨‍🍳 |
| 40〜60秒 | 受取可能 (ready) | 🔔 |
| 60秒以降 | 完了 (completed) | ✅ |

---

## 13. トラブルシューティング

### Flutter

**`flutter pub get` でエラーが出る**

```bash
# キャッシュをクリアして再取得
flutter pub cache clean
flutter pub get
```

**ビルドが失敗する (Xcode 関連)**

```bash
# iOS の依存解決をやり直す
cd ios
pod deintegrate
pod install
cd ..
flutter clean
flutter run
```

**ビルドが失敗する (Android 関連)**

```bash
# Gradle キャッシュのクリア
flutter clean
cd android
./gradlew clean
cd ..
flutter run
```

**`valueOrNull` コンパイルエラー**

Riverpod 3.x では `valueOrNull` が削除されました。`state.value` に変更してください:

```dart
// ❌ 旧 (Riverpod 2.x)
final current = state.valueOrNull ?? const MyState();

// ✅ 新 (Riverpod 3.x)
final current = state.value ?? const MyState();
```

### バックエンド

**Docker コンテナが起動しない (MySQL)**

```bash
# ログを確認
docker compose logs mysql

# データボリュームを削除して再起動
docker compose down -v
docker compose up -d --build
```

**user-api が `ECONNREFUSED` で DB に接続できない**

MySQL の `healthcheck` が `healthy` になるまで待機します (最大 100 秒)。
`docker compose ps` で `mysql` が `healthy` になっているか確認してください。

**Admin API の `go mod tidy` でエラー**

```bash
cd junc_hamburger_club_backend/admin-api
go mod tidy
docker compose build admin-api
```

### Next.js

**`Module not found` エラー**

```bash
cd junc_hamburger_club_webfront
rm -rf .next node_modules
npm install
npm run dev
```

**API に接続できない (CORS エラー)**

`.env.local` の API URL が正しく設定されているか確認してください。  
バックエンドが起動していない場合は先に `docker compose up -d` を実行してください。

### iOS シミュレーター

**シミュレーターが起動しない**

```bash
# シミュレーターを手動で起動
open -a Simulator

# または xcrun で起動
xcrun simctl boot "iPhone 16 Pro"
```

**「Trust this computer」ダイアログが出ない**

```bash
# ペアリングをリセット
idevicepair unpair
idevicepair pair
```

### Android エミュレーター

**エミュレーターが起動しない (HAXM エラー)**

```bash
# Intel HAXM を再インストール (Intel Mac の場合)
# Android Studio > SDK Manager > SDK Tools > Intel HAXM をインストール

# Apple Silicon の場合は ARM64 イメージを使用
# AVD Manager で "arm64-v8a" のシステムイメージを選択
```

**アプリが API に接続できない**

Android エミュレーターから localhost にアクセスするには `10.0.2.2` を使用:

```bash
# 一時的な確認
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8080 tcp:8080

# これで localhost が使えるようになる
flutter run -d emulator-5554
```

---

## ライセンス

本プロジェクトはサンプル学習用途のため MIT ライセンスで公開しています。
