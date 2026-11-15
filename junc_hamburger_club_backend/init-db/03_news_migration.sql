-- 既存の MySQL ボリュームを保持したまま "お知らせ (news)" 機能を追加するための
-- 冪等マイグレーション。
--
-- 用途:
--   - 既に `docker compose up` で立ち上げ済みの開発環境に news テーブルと
--     初期 8 件のデータだけを後付けしたい場合に使う。
--   - `docker compose down -v` でボリュームを作り直す運用なら不要
--     (01_schema.sql + 02_seed_data.sql が新規コンテナ起動時に自動適用される)。
--
-- 実行:
--   docker exec -i junc_mysql mysql -u root -prootpassword junc_hamburger \
--     < junc_hamburger_club_backend/init-db/03_news_migration.sql
--
-- 文字化け防止: 接続直後に charset を明示する。

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE junc_hamburger;

-- IMPORTANT: 本ファイルの DDL と INSERT は
--   init-db/01_schema.sql (news テーブル定義)
--   init-db/02_seed_data.sql (news seed 8 件)
-- と完全に一致している必要がある。
-- どちらか一方を変更した場合、必ずもう片方も同じ内容に揃えること。
-- 不一致があると「新規 docker compose down -v で立てた環境」と
-- 「既存ボリュームに migration を後付けした環境」で挙動が食い違う。

-- ─── Table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news (
  id            INT          NOT NULL AUTO_INCREMENT,
  title         VARCHAR(200) NOT NULL,
  category      VARCHAR(20)  NOT NULL,
  body          TEXT         NOT NULL,
  published_at  TIMESTAMP    NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_news_published (published_at),
  KEY idx_news_category (category),
  CONSTRAINT chk_news_category CHECK (category IN ('store','menu','campaign','app'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Seed データ ────────────────────────────────────────────────────────
-- 冪等性のため INSERT ... ON DUPLICATE KEY UPDATE を使用。
-- 同一 id への再実行時は title / body を最新に更新する。
INSERT INTO news (id, title, category, body, published_at) VALUES
(1, '年末年始の営業時間について', 'store',
'いつも JUNC Hamburger Club をご愛顧いただきありがとうございます。\n\n年末年始の営業時間を下記のとおりご案内いたします。\n12月30日まで: 通常営業 (11:00 - 22:00)\n12月31日: 11:00 - 17:00\n1月1日: 休業\n1月2日 - 1月3日: 12:00 - 20:00\n1月4日以降: 通常営業\n\nご来店をお待ちしております。', '2026-11-01 10:00:00'),
(2, '厨房機器メンテナンスに伴う一部メニュー提供休止のお知らせ', 'store',
'店舗の厨房機器定期メンテナンスのため、下記の時間帯は一部メニューの提供を休止いたします。\n実施日時: 2026年9月20日 (金) 14:00 - 16:00\n\nご来店のお客様にはご不便をおかけしますが、何卒ご理解のほどよろしくお願いいたします。', '2026-09-15 09:00:00'),
(3, '秋の味覚フェア開催「きのこ山菜バーガー」「マッシュルームスイスバーガー」', 'menu',
'実りの秋にぴったりなバーガー 2 品を特集フェアとしてご紹介いたします。\n\n■ きのこ山菜バーガー\n季節のきのことシャキシャキ山菜を和風仕立てに。鰹節の香りが広がる一品です。\n\n■ マッシュルームスイスバーガー\nじっくりソテーしたマッシュルームにスイスチーズのコクをあわせ、深みのある味わいに仕立てました。\n\n期間中はこれらのバーガーに合わせたおすすめサイドもご用意しています。', '2026-11-10 12:00:00'),
(4, 'プレミアムカテゴリーの定番「JUNC署名バーガー」をあらためてご紹介', 'menu',
'料理長が厳選した素材のみを使用した、当店最高峰の一品「JUNC署名バーガー」をあらためてご紹介いたします。\n\n熟成を重ねたビーフパティに、特製のソースと季節の付け合わせを添えました。ひと噛みごとに素材の重なりをお楽しみいただけます。\n\n特別な日のご褒美に、ぜひお試しください。', '2026-10-20 11:00:00'),
(5, '新規会員登録で初回限定 500 円 OFF キャンペーン', 'campaign',
'JUNC Hamburger Club のアプリから新規会員登録いただいた方全員に、初回ご注文時に使える 500 円 OFF クーポンをプレゼントいたします。\n\nキャンペーン期間: 2026年10月5日 〜 2026年11月30日\n\n会員登録はアプリから数ステップで完了します。この機会にぜひご利用ください。', '2026-10-05 10:00:00'),
(6, 'ダブルポイント DAY 開催のお知らせ', 'campaign',
'アプリ会員の皆さまへ、ご注文で貯まるポイントが 2 倍になる「ダブルポイント DAY」を開催いたします。\n\n開催日: 2026年11月23日 (月・祝) 終日\n対象: アプリから注文された会員のお客様すべて', '2026-11-20 10:00:00'),
(7, 'モバイルアプリ v1.2 リリース — カートの操作性を改善しました', 'app',
'モバイルアプリ v1.2 をリリースしました。\n\n主な改善点:\n- カート画面の数量変更ボタンを大きくし、片手での操作性を向上\n- 注文ステータスのリアルタイム更新間隔を調整し、バッテリー消費を軽減\n- オンボーディング画面のアニメーションを刷新\n\nアプリストアから最新版へのアップデートをお願いいたします。', '2026-09-28 15:00:00'),
(8, '【予約公開】定期メンテナンス実施のお知らせ', 'app',
'サービス品質向上のため、下記のとおりアプリの定期メンテナンスを実施いたします。\n\n実施日時: 2026年12月15日 (火) 02:00 - 04:00\n影響範囲: アプリからの注文・会員機能の全停止\n\nメンテナンス時間中はご不便をおかけしますが、何卒ご理解のほどよろしくお願いいたします。', '2026-12-15 02:00:00')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category = VALUES(category),
  body = VALUES(body),
  published_at = VALUES(published_at);
