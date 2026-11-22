package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

const minJWTSecretLen = 32

type Config struct {
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	JWTSecret  string
	GinMode    string
}

func Load() *Config {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("[config] JWT_SECRET is required")
	}
	if len(secret) < minJWTSecretLen {
		log.Fatalf("[config] JWT_SECRET must be at least %d chars (got %d)", minJWTSecretLen, len(secret))
	}
	if secret == "secret" || secret == "change_me" {
		log.Fatal("[config] JWT_SECRET must not be a placeholder value")
	}
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBName:     getEnv("DB_NAME", "junc_hamburger"),
		DBUser:     getEnv("DB_USER", "junc_user"),
		DBPassword: getEnv("DB_PASSWORD", "junc_password"),
		JWTSecret:  secret,
		GinMode:    getEnv("GIN_MODE", "debug"),
	}
}

func NewDB(cfg *Config) (*sql.DB, error) {
	// time_zone='+09:00' は MySQL セッションの TZ を JST に揃える (user-api の
	// mysql2 pool と対称)。loc=Asia/Tokyo は driver 内の time.Time 変換のみで、
	// これだけでは MySQL が TIMESTAMP を UTC 解釈し続けるため両方が必要。
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=Asia%%2FTokyo&charset=utf8mb4&time_zone=%%27%%2B09%%3A00%%27",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
