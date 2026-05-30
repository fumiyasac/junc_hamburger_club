package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/models"
)

type OrderHandler struct {
	DB *sql.DB
}

func (h *OrderHandler) ListOrders(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	where := ""
	args := []interface{}{}
	if status != "" {
		where = "WHERE o.status = ?"
		args = append(args, status)
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM orders o " + where
	_ = h.DB.QueryRow(countQuery, args...).Scan(&total)

	args = append(args, limit, offset)
	rows, err := h.DB.Query(`
		SELECT o.id, o.user_id, u.name, u.email, o.order_number, o.status,
		       o.total_amount, o.tax_amount, o.notes, o.estimated_ready_at, o.created_at, o.updated_at
		FROM orders o
		JOIN users u ON o.user_id = u.id
		`+where+`
		ORDER BY o.created_at DESC
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
			&o.Status, &o.TotalAmount, &o.TaxAmount, &o.Notes, &o.EstimatedReadyAt,
			&o.CreatedAt, &o.UpdatedAt); err != nil {
			continue
		}
		orders = append(orders, o)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"orders":     orders,
			"pagination": gin.H{"total": total, "page": page, "limit": limit},
		},
	})
}

func (h *OrderHandler) GetOrder(c *gin.Context) {
	id := c.Param("id")
	var o models.Order

	err := h.DB.QueryRow(`
		SELECT o.id, o.user_id, u.name, u.email, o.order_number, o.status,
		       o.total_amount, o.tax_amount, o.notes, o.estimated_ready_at, o.created_at, o.updated_at
		FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`, id).
		Scan(&o.ID, &o.UserID, &o.UserName, &o.UserEmail, &o.OrderNumber,
			&o.Status, &o.TotalAmount, &o.TaxAmount, &o.Notes, &o.EstimatedReadyAt,
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

	result, err := h.DB.Exec(
		"UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		req.Status, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "order not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "order status updated"})
}
