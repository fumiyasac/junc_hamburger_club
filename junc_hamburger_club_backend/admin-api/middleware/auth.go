package middleware

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	apierr "github.com/junc/admin-api/errors"
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
			apierr.AuthTokenMissing(c)
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &AdminClaims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(_ *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			if errors.Is(err, jwt.ErrTokenExpired) {
				apierr.AuthTokenExpired(c)
			} else {
				apierr.AuthTokenInvalid(c)
			}
			c.Abort()
			return
		}

		c.Set("adminId", claims.AdminID)
		c.Set("email", claims.Email)
		c.Next()
	}
}
