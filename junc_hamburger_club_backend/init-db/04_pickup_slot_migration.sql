-- 既存環境向け: 受け取り枠 (pickup slot) 機能の追加マイグレーション (冪等)
--
-- 内容:
--   1. pickup_settings テーブル追加 (デフォルト 1 行)
--   2. pickup_slot_counters テーブル追加
--   3. orders テーブルに pickup_at 列と idx_orders_pickup を追加 (既存なら skip)
--
-- IMPORTANT: 本ファイルの DDL と INSERT は
--   init-db/01_schema.sql と init-db/02_seed_data.sql
-- と完全に一致している必要がある。両方を揃えて更新すること。
--
-- 実行:
--   docker exec -i junc_mysql mysql -u root -prootpassword junc_hamburger \
--     < junc_hamburger_club_backend/init-db/04_pickup_slot_migration.sql

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE junc_hamburger;

-- ─── 1. pickup_settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pickup_settings (
  id                   INT          NOT NULL AUTO_INCREMENT,
  store_id             INT          NOT NULL DEFAULT 1,
  slot_interval_min    INT          NOT NULL DEFAULT 15,
  slot_capacity        INT          NOT NULL DEFAULT 4,
  lead_time_min        INT          NOT NULL DEFAULT 20,
  lookahead_days       INT          NOT NULL DEFAULT 3,
  open_time            TIME         NOT NULL DEFAULT '11:00:00',
  close_time           TIME         NOT NULL DEFAULT '21:00:00',
  closed_weekdays      VARCHAR(20)  NOT NULL DEFAULT '',
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pickup_settings_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pickup_settings
  (id, store_id, slot_interval_min, slot_capacity, lead_time_min, lookahead_days, open_time, close_time, closed_weekdays)
VALUES
  (1, 1, 15, 4, 20, 3, '11:00:00', '21:00:00', '')
ON DUPLICATE KEY UPDATE store_id = VALUES(store_id);

-- ─── 2. pickup_slot_counters ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pickup_slot_counters (
  id              INT         NOT NULL AUTO_INCREMENT,
  store_id        INT         NOT NULL DEFAULT 1,
  slot_at         TIMESTAMP   NOT NULL,
  reserved_count  INT         NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pickup_slot (store_id, slot_at),
  KEY idx_pickup_slot_at (slot_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 3. orders.pickup_at と idx_orders_pickup を追加 (冪等) ─────────────
-- INFORMATION_SCHEMA で存在チェックし、動的 SQL で ALTER
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'pickup_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN pickup_at TIMESTAMP NULL AFTER estimated_ready_at',
  'SELECT "orders.pickup_at already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND INDEX_NAME = 'idx_orders_pickup'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE orders ADD KEY idx_orders_pickup (pickup_at)',
  'SELECT "idx_orders_pickup already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
