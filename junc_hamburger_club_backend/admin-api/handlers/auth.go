package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Validate against env-configured admin credentials
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPasswordHash := os.Getenv("ADMIN_PASSWORD_HASH")

	if req.Email != adminEmail {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(adminPasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid credentials"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"token": tokenStr, "email": req.Email},
	})
}
