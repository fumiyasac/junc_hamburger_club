package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/models"
)

type OrderHandler struct {
	DB *sql.DB
}

func (h *OrderHandler) ListOrders(c *gin.Context) {
	status := c.Query("status")
	pickupDate := c.Query("pickupDate") // YYYY-MM-DD, JST
	sortKey := c.DefaultQuery("sort", "created_at")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	// 動的 WHERE
	wheres := []string{}
	args := []interface{}{}
	if status != "" {
		wheres = append(wheres, "o.status = ?")
		args = append(args, status)
	}
	if pickupDate != "" {
		wheres = append(wheres, "o.pickup_at >= ? AND o.pickup_at < DATE_ADD(?, INTERVAL 1 DAY)")
		args = append(args, pickupDate+" 00:00:00", pickupDate+" 00:00:00")
	}
	where := ""
	if len(wheres) > 0 {
		where = "WHERE " + strings.Join(wheres, " AND ")
	}

	// ソートキーの allowlist
	orderBy := "o.created_at DESC"
	if sortKey == "pickup_at" {
		orderBy = "o.pickup_at ASC, o.created_at DESC"
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM orders o " + where
	_ = h.DB.QueryRow(countQuery, args...).Scan(&total)

	args = append(args, limit, offset)
	rows, err := h.DB.Query(`
		SELECT o.id, o.user_id, u.name, u.email, o.order_number, o.status,
		       o.total_amount, o.tax_amount, o.notes, o.estimated_ready_at, o.pickup_at,
		       o.created_at, o.updated_at
		FROM orders o
		JOIN users u ON o.user_id = u.id
		`+where+`
		ORDER BY `+orderBy+`
		LIMIT ? OFFSET ?`, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	orders := []models.Order{}
	for rows.Next() {
		var o models.Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.UserName, &o.UserEmail, &o.OrderNumber,
			&o.Status, &o.TotalAmount, &o.TaxAmount, &o.Notes, &o.EstimatedReadyAt, &o.PickupAt,
			&o.CreatedAt, &o.UpdatedAt); err != nil {
			continue
		}
		orders = append(orders, o)
	}

	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"orders":     orders,
			"pagination": gin.H{"total": total, "page": page, "limit": limit, "pages": pages},
		},
	})
}

func (h *OrderHandler) GetOrder(c *gin.Context) {
	id := c.Param("id")
	var o models.Order

	err := h.DB.QueryRow(`
		SELECT o.id, o.user_id, u.name, u.email, o.order_number, o.status,
		       o.total_amount, o.tax_amount, o.notes, o.estimated_ready_at, o.pickup_at,
		       o.created_at, o.updated_at
		FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`, id).
		Scan(&o.ID, &o.UserID, &o.UserName, &o.UserEmail, &o.OrderNumber,
			&o.Status, &o.TotalAmount, &o.TaxAmount, &o.Notes, &o.EstimatedReadyAt, &o.PickupAt,
			&o.CreatedAt, &o.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "order not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	itemRows, _ := h.DB.Query(`
		SELECT oi.id, oi.burger_id, b.name, b.image_url, oi.quantity, oi.unit_price, oi.subtotal
		FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`, id)
	if itemRows != nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var item models.OrderItem
			_ = itemRows.Scan(&item.ID, &item.BurgerID, &item.BurgerName, &item.BurgerImageURL,
				&item.Quantity, &item.UnitPrice, &item.Subtotal)
			o.Items = append(o.Items, item)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": o})
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	validStatuses := map[string]bool{"received": true, "preparing": true, "ready": true, "completed": true, "cancelled": true}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid status"})
		return
	}

	// pickup_slot_counters との整合性のため tx 内で処理し、
	// "非 cancelled → cancelled" 遷移のときのみ counter を減算する
	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer func() { _ = tx.Rollback() }()

	var currentStatus string
	var pickupAt sql.NullTime
	err = tx.QueryRow("SELECT status, pickup_at FROM orders WHERE id = ? FOR UPDATE", id).Scan(&currentStatus, &pickupAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "order not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	if _, err := tx.Exec(
		"UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		req.Status, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.Status == "cancelled" && currentStatus != "cancelled" && pickupAt.Valid {
		if _, err := tx.Exec(
			"UPDATE pickup_slot_counters SET reserved_count = GREATEST(reserved_count - 1, 0) WHERE store_id = 1 AND slot_at = ?",
			pickupAt.Time); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "order status updated"})
}
