package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
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
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
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

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"users": users, "pagination": gin.H{"total": total, "page": page, "limit": limit}},
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
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": u})
}

func (h *UserHandler) ToggleUserActive(c *gin.Context) {
	id := c.Param("id")
	result, err := h.DB.Exec(
		"UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "user status toggled"})
}
