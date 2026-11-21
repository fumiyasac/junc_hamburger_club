package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	apierr "github.com/junc/admin-api/errors"
	"github.com/junc/admin-api/middleware"
	"github.com/junc/admin-api/models"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB        *sql.DB
	JWTSecret string
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}

	// Validate against env-configured admin credentials
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPasswordHash := os.Getenv("ADMIN_PASSWORD_HASH")

	if req.Email != adminEmail {
		apierr.AdminLoginFailed(c)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(adminPasswordHash), []byte(req.Password)); err != nil {
		apierr.AdminLoginFailed(c)
		return
	}

	claims := middleware.AdminClaims{
		AdminID: 1,
		Email:   req.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		apierr.Internal(c, "トークンの生成に失敗しました")
		return
	}

	// user-api 側 AuthResponse と構造を揃える: data.user に管理者情報を入れる
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"token": tokenStr,
			"user": gin.H{
				"id":    "1",
				"email": req.Email,
			},
		},
	})
}
