package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	apierr "github.com/junc/admin-api/errors"
	"github.com/junc/admin-api/models"
)

type OptionsHandler struct {
	DB *sql.DB
}

// ─── Option Groups ───────────────────────────────────────────────────

// GET /admin/option-groups: グループ一覧 + 配下オプション
func (h *OptionsHandler) ListGroups(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, name, is_required, min_select, max_select, display_order
		FROM option_groups
		ORDER BY display_order, id`)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	defer rows.Close()

	groups := []models.OptionGroup{}
	for rows.Next() {
		var g models.OptionGroup
		if err := rows.Scan(&g.ID, &g.Name, &g.IsRequired, &g.MinSelect, &g.MaxSelect, &g.DisplayOrder); err != nil {
			continue
		}
		g.Options = []models.Option{}
		groups = append(groups, g)
	}

	// 全オプションを 1 クエリで取得して in-memory で割り当て
	optRows, err := h.DB.Query(`
		SELECT id, group_id, name, price_delta, is_available, display_order
		FROM options
		ORDER BY display_order, id`)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	defer optRows.Close()

	byGroup := map[int][]models.Option{}
	for optRows.Next() {
		var o models.Option
		if err := optRows.Scan(&o.ID, &o.GroupID, &o.Name, &o.PriceDelta, &o.IsAvailable, &o.DisplayOrder); err != nil {
			continue
		}
		byGroup[o.GroupID] = append(byGroup[o.GroupID], o)
	}
	for i := range groups {
		if opts, ok := byGroup[groups[i].ID]; ok {
			groups[i].Options = opts
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": groups})
}

type createGroupRequest struct {
	Name         string `json:"name" binding:"required"`
	IsRequired   bool   `json:"isRequired"`
	MinSelect    int    `json:"minSelect"`
	MaxSelect    int    `json:"maxSelect"`
	DisplayOrder int    `json:"displayOrder"`
}

func (r *createGroupRequest) validate() string {
	if r.MinSelect < 0 || r.MaxSelect < 0 {
		return "min/max must be non-negative"
	}
	if r.MinSelect > r.MaxSelect {
		return "min_select must be <= max_select"
	}
	if r.MaxSelect < 1 {
		return "max_select must be >= 1"
	}
	if r.IsRequired && r.MinSelect < 1 {
		return "min_select must be >= 1 when isRequired is true"
	}
	return ""
}

func (h *OptionsHandler) CreateGroup(c *gin.Context) {
	var req createGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}
	if msg := req.validate(); msg != "" {
		apierr.Validation(c, msg, nil)
		return
	}
	res, err := h.DB.Exec(
		`INSERT INTO option_groups (name, is_required, min_select, max_select, display_order)
		 VALUES (?, ?, ?, ?, ?)`,
		req.Name, req.IsRequired, req.MinSelect, req.MaxSelect, req.DisplayOrder,
	)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	id, _ := res.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": strconv.FormatInt(id, 10)}})
}

func (h *OptionsHandler) UpdateGroup(c *gin.Context) {
	id := c.Param("id")
	var req createGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}
	if msg := req.validate(); msg != "" {
		apierr.Validation(c, msg, nil)
		return
	}
	res, err := h.DB.Exec(
		`UPDATE option_groups SET name = ?, is_required = ?, min_select = ?, max_select = ?, display_order = ?
		 WHERE id = ?`,
		req.Name, req.IsRequired, req.MinSelect, req.MaxSelect, req.DisplayOrder, id,
	)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	if a, _ := res.RowsAffected(); a == 0 {
		apierr.RespondCode(c, "OPTION_GROUP_NOT_FOUND", "指定のオプショングループが見つかりません", http.StatusNotFound, nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "updated"})
}

// ─── Options ─────────────────────────────────────────────────────────

type createOptionRequest struct {
	GroupID      int     `json:"groupId,string" binding:"required"`
	Name         string  `json:"name" binding:"required"`
	PriceDelta   float64 `json:"priceDelta"`
	IsAvailable  bool    `json:"isAvailable"`
	DisplayOrder int     `json:"displayOrder"`
}

func (r *createOptionRequest) validate() string {
	if r.PriceDelta < 0 {
		return "priceDelta must be >= 0"
	}
	return ""
}

func (h *OptionsHandler) CreateOption(c *gin.Context) {
	var req createOptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}
	if msg := req.validate(); msg != "" {
		apierr.Validation(c, msg, nil)
		return
	}
	res, err := h.DB.Exec(
		`INSERT INTO options (group_id, name, price_delta, is_available, display_order)
		 VALUES (?, ?, ?, ?, ?)`,
		req.GroupID, req.Name, req.PriceDelta, req.IsAvailable, req.DisplayOrder,
	)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	id, _ := res.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": strconv.FormatInt(id, 10)}})
}

func (h *OptionsHandler) UpdateOption(c *gin.Context) {
	id := c.Param("id")
	var req createOptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}
	if msg := req.validate(); msg != "" {
		apierr.Validation(c, msg, nil)
		return
	}
	res, err := h.DB.Exec(
		`UPDATE options SET group_id = ?, name = ?, price_delta = ?, is_available = ?, display_order = ?
		 WHERE id = ?`,
		req.GroupID, req.Name, req.PriceDelta, req.IsAvailable, req.DisplayOrder, id,
	)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	if a, _ := res.RowsAffected(); a == 0 {
		apierr.RespondCode(c, "OPTION_NOT_FOUND", "指定のオプションが見つかりません", http.StatusNotFound, nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "updated"})
}

// PUT /admin/options/:id/availability: 売り切れトグル
func (h *OptionsHandler) ToggleAvailability(c *gin.Context) {
	id := c.Param("id")
	res, err := h.DB.Exec(
		`UPDATE options SET is_available = NOT is_available WHERE id = ?`, id,
	)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	if a, _ := res.RowsAffected(); a == 0 {
		apierr.RespondCode(c, "OPTION_NOT_FOUND", "指定のオプションが見つかりません", http.StatusNotFound, nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "availability toggled"})
}

// ─── Burger ↔ Option Group 紐付け ───────────────────────────────────

// GET /admin/burgers/:id/option-groups
func (h *OptionsHandler) ListBurgerGroups(c *gin.Context) {
	burgerID := c.Param("id")
	rows, err := h.DB.Query(`
		SELECT group_id FROM burger_option_groups WHERE burger_id = ?`, burgerID)
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var gid int
		if err := rows.Scan(&gid); err == nil {
			ids = append(ids, strconv.Itoa(gid))
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"groupIds": ids}})
}

// PUT /admin/burgers/:id/option-groups: body { groupIds: ["1","2"] } でまるごと差し替え
func (h *OptionsHandler) SetBurgerGroups(c *gin.Context) {
	burgerID := c.Param("id")
	var raw struct {
		GroupIDs []string `json:"groupIds"`
	}
	if err := c.ShouldBindJSON(&raw); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}

	// バーガー存在確認
	var exists int
	if err := h.DB.QueryRow("SELECT 1 FROM burgers WHERE id = ?", burgerID).Scan(&exists); err != nil {
		apierr.BurgerNotFound(c, burgerID)
		return
	}

	// groupIds を int 化 + 重複除去
	seen := map[int]bool{}
	gids := []int{}
	for _, gidStr := range raw.GroupIDs {
		gid, err := strconv.Atoi(gidStr)
		if err != nil || gid <= 0 {
			apierr.RespondCode(c, "OPTION_GROUP_INVALID_ID", "groupId の指定が不正です", http.StatusBadRequest, map[string]any{"value": gidStr})
			return
		}
		if !seen[gid] {
			seen[gid] = true
			gids = append(gids, gid)
		}
	}

	tx, err := h.DB.Begin()
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM burger_option_groups WHERE burger_id = ?", burgerID); err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	for _, gid := range gids {
		res, err := tx.Exec(
			`INSERT INTO burger_option_groups (burger_id, group_id, display_order)
			 SELECT ?, ?, display_order FROM option_groups WHERE id = ?`,
			burgerID, gid, gid,
		)
		if err != nil {
			apierr.Internal(c, err.Error())
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			apierr.RespondCode(c, "OPTION_GROUP_NOT_FOUND", "指定のオプショングループが見つかりません", http.StatusNotFound, map[string]any{"groupId": strconv.Itoa(gid)})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "groups updated"})
}

