// 統一エラーレスポンス形式 (user-api src/lib/errors.ts と完全一致)
// 詳細は docs/error_codes.md
package errors

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ErrorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type ErrorResponse struct {
	Success bool      `json:"success"`
	Error   ErrorBody `json:"error"`
}

type AppError struct {
	Code       string
	Message    string
	HTTPStatus int
	Details    map[string]any
}

func (e *AppError) Error() string { return e.Code + ": " + e.Message }

func New(code, message string, httpStatus int, details map[string]any) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: httpStatus, Details: details}
}

// Respond: AppError をレスポンスに書き出す
func Respond(c *gin.Context, err *AppError) {
	c.JSON(err.HTTPStatus, ErrorResponse{
		Success: false,
		Error: ErrorBody{
			Code:    err.Code,
			Message: err.Message,
			Details: err.Details,
		},
	})
}

// RespondCode: 動的に AppError を作ってレスポンスする shorthand
func RespondCode(c *gin.Context, code, message string, httpStatus int, details map[string]any) {
	Respond(c, New(code, message, httpStatus, details))
}

// プリセット ─────────────────────────────────────────────

func AuthTokenMissing(c *gin.Context) {
	RespondCode(c, "AUTH_TOKEN_MISSING", "認証情報が見つかりません", http.StatusUnauthorized, nil)
}
func AuthTokenInvalid(c *gin.Context) {
	RespondCode(c, "AUTH_TOKEN_INVALID", "認証トークンが不正です", http.StatusUnauthorized, nil)
}
func AuthTokenExpired(c *gin.Context) {
	RespondCode(c, "AUTH_TOKEN_EXPIRED", "トークンの有効期限が切れています", http.StatusUnauthorized, nil)
}
func AdminLoginFailed(c *gin.Context) {
	RespondCode(c, "ADMIN_LOGIN_FAILED", "メールアドレスまたはパスワードが違います", http.StatusUnauthorized, nil)
}
func ResourceNotFound(c *gin.Context, resourceType, resourceID string) {
	RespondCode(c, "RESOURCE_NOT_FOUND", "リソースが見つかりません", http.StatusNotFound,
		map[string]any{"resourceType": resourceType, "resourceId": resourceID})
}
func Validation(c *gin.Context, message string, details map[string]any) {
	RespondCode(c, "VALIDATION_FAILED", message, http.StatusBadRequest, details)
}
func Internal(c *gin.Context, message string) {
	if message == "" {
		message = "サーバー内部エラーが発生しました"
	}
	RespondCode(c, "INTERNAL_ERROR", message, http.StatusInternalServerError, nil)
}
func BurgerNotFound(c *gin.Context, id string) {
	RespondCode(c, "BURGER_NOT_FOUND", "指定のバーガーが見つかりません", http.StatusNotFound,
		map[string]any{"burgerId": id})
}
func BurgerReferencedByOrders(c *gin.Context) {
	RespondCode(c, "BURGER_REFERENCED_BY_ORDERS",
		"注文履歴があるため削除できません。販売停止にしてください",
		http.StatusConflict, nil)
}
func OrderNotFound(c *gin.Context, id string) {
	RespondCode(c, "ORDER_NOT_FOUND", "注文が見つかりません", http.StatusNotFound,
		map[string]any{"orderId": id})
}
func OrderInvalidStatusTransition(c *gin.Context, current, requested string, allowed []string) {
	RespondCode(c, "ORDER_INVALID_STATUS_TRANSITION",
		"この状態からは指定のステータスに遷移できません",
		http.StatusConflict,
		map[string]any{"current": current, "requested": requested, "allowed": allowed})
}
