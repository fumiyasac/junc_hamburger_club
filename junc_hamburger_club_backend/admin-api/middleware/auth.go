package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AdminClaims struct {
	AdminID int    `json:"adminId"`
	Email   string `json:"email"`
	jwt.RegisteredClaims
}

func AdminAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "error": "authorization token required"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &AdminClaims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(_ *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "error": "invalid or expired token"})
			return
		}

		c.Set("adminId", claims.AdminID)
		c.Set("email", claims.Email)
		c.Next()
	}
}
