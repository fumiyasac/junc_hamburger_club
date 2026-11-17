-- 既存環境向け: トッピング・オプション機能の冪等マイグレーション
--
-- 内容:
--   1. option_groups / options / burger_option_groups / cart_item_options / order_item_options
--      を CREATE TABLE IF NOT EXISTS で追加
--   2. cart_items に option_hash 列を追加し UNIQUE KEY を差し替え
--   3. 初期データ (4 グループ + 13 オプション + 全バーガー割当) を INSERT ... ON DUPLICATE KEY UPDATE で投入
--
-- IMPORTANT: 本ファイルは 01_schema.sql + 02_seed_data.sql と完全に同じ内容を保つこと。
--
-- 運用方針 (junc_hamburger_club_backend/CLAUDE.md より):
--   原則としては `docker compose down -v` でボリュームを削除して 01/02 を再適用するのが推奨。
--   ただし、開発中のデータを保持したまま追加マイグレーションを適用したい場合のみ、
--   本スクリプト (冪等) を既存コンテナに流して良い。本番運用では使用禁止。
--
-- 実行 (既存データを保持する場合のみ):
--   docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < junc_hamburger_club_backend/init-db/05_options_migration.sql

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE junc_hamburger;

-- ─── 1. Tables ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS option_groups (
  id            INT          NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  is_required   BOOLEAN      NOT NULL DEFAULT FALSE,
  min_select    INT          NOT NULL DEFAULT 0,
  max_select    INT          NOT NULL DEFAULT 1,
  display_order INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_option_group_min_max CHECK (min_select >= 0 AND max_select >= 0 AND min_select <= max_select)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS options (
  id            INT           NOT NULL AUTO_INCREMENT,
  group_id      INT           NOT NULL,
  name          VARCHAR(100)  NOT NULL,
  price_delta   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_available  BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_options_group (group_id),
  CONSTRAINT fk_options_group FOREIGN KEY (group_id) REFERENCES option_groups (id) ON DELETE CASCADE,
  CONSTRAINT chk_options_price_nonneg CHECK (price_delta >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS burger_option_groups (
  burger_id     INT NOT NULL,
  group_id      INT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (burger_id, group_id),
  KEY idx_bog_group (group_id),
  CONSTRAINT fk_bog_burger FOREIGN KEY (burger_id) REFERENCES burgers (id) ON DELETE CASCADE,
  CONSTRAINT fk_bog_group  FOREIGN KEY (group_id)  REFERENCES option_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 2. cart_items 変更 (冪等) ─────────────────────────────────────
-- option_hash 列が無ければ追加
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cart_items' AND COLUMN_NAME = 'option_hash'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE cart_items ADD COLUMN option_hash VARCHAR(64) NOT NULL DEFAULT '' AFTER burger_id",
  'SELECT "cart_items.option_hash already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 旧 UNIQUE KEY (user_id, burger_id) を外す
SET @old_uq := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cart_items' AND INDEX_NAME = 'uq_cart_user_burger'
);
SET @sql := IF(@old_uq > 0,
  'ALTER TABLE cart_items DROP INDEX uq_cart_user_burger',
  'SELECT "uq_cart_user_burger already removed"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 新 UNIQUE KEY (user_id, burger_id, option_hash) を追加
SET @new_uq := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cart_items' AND INDEX_NAME = 'uq_cart_user_burger_opts'
);
SET @sql := IF(@new_uq = 0,
  'ALTER TABLE cart_items ADD UNIQUE KEY uq_cart_user_burger_opts (user_id, burger_id, option_hash)',
  'SELECT "uq_cart_user_burger_opts already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS cart_item_options (
  id            INT NOT NULL AUTO_INCREMENT,
  cart_item_id  INT NOT NULL,
  option_id     INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cio (cart_item_id, option_id),
  KEY idx_cio_option (option_id),
  CONSTRAINT fk_cio_cart   FOREIGN KEY (cart_item_id) REFERENCES cart_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_cio_option FOREIGN KEY (option_id)    REFERENCES options (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_item_options (
  id            INT           NOT NULL AUTO_INCREMENT,
  order_item_id INT           NOT NULL,
  option_id     INT           NULL,
  group_name    VARCHAR(100)  NOT NULL,
  option_name   VARCHAR(100)  NOT NULL,
  price_delta   DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_oio_item (order_item_id),
  CONSTRAINT fk_oio_item   FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_oio_option FOREIGN KEY (option_id)    REFERENCES options (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3. Seed (idempotent) ──────────────────────────────────────────
INSERT INTO option_groups (id, name, is_required, min_select, max_select, display_order) VALUES
  (1, 'パティ',         TRUE,  1, 1, 10),
  (2, '追加トッピング', FALSE, 0, 3, 20),
  (3, '抜き',           FALSE, 0, 10, 30),
  (4, 'バンズ変更',     FALSE, 0, 1, 40)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), is_required = VALUES(is_required),
  min_select = VALUES(min_select), max_select = VALUES(max_select),
  display_order = VALUES(display_order);

INSERT INTO options (id, group_id, name, price_delta, is_available, display_order) VALUES
  (1,  1, 'シングル',       0.00,  TRUE,  10),
  (2,  1, 'ダブル',         600.00, TRUE,  20),
  (3,  2, 'チェダーチーズ', 150.00, TRUE,  10),
  (4,  2, 'ベーコン',       200.00, TRUE,  20),
  (5,  2, 'アボカド',       250.00, FALSE, 30),
  (6,  2, '目玉焼き',       150.00, TRUE,  40),
  (7,  2, 'ハラペーニョ',   100.00, TRUE,  50),
  (8,  3, 'オニオン抜き',    0.00,  TRUE,  10),
  (9,  3, 'ピクルス抜き',    0.00,  TRUE,  20),
  (10, 3, 'トマト抜き',      0.00,  TRUE,  30),
  (11, 3, 'ソース少なめ',    0.00,  TRUE,  40),
  (12, 4, 'ブリオッシュ',    0.00,  TRUE,  10),
  (13, 4, '全粒粉',          100.00, TRUE,  20)
ON DUPLICATE KEY UPDATE
  group_id = VALUES(group_id), name = VALUES(name),
  price_delta = VALUES(price_delta), is_available = VALUES(is_available),
  display_order = VALUES(display_order);

-- ビーフ系 13 件にパティグループを紐付け
INSERT INTO burger_option_groups (burger_id, group_id, display_order) VALUES
  (1, 1, 10), (2, 1, 10), (3, 1, 10), (4, 1, 10), (5, 1, 10), (6, 1, 10),
  (8, 1, 10), (9, 1, 10), (10, 1, 10), (12, 1, 10),
  (17, 1, 10), (19, 1, 10), (20, 1, 10)
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);

-- 全バーガーに トッピング / 抜き / バンズ変更 を紐付け
INSERT INTO burger_option_groups (burger_id, group_id, display_order)
SELECT b.id, g.id, g.display_order
FROM burgers b CROSS JOIN option_groups g
WHERE g.id IN (2, 3, 4)
ON DUPLICATE KEY UPDATE display_order = VALUES(display_order);
