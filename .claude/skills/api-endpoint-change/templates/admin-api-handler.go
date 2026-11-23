// junc_hamburger_club_backend/admin-api/handlers/<topic>.go
//
// テンプレート: burger.go のパターンに合わせた Handler struct + List/Get/Create。
// #65 以降は統一エラー形式のため apierr パッケージを使う (c.JSON の旧形式は廃止)。

package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	apierr "github.com/junc/admin-api/errors"
	"github.com/junc/admin-api/models"
)

type ReviewHandler struct {
	DB *sql.DB
}

// JSON 契約の統一: ID は string, DECIMAL は float64 で返す
// (models.go 側で `json:"id,string"` タグ必須)

type CreateReviewRequest struct {
	BurgerID int    `json:"burgerId,string" binding:"required"`
	UserID   int    `json:"userId,string" binding:"required"`
	Rating   int    `json:"rating" binding:"required,gte=1,lte=5"`
	Comment  string `json:"comment"`
}

func (h *ReviewHandler) ListReviews(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int
	_ = h.DB.QueryRow("SELECT COUNT(*) FROM reviews").Scan(&total)

	rows, err := h.DB.Query(`
		SELECT id, user_id, burger_id, rating, comment, created_at
		FROM reviews ORDER BY created_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		apierr.Internal(c, err.Error())
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
			"reviews":    reviews,
			"pagination": gin.H{"total": total, "page": page, "limit": limit, "pages": pages},
		},
	})
}

func (h *ReviewHandler) GetReview(c *gin.Context) {
	id := c.Param("id")
	var r models.Review

	err := h.DB.QueryRow(`
		SELECT id, user_id, burger_id, rating, comment, created_at FROM reviews WHERE id = ?`, id).
		Scan(&r.ID, &r.UserID, &r.BurgerID, &r.Rating, &r.Comment, &r.CreatedAt)
	if err == sql.ErrNoRows {
		apierr.ResourceNotFound(c, "review", id)
		return
	}
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": r})
}

func (h *ReviewHandler) CreateReview(c *gin.Context) {
	var req CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Gin binding の失敗は VALIDATION_FAILED として返す
		apierr.Validation(c, err.Error(), nil)
		return
	}

	result, err := h.DB.Exec(
		`INSERT INTO reviews (user_id, burger_id, rating, comment) VALUES (?, ?, ?, ?)`,
		req.UserID, req.BurgerID, req.Rating, req.Comment,
	)
	if err != nil {
		// FK 制約違反 (burger_id が存在しない等) → 400
		if strings.Contains(err.Error(), "1452") { // ER_NO_REFERENCED_ROW_2
			apierr.RespondCode(c, "VALIDATION_FAILED", "参照先が存在しません",
				http.StatusBadRequest, map[string]any{"burgerId": req.BurgerID})
			return
		}
		apierr.Internal(c, err.Error())
		return
	}
	id, _ := result.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": strconv.FormatInt(id, 10)}})
}

// 新規エラーコードを追加する場合は errors/errors.go にプリセット関数を追加:
//
//   func ReviewNotFound(c *gin.Context, id string) {
//     RespondCode(c, "REVIEW_NOT_FOUND", "レビューが見つかりません",
//       http.StatusNotFound, map[string]any{"reviewId": id})
//   }
//
// と同時に docs/error_codes.md と openapi.yaml を更新する。
