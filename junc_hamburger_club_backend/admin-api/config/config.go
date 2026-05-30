package config

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

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
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBName:     getEnv("DB_NAME", "junc_hamburger"),
		DBUser:     getEnv("DB_USER", "junc_user"),
		DBPassword: getEnv("DB_PASSWORD", "junc_password"),
		JWTSecret:  getEnv("JWT_SECRET", "secret"),
		GinMode:    getEnv("GIN_MODE", "debug"),
	}
}

func NewDB(cfg *Config) (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=Asia%%2FTokyo&charset=utf8mb4",
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
