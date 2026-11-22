-- Refresh Token セッション (既存環境向け冪等マイグレーション)
-- user-api/src/lib/refresh_rotation.ts と対になる
--
-- 実行:
--   docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
--     < junc_hamburger_club_backend/init-db/08_refresh_sessions.sql

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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
