package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/models"
)

type DashboardHandler struct {
	DB *sql.DB
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	stats := models.DashboardStats{}

	row := h.DB.QueryRow(`
		SELECT
			COUNT(*) AS total,
			SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
			COALESCE(SUM(total_amount), 0),
			COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total_amount ELSE 0 END), 0),
			SUM(CASE WHEN status IN ('received','preparing','ready') THEN 1 ELSE 0 END)
		FROM orders`)
	if err := row.Scan(&stats.TotalOrders, &stats.TodayOrders, &stats.TotalRevenue, &stats.TodayRevenue, &stats.ActiveOrders); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	_ = h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE is_active = 1").Scan(&stats.TotalUsers)
	_ = h.DB.QueryRow("SELECT COUNT(*) FROM burgers WHERE is_available = 1").Scan(&stats.TotalBurgers)

	rows, err := h.DB.Query(`
		SELECT b.name, SUM(oi.quantity) AS total_qty
		FROM order_items oi
		JOIN burgers b ON oi.burger_id = b.id
		GROUP BY b.id, b.name
		ORDER BY total_qty DESC
		LIMIT 5`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var item struct {
				Name  string `json:"name"`
				Count int    `json:"count"`
			}
			if err := rows.Scan(&item.Name, &item.Count); err == nil {
				stats.PopularBurgers = append(stats.PopularBurgers, item)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}
