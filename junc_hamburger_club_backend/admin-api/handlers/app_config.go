package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	apierr "github.com/junc/admin-api/errors"
)

type AppConfigHandler struct {
	DB *sql.DB
}

type appConfigRequest struct {
	MaintenanceMode      *bool   `json:"maintenanceMode"`
	MaintenanceMessage   *string `json:"maintenanceMessage"`
	IOSMinVersion        *string `json:"iosMinVersion"`
	IOSLatestVersion     *string `json:"iosLatestVersion"`
	AndroidMinVersion    *string `json:"androidMinVersion"`
	AndroidLatestVersion *string `json:"androidLatestVersion"`
}

// GET /admin/app-config
func (h *AppConfigHandler) Get(c *gin.Context) {
	var (
		maint     bool
		maintMsg  sql.NullString
		iosMin    string
		iosLatest string
		andMin    string
		andLatest string
	)
	err := h.DB.QueryRow(`SELECT maintenance_mode, maintenance_message,
		ios_min_version, ios_latest_version,
		android_min_version, android_latest_version
		FROM app_config WHERE id = 1`).Scan(
		&maint, &maintMsg, &iosMin, &iosLatest, &andMin, &andLatest)
	if err == sql.ErrNoRows {
		apierr.RespondCode(c, "APP_CONFIG_NOT_FOUND", "アプリ設定が初期化されていません", http.StatusInternalServerError, nil)
		return
	}
	if err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	var msg *string
	if maintMsg.Valid {
		msg = &maintMsg.String
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"maintenance": gin.H{"enabled": maint, "message": msg},
			"ios":         gin.H{"minVersion": iosMin, "latestVersion": iosLatest},
			"android":     gin.H{"minVersion": andMin, "latestVersion": andLatest},
		},
	})
}

// PUT /admin/app-config: 送られてきたキーのみ更新する (部分更新)
func (h *AppConfigHandler) Update(c *gin.Context) {
	var req appConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Validation(c, err.Error(), nil)
		return
	}

	fields := []string{}
	args := []any{}
	if req.MaintenanceMode != nil {
		fields = append(fields, "maintenance_mode = ?")
		args = append(args, *req.MaintenanceMode)
	}
	if req.MaintenanceMessage != nil {
		fields = append(fields, "maintenance_message = ?")
		args = append(args, *req.MaintenanceMessage)
	}
	if req.IOSMinVersion != nil {
		fields = append(fields, "ios_min_version = ?")
		args = append(args, *req.IOSMinVersion)
	}
	if req.IOSLatestVersion != nil {
		fields = append(fields, "ios_latest_version = ?")
		args = append(args, *req.IOSLatestVersion)
	}
	if req.AndroidMinVersion != nil {
		fields = append(fields, "android_min_version = ?")
		args = append(args, *req.AndroidMinVersion)
	}
	if req.AndroidLatestVersion != nil {
		fields = append(fields, "android_latest_version = ?")
		args = append(args, *req.AndroidLatestVersion)
	}
	if len(fields) == 0 {
		apierr.Validation(c, "更新対象のフィールドがありません", map[string]any{"issues": []any{}})
		return
	}
	query := "UPDATE app_config SET "
	for i, f := range fields {
		if i > 0 {
			query += ", "
		}
		query += f
	}
	query += " WHERE id = 1"
	if _, err := h.DB.Exec(query, args...); err != nil {
		apierr.Internal(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "app_config updated"})
}
