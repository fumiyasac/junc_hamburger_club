-- アプリ設定 (バージョン・メンテナンス) 既存環境向け冪等マイグレーション
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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

INSERT INTO app_config (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id;
