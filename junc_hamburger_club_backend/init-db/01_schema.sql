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
-- Cart Items
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id         INT       NOT NULL AUTO_INCREMENT,
  user_id    INT       NOT NULL,
  burger_id  INT       NOT NULL,
  quantity   INT       NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_user_burger (user_id, burger_id),
  KEY idx_cart_user (user_id),
  CONSTRAINT fk_cart_user   FOREIGN KEY (user_id)   REFERENCES users (id)   ON DELETE CASCADE,
  CONSTRAINT fk_cart_burger FOREIGN KEY (burger_id) REFERENCES burgers (id)
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
