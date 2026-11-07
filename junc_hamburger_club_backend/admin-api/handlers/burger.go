package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/models"
)

type BurgerHandler struct {
	DB *sql.DB
}

type CreateBurgerRequest struct {
	// categoryId は JSON 上では文字列として受け取る (契約統一のため)
	CategoryID  int      `json:"categoryId,string" binding:"required"`
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Price       float64  `json:"price" binding:"required,gt=0"`
	ImageURL    *string  `json:"imageUrl"`
	IsPopular   bool     `json:"isPopular"`
	Calories    *int     `json:"calories"`
	Ingredients []string `json:"ingredients"`
	Tags        []string `json:"tags"`
}

func (h *BurgerHandler) ListBurgers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var total int
	_ = h.DB.QueryRow("SELECT COUNT(*) FROM burgers").Scan(&total)

	rows, err := h.DB.Query(`
		SELECT b.id, b.category_id, b.name, b.description, b.price, b.image_url,
		       b.rating, b.review_count, b.is_popular, b.is_available, b.calories
		FROM burgers b
		ORDER BY b.id
		LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	burgers := []models.Burger{}
	for rows.Next() {
		var b models.Burger
		if err := rows.Scan(&b.ID, &b.CategoryID, &b.Name, &b.Description, &b.Price,
			&b.ImageURL, &b.Rating, &b.ReviewCount, &b.IsPopular, &b.IsAvailable, &b.Calories); err != nil {
			continue
		}
		b.Ingredients = h.getIngredients(b.ID)
		b.Tags = h.getTags(b.ID)
		burgers = append(burgers, b)
	}

	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"burgers": burgers, "pagination": gin.H{"total": total, "page": page, "limit": limit, "pages": pages}},
	})
}

func (h *BurgerHandler) GetBurger(c *gin.Context) {
	id := c.Param("id")
	var b models.Burger

	err := h.DB.QueryRow(`
		SELECT id, category_id, name, description, price, image_url,
		       rating, review_count, is_popular, is_available, calories
		FROM burgers WHERE id = ?`, id).
		Scan(&b.ID, &b.CategoryID, &b.Name, &b.Description, &b.Price,
			&b.ImageURL, &b.Rating, &b.ReviewCount, &b.IsPopular, &b.IsAvailable, &b.Calories)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "burger not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	b.Ingredients = h.getIngredients(b.ID)
	b.Tags = h.getTags(b.ID)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": b})
}

func (h *BurgerHandler) CreateBurger(c *gin.Context) {
	var req CreateBurgerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	result, err := h.DB.Exec(`
		INSERT INTO burgers (category_id, name, description, price, image_url, is_popular, calories)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		req.CategoryID, req.Name, req.Description, req.Price, req.ImageURL, req.IsPopular, req.Calories)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	for i, ing := range req.Ingredients {
		_, _ = h.DB.Exec("INSERT INTO burger_ingredients (burger_id, ingredient, display_order) VALUES (?, ?, ?)", id, ing, i+1)
	}
	for _, tag := range req.Tags {
		_, _ = h.DB.Exec("INSERT INTO burger_tags (burger_id, tag) VALUES (?, ?)", id, strings.TrimSpace(tag))
	}

	// id は契約上 string を返す
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": strconv.Itoa(id)}})
}

func (h *BurgerHandler) UpdateBurger(c *gin.Context) {
	id := c.Param("id")
	var req CreateBurgerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	_, err := h.DB.Exec(`
		UPDATE burgers SET category_id=?, name=?, description=?, price=?, image_url=?,
		is_popular=?, calories=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		req.CategoryID, req.Name, req.Description, req.Price, req.ImageURL,
		req.IsPopular, req.Calories, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	_, _ = h.DB.Exec("DELETE FROM burger_ingredients WHERE burger_id = ?", id)
	_, _ = h.DB.Exec("DELETE FROM burger_tags WHERE burger_id = ?", id)

	for i, ing := range req.Ingredients {
		_, _ = h.DB.Exec("INSERT INTO burger_ingredients (burger_id, ingredient, display_order) VALUES (?, ?, ?)", id, ing, i+1)
	}
	for _, tag := range req.Tags {
		_, _ = h.DB.Exec("INSERT INTO burger_tags (burger_id, tag) VALUES (?, ?)", id, strings.TrimSpace(tag))
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "burger updated"})
}

func (h *BurgerHandler) ToggleAvailability(c *gin.Context) {
	id := c.Param("id")
	_, err := h.DB.Exec(
		"UPDATE burgers SET is_available = NOT is_available, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "availability toggled"})
}

func (h *BurgerHandler) DeleteBurger(c *gin.Context) {
	id := c.Param("id")
	result, err := h.DB.Exec("DELETE FROM burgers WHERE id = ?", id)
	if err != nil {
		// MySQL FK 制約違反 (エラーコード 1451: a child row exists)
		if strings.Contains(err.Error(), "1451") {
			c.JSON(http.StatusConflict, gin.H{"success": false, "error": "burger is referenced by existing orders"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "burger not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "burger deleted"})
}

func (h *BurgerHandler) getIngredients(burgerID int) []string {
	rows, err := h.DB.Query("SELECT ingredient FROM burger_ingredients WHERE burger_id = ? ORDER BY display_order", burgerID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var s string
		if rows.Scan(&s) == nil {
			items = append(items, s)
		}
	}
	return items
}

func (h *BurgerHandler) getTags(burgerID int) []string {
	rows, err := h.DB.Query("SELECT tag FROM burger_tags WHERE burger_id = ?", burgerID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var items []string
	for rows.Next() {
		var s string
		if rows.Scan(&s) == nil {
			items = append(items, s)
		}
	}
	return items
}
