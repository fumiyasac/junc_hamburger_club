package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	apierr "github.com/junc/admin-api/errors"
	"github.com/junc/admin-api/models"
)

type UserHandler struct {
	DB *sql.DB
}

func (h *UserHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int
	_ = h.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&total)

	rows, err := h.DB.Query(`
		SELECT id, name, email, profile_image_url, is_active, created_at, updated_at
		FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.ProfileImageURL,
			&u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}

	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"users": users, "pagination": gin.H{"total": total, "page": page, "limit": limit, "pages": pages}},
	})
}

func (h *UserHandler) GetUser(c *gin.Context) {
	id := c.Param("id")
	var u models.User

	err := h.DB.QueryRow(`
		SELECT id, name, email, profile_image_url, is_active, created_at, updated_at
		FROM users WHERE id = ?`, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.ProfileImageURL, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		apierr.ResourceNotFound(c, "user", id)
		return
	}
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": u})
}

func (h *UserHandler) ToggleUserActive(c *gin.Context) {
	id := c.Param("id")

	// atomic に toggle + 新しい値を取得 (読み取り→書き込みの race を避ける)
	result, err := h.DB.Exec(
		"UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		apierr.ResourceNotFound(c, "user", id)
		return
	}
	var nextActive bool
	if err := h.DB.QueryRow("SELECT is_active FROM users WHERE id = ?", id).Scan(&nextActive); err != nil {
		apierr.Internal(c, err.Error())
		return
	}

	// 無効化した場合は、該当ユーザーの全 refresh_sessions を失効させる
	if !nextActive {
		if _, err := h.DB.Exec(
			`UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'ADMIN_REVOKED'
			 WHERE user_id = ? AND revoked_at IS NULL`, id); err != nil {
			log.Printf("[admin] refresh revoke failed user=%s err=%v", id, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "user status toggled"})
}
