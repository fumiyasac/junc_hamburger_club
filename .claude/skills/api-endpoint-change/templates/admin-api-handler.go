// junc_hamburger_club_backend/admin-api/handlers/<topic>.go
//
// テンプレート: burger.go のパターンに合わせた Handler struct + List/Get/Create。
// 重要:
// - int 型 ID は models で `json:"id,string"` タグ (contract 統一)
// - リクエスト DTO も categoryId など外部キー ID は `json:"xxxId,string"` で string を受ける
// - 手動 gin.H で ID を返すときは strconv.Itoa(id) で明示的に文字列化する
// - FK 制約 (エラーコード 1451) を検知したら 409 を返す

package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/models"
)

type ReviewHandler struct {
	DB *sql.DB
}

type CreateReviewRequest struct {
	UserID   int     `json:"userId,string" binding:"required"`
	BurgerID int     `json:"burgerId,string" binding:"required"`
	Rating   int     `json:"rating" binding:"required,min=1,max=5"`
	Comment  *string `json:"comment"`
}

func (h *ReviewHandler) ListReviews(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int
	_ = h.DB.QueryRow("SELECT COUNT(*) FROM reviews").Scan(&total)

	rows, err := h.DB.Query(`
		SELECT id, user_id, burger_id, rating, comment, created_at
		FROM reviews
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	reviews := []models.Review{}
	for rows.Next() {
		var r models.Review
		if err := rows.Scan(&r.ID, &r.UserID, &r.BurgerID, &r.Rating, &r.Comment, &r.CreatedAt); err != nil {
			continue
		}
		reviews = append(reviews, r)
	}

	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"reviews": reviews,
			"pagination": gin.H{
				"total": total, "page": page, "limit": limit, "pages": pages,
			},
		},
	})
}

func (h *ReviewHandler) GetReview(c *gin.Context) {
	id := c.Param("id")
	var r models.Review
	err := h.DB.QueryRow(`
		SELECT id, user_id, burger_id, rating, comment, created_at
		FROM reviews WHERE id = ?`, id).
		Scan(&r.ID, &r.UserID, &r.BurgerID, &r.Rating, &r.Comment, &r.CreatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "review not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": r})
}

func (h *ReviewHandler) CreateReview(c *gin.Context) {
	var req CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	result, err := h.DB.Exec(
		"INSERT INTO reviews (user_id, burger_id, rating, comment) VALUES (?, ?, ?, ?)",
		req.UserID, req.BurgerID, req.Rating, req.Comment,
	)
	if err != nil {
		// FK 制約違反 (子行なし) は 409
		if strings.Contains(err.Error(), "1452") {
			c.JSON(http.StatusConflict, gin.H{"success": false, "error": "referenced burger or user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)
	// 手動 gin.H で ID を返すときは string 化する
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": strconv.Itoa(id)}})
}

// NOTE: router/router.go の protected グループに登録:
//   reviewH := &handlers.ReviewHandler{DB: db}
//   protected.GET("/reviews", reviewH.ListReviews)
//   protected.GET("/reviews/:id", reviewH.GetReview)
//   protected.POST("/reviews", reviewH.CreateReview)
