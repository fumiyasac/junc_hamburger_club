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
		apierr.Internal(c, err.Error())
		return
	}
	defer rows.Close()

	orders := []models.Order{}
	orderIDs := []int{}
	for rows.Next() {
		var o models.Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.UserName, &o.UserEmail, &o.OrderNumber,
			&o.Status, &o.TotalAmount, &o.TaxAmount, &o.Notes, &o.EstimatedReadyAt, &o.PickupAt,
			&o.CreatedAt, &o.UpdatedAt); err != nil {
			continue
		}
		o.Items = []models.OrderItem{}
		orders = append(orders, o)
		orderIDs = append(orderIDs, o.ID)
	}

	// 各 order の items + options をロード (厨房がオプション確認するため)
	if len(orderIDs) > 0 {
		orders = attachOrderItemsAndOptions(h.DB, orders, orderIDs)
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
		apierr.OrderNotFound(c, id)
		return
	}
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}

	itemRows, _ := h.DB.Query(`
		SELECT oi.id, oi.burger_id, b.name, b.image_url, oi.quantity, oi.unit_price, oi.subtotal
		FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`, id)
	itemIDs := []int{}
	if itemRows != nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var item models.OrderItem
			_ = itemRows.Scan(&item.ID, &item.BurgerID, &item.BurgerName, &item.BurgerImageURL,
				&item.Quantity, &item.UnitPrice, &item.Subtotal)
			item.Options = []models.OrderItemOptionSnapshot{}
			o.Items = append(o.Items, item)
			itemIDs = append(itemIDs, item.ID)
		}
	}
	// options スナップショットを一括ロード
	if len(itemIDs) > 0 {
		o.Items = attachItemOptions(h.DB, o.Items)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": o})
}

// attachOrderItemsAndOptions は orders ごとに items と options を読み込む
func attachOrderItemsAndOptions(db *sql.DB, orders []models.Order, orderIDs []int) []models.Order {
	if len(orderIDs) == 0 {
		return orders
	}
	placeholders := ""
	args := make([]interface{}, len(orderIDs))
	for i, id := range orderIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}
	query := `SELECT oi.order_id, oi.id, oi.burger_id, b.name, b.image_url, oi.quantity, oi.unit_price, oi.subtotal
	          FROM order_items oi JOIN burgers b ON oi.burger_id = b.id
	          WHERE oi.order_id IN (` + placeholders + `) ORDER BY oi.id`
	rows, err := db.Query(query, args...)
	if err != nil {
		return orders
	}
	defer rows.Close()

	itemsByOrder := map[int][]models.OrderItem{}
	allItems := []models.OrderItem{}
	itemToOrder := map[int]int{} // itemID -> orderID
	for rows.Next() {
		var orderID int
		var item models.OrderItem
		if err := rows.Scan(&orderID, &item.ID, &item.BurgerID, &item.BurgerName, &item.BurgerImageURL,
			&item.Quantity, &item.UnitPrice, &item.Subtotal); err != nil {
			continue
		}
		item.Options = []models.OrderItemOptionSnapshot{}
		itemsByOrder[orderID] = append(itemsByOrder[orderID], item)
		allItems = append(allItems, item)
		itemToOrder[item.ID] = orderID
	}

	// options を付与
	allItems = attachItemOptions(db, allItems)
	// 結果を order ごとに分配しなおす
	optsByItem := map[int][]models.OrderItemOptionSnapshot{}
	for _, it := range allItems {
		optsByItem[it.ID] = it.Options
	}
	for oid, items := range itemsByOrder {
		for i := range items {
			items[i].Options = optsByItem[items[i].ID]
		}
		itemsByOrder[oid] = items
	}

	for i := range orders {
		if its, ok := itemsByOrder[orders[i].ID]; ok {
			orders[i].Items = its
		}
	}
	return orders
}

// attachItemOptions は order_item_options を取得して Items に付与する
func attachItemOptions(db *sql.DB, items []models.OrderItem) []models.OrderItem {
	if len(items) == 0 {
		return items
	}
	placeholders := ""
	args := make([]interface{}, len(items))
	for i, it := range items {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = it.ID
	}
	query := `SELECT order_item_id, id, option_id, group_name, option_name, price_delta
	          FROM order_item_options WHERE order_item_id IN (` + placeholders + `) ORDER BY id`
	rows, err := db.Query(query, args...)
	if err != nil {
		return items
	}
	defer rows.Close()

	byItem := map[int][]models.OrderItemOptionSnapshot{}
	for rows.Next() {
		var itemID int
		var snap models.OrderItemOptionSnapshot
		var optionID sql.NullInt64
		if err := rows.Scan(&itemID, &snap.ID, &optionID, &snap.GroupName, &snap.OptionName, &snap.PriceDelta); err != nil {
			continue
		}
		if optionID.Valid {
			v := int(optionID.Int64)
			snap.OptionID = &v
		}
		byItem[itemID] = append(byItem[itemID], snap)
	}
	for i := range items {
		if opts, ok := byItem[items[i].ID]; ok {
			items[i].Options = opts
		}
	}
	return items
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}

	if !models.IsValidOrderStatus(req.Status) {
		apierr.Validation(c, "ステータス値が不正です", map[string]any{"value": req.Status})
		return
	}

	// pickup_slot_counters との整合性のため tx 内で処理し、
	// "非 cancelled → cancelled" 遷移のときのみ counter を減算する
	tx, err := h.DB.Begin()
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	defer func() { _ = tx.Rollback() }()

	var currentStatus string
	var pickupAt sql.NullTime
	err = tx.QueryRow("SELECT status, pickup_at FROM orders WHERE id = ? FOR UPDATE", id).Scan(&currentStatus, &pickupAt)
	if err == sql.ErrNoRows {
		apierr.OrderNotFound(c, id)
		return
	}
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}

	// 遷移表に沿った可否判定
	if !models.CanTransition(models.OrderStatus(currentStatus), models.OrderStatus(req.Status)) {
		apierr.OrderInvalidStatusTransition(c, currentStatus, req.Status,
			models.AllowedNextStrings(currentStatus))
		return
	}

	if _, err := tx.Exec(
		"UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		req.Status, id); err != nil {
		apierr.Internal(c, err.Error())
		return
	}

	if req.Status == "cancelled" && currentStatus != "cancelled" && pickupAt.Valid {
		if _, err := tx.Exec(
			"UPDATE pickup_slot_counters SET reserved_count = GREATEST(reserved_count - 1, 0) WHERE store_id = 1 AND slot_at = ?",
			pickupAt.Time); err != nil {
			apierr.Internal(c, err.Error())
			return
		}
	}

	if err := tx.Commit(); err != nil {
		apierr.Internal(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "order status updated"})
}
