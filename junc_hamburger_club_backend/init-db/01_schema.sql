-- JUNC Hamburger Club Database Schema
-- MySQL 8.0

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS junc_hamburger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE junc_hamburger;

-- ────────────────────────────────────────
-- Users
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT          NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_image_url VARCHAR(500),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Burger Categories
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS burger_categories (
  id            INT         NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  emoji         VARCHAR(10)  NOT NULL,
  description   TEXT,
  display_order INT          NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Burgers
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS burgers (
  id           INT           NOT NULL AUTO_INCREMENT,
  category_id  INT           NOT NULL,
  name         VARCHAR(200)  NOT NULL,
  description  TEXT          NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  image_url    VARCHAR(500),
  rating       DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  review_count INT           NOT NULL DEFAULT 0,
  is_popular   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_available BOOLEAN       NOT NULL DEFAULT TRUE,
  calories     INT,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_burgers_category (category_id),
  KEY idx_burgers_popular (is_popular),
  CONSTRAINT fk_burgers_category FOREIGN KEY (category_id)
    REFERENCES burger_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Burger Ingredients
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS burger_ingredients (
  id            INT          NOT NULL AUTO_INCREMENT,
  burger_id     INT          NOT NULL,
  ingredient    VARCHAR(200) NOT NULL,
  display_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ingredients_burger (burger_id),
  CONSTRAINT fk_ingredients_burger FOREIGN KEY (burger_id)
    REFERENCES burgers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Burger Tags
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS burger_tags (
  id        INT         NOT NULL AUTO_INCREMENT,
  burger_id INT         NOT NULL,
  tag       VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tags_burger (burger_id),
  CONSTRAINT fk_tags_burger FOREIGN KEY (burger_id)
    REFERENCES burgers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Option Groups / Options (トッピング・オプション、詳細は docs/options_rules.md)
-- ────────────────────────────────────────
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

-- どのバーガーにどのオプショングループを適用するかの M:N
CREATE TABLE IF NOT EXISTS burger_option_groups (
  burger_id     INT NOT NULL,
  group_id      INT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (burger_id, group_id),
  KEY idx_bog_group (group_id),
  CONSTRAINT fk_bog_burger FOREIGN KEY (burger_id) REFERENCES burgers (id) ON DELETE CASCADE,
  CONSTRAINT fk_bog_group  FOREIGN KEY (group_id)  REFERENCES option_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Cart Items
-- option_hash: 選択オプションの決定論的ハッシュ (SHA-256 of sorted option_id CSV)。
-- 同一 (user, burger, option_hash) を UNIQUE に。オプションなしは空文字。
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id          INT         NOT NULL AUTO_INCREMENT,
  user_id     INT         NOT NULL,
  burger_id   INT         NOT NULL,
  option_hash VARCHAR(64) NOT NULL DEFAULT '',
  quantity    INT         NOT NULL DEFAULT 1,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_user_burger_opts (user_id, burger_id, option_hash),
  KEY idx_cart_user (user_id),
  CONSTRAINT fk_cart_user   FOREIGN KEY (user_id)   REFERENCES users (id)   ON DELETE CASCADE,
  CONSTRAINT fk_cart_burger FOREIGN KEY (burger_id) REFERENCES burgers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- カート行ごとの選択オプション (表示・クエリ用)
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

-- ────────────────────────────────────────
-- Orders
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  INT           NOT NULL AUTO_INCREMENT,
  user_id             INT           NOT NULL,
  order_number        VARCHAR(50)   NOT NULL,
  status              ENUM('received','preparing','ready','completed','cancelled')
                      NOT NULL DEFAULT 'received',
  total_amount        DECIMAL(10,2) NOT NULL,
  tax_amount          DECIMAL(10,2) NOT NULL,
  notes               TEXT,
  estimated_ready_at  TIMESTAMP     NULL,
  pickup_at           TIMESTAMP     NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_user   (user_id),
  KEY idx_orders_status (status),
  KEY idx_orders_pickup (pickup_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────
-- Order Items
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT           NOT NULL AUTO_INCREMENT,
  order_id    INT           NOT NULL,
  burger_id   INT           NOT NULL,
  quantity    INT           NOT NULL,
  unit_price  DECIMAL(10,2) NOT NULL,
  subtotal    DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order  (order_id),
  KEY idx_order_items_burger (burger_id),
  CONSTRAINT fk_order_items_order  FOREIGN KEY (order_id)  REFERENCES orders  (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_burger FOREIGN KEY (burger_id) REFERENCES burgers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 注文明細ごとの選択オプション (name / price は注文時点のスナップショット)。
-- option_id は NULL 許容: 元 option が削除されても過去注文の表示を維持するため。
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

-- ────────────────────────────────────────
-- Pickup Settings (受け取り枠の設定、1 店舗 1 行)
-- 将来の複数店舗化のため store_id を主キーの一部として予約。
-- ────────────────────────────────────────
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

-- ────────────────────────────────────────
-- Pickup Slot Counters (枠別の予約数カウンタ、同時実行制御用)
-- 1 枠 = (store_id, slot_at TIMESTAMP) で一意。
-- 注文作成時に SELECT ... FOR UPDATE で行ロックして capacity 超過を防ぐ。
-- キャンセル時は reserved_count を減算する。
-- ────────────────────────────────────────
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

-- ────────────────────────────────────────
-- News (お知らせ)
-- 将来の管理画面編集も考慮してカテゴリーは VARCHAR + CHECK 制約。
-- published_at は予約公開 (未来日時) を扱えるよう NOT NULL。
-- ────────────────────────────────────────
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

-- ─── 注文作成の冪等性サポート ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
  user_id INT NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status ENUM('PENDING','SUCCEEDED','FAILED') NOT NULL,
  order_id INT NULL,
  response_body JSON NULL,
  response_status SMALLINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, idempotency_key),
  KEY idx_created (created_at),
  CONSTRAINT fk_idem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_idem_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── アプリ設定 (バージョン・メンテナンス) ─────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  id TINYINT NOT NULL DEFAULT 1,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT NULL,
  ios_min_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  ios_latest_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  android_min_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  android_latest_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_app_config_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Refresh Token セッション ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_sessions (
  id              CHAR(36)     NOT NULL,
  user_id         INT          NOT NULL,
  family_id       CHAR(36)     NOT NULL,
  token_hash      CHAR(64)     NOT NULL,
  prev_token_hash CHAR(64)     NULL,
  prev_valid_until TIMESTAMP   NULL,
  user_agent      VARCHAR(255) NULL,
  ip              VARCHAR(45)  NULL,
  issued_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP    NOT NULL,
  revoked_at      TIMESTAMP    NULL,
  revoked_reason  ENUM('LOGOUT','ROTATED','REUSE_DETECTED','PASSWORD_CHANGED','ACCOUNT_DEACTIVATED','USER_DELETED','ADMIN_REVOKED') NULL,
  PRIMARY KEY (id),
  KEY idx_rs_user_active (user_id, revoked_at),
  KEY idx_rs_family (family_id),
  KEY idx_rs_token_hash (token_hash),
  KEY idx_rs_prev_token_hash (prev_token_hash),
  KEY idx_rs_expires (expires_at),
  CONSTRAINT fk_rs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
