package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/models"
	"github.com/junc/admin-api/pickup"
)

type PickupHandler struct {
	DB *sql.DB
}

// GET /pickup-settings
func (h *PickupHandler) GetSettings(c *gin.Context) {
	var s models.PickupSettings
	err := h.DB.QueryRow(`
		SELECT id, store_id, slot_interval_min, slot_capacity, lead_time_min,
		       lookahead_days, open_time, close_time, closed_weekdays
		FROM pickup_settings WHERE store_id = 1`).
		Scan(&s.ID, &s.StoreID, &s.SlotIntervalMin, &s.SlotCapacity, &s.LeadTimeMin,
			&s.LookaheadDays, &s.OpenTime, &s.CloseTime, &s.ClosedWeekdays)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "pickup settings not configured"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": s})
}

type updateSettingsRequest struct {
	SlotIntervalMin int    `json:"slotIntervalMin" binding:"required"`
	SlotCapacity    int    `json:"slotCapacity" binding:"required"`
	LeadTimeMin     int    `json:"leadTimeMin"`
	LookaheadDays   int    `json:"lookaheadDays" binding:"required"`
	OpenTime        string `json:"openTime" binding:"required"`
	CloseTime       string `json:"closeTime" binding:"required"`
	ClosedWeekdays  string `json:"closedWeekdays"`
}

// PUT /pickup-settings
func (h *PickupHandler) UpdateSettings(c *gin.Context) {
	var req updateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	// バリデーション
	if req.SlotIntervalMin <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "slotIntervalMin must be > 0"})
		return
	}
	if req.SlotCapacity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "slotCapacity must be > 0"})
		return
	}
	if req.LeadTimeMin < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "leadTimeMin must be >= 0"})
		return
	}
	if req.LookaheadDays <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "lookaheadDays must be > 0"})
		return
	}
	if !isValidTime(req.OpenTime) || !isValidTime(req.CloseTime) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "openTime/closeTime must be HH:MM:SS"})
		return
	}
	openMin, closeMin := parseTimeMin(req.OpenTime), parseTimeMin(req.CloseTime)
	if openMin >= closeMin {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "openTime must be before closeTime"})
		return
	}
	if !isValidClosedWeekdays(req.ClosedWeekdays) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "closedWeekdays must be CSV of 0..6"})
		return
	}

	_, err := h.DB.Exec(`
		UPDATE pickup_settings
		SET slot_interval_min = ?, slot_capacity = ?, lead_time_min = ?, lookahead_days = ?,
		    open_time = ?, close_time = ?, closed_weekdays = ?
		WHERE store_id = 1`,
		req.SlotIntervalMin, req.SlotCapacity, req.LeadTimeMin, req.LookaheadDays,
		req.OpenTime, req.CloseTime, req.ClosedWeekdays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "pickup settings updated"})
}

// GET /pickup-slots?date=YYYY-MM-DD
func (h *PickupHandler) GetSlots(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "date is required"})
		return
	}

	// settings
	var s models.PickupSettings
	err := h.DB.QueryRow(`
		SELECT id, store_id, slot_interval_min, slot_capacity, lead_time_min,
		       lookahead_days, open_time, close_time, closed_weekdays
		FROM pickup_settings WHERE store_id = 1`).
		Scan(&s.ID, &s.StoreID, &s.SlotIntervalMin, &s.SlotCapacity, &s.LeadTimeMin,
			&s.LookaheadDays, &s.OpenTime, &s.CloseTime, &s.ClosedWeekdays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	settings := pickup.SettingsFromSource(pickup.SettingsSource{
		SlotIntervalMin: s.SlotIntervalMin,
		SlotCapacity:    s.SlotCapacity,
		LeadTimeMin:     s.LeadTimeMin,
		LookaheadDays:   s.LookaheadDays,
		OpenTime:        s.OpenTime,
		CloseTime:       s.CloseTime,
		ClosedWeekdays:  s.ClosedWeekdays,
	})

	// reserved counts for the date
	rows, err := h.DB.Query(`
		SELECT slot_at, reserved_count FROM pickup_slot_counters
		WHERE store_id = 1 AND slot_at >= ? AND slot_at < DATE_ADD(?, INTERVAL 1 DAY)`,
		date+" 00:00:00", date+" 00:00:00")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	reserved := map[time.Time]int{}
	for rows.Next() {
		var at time.Time
		var count int
		if err := rows.Scan(&at, &count); err != nil {
			continue
		}
		reserved[at.UTC()] = count
	}

	result := pickup.GenerateSlots(date, settings, time.Now(), reserved)

	type slotSummary struct {
		StartAt       time.Time `json:"startAt"`
		ReservedCount int       `json:"reservedCount"`
		Capacity      int       `json:"capacity"`
	}
	summaries := []slotSummary{}
	for _, slot := range result.Slots {
		summaries = append(summaries, slotSummary{
			StartAt:       slot.StartAt,
			ReservedCount: reserved[slot.StartAt.UTC()],
			Capacity:      settings.SlotCapacity,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"date":         date,
			"closed":       result.Closed,
			"closedReason": result.ClosedReason,
			"slots":        summaries,
		},
	})
}

// ─── ヘルパー ────────────────────────────────────────────────────────

func isValidTime(t string) bool {
	_, err := time.Parse("15:04:05", t)
	return err == nil
}

func parseTimeMin(t string) int {
	parts := strings.Split(t, ":")
	h := atoiSafe(parts[0])
	m := atoiSafe(parts[1])
	return h*60 + m
}

func atoiSafe(s string) int {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int(r-'0')
	}
	return n
}

func isValidClosedWeekdays(csv string) bool {
	if csv == "" {
		return true
	}
	for _, s := range strings.Split(csv, ",") {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		n := atoiSafe(s)
		if n < 0 || n > 6 {
			return false
		}
	}
	return true
}
