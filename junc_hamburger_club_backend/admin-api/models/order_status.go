// 注文ステータス遷移表 (user-api src/lib/order_status.ts と完全同期)
// 正本: docs/error_codes.md § 注文ステータス遷移表
package models

type OrderStatus string

const (
	StatusReceived  OrderStatus = "received"
	StatusPreparing OrderStatus = "preparing"
	StatusReady     OrderStatus = "ready"
	StatusCompleted OrderStatus = "completed"
	StatusCancelled OrderStatus = "cancelled"
)

// 許可される遷移先。ready / preparing からのキャンセルは preparing のみ許可。
// ready からは completed のみ。completed / cancelled は終端。
var allowedTransitions = map[OrderStatus][]OrderStatus{
	StatusReceived:  {StatusPreparing, StatusCancelled},
	StatusPreparing: {StatusReady, StatusCancelled},
	StatusReady:     {StatusCompleted},
	StatusCompleted: {},
	StatusCancelled: {},
}

// AllOrderStatuses は enum 値の全集合 (bind 検証用)
var AllOrderStatuses = []OrderStatus{
	StatusReceived, StatusPreparing, StatusReady, StatusCompleted, StatusCancelled,
}

func IsValidOrderStatus(s string) bool {
	for _, v := range AllOrderStatuses {
		if string(v) == s {
			return true
		}
	}
	return false
}

// AllowedNext は current から遷移可能な次ステータスのリストを返す
func AllowedNext(current OrderStatus) []OrderStatus {
	if next, ok := allowedTransitions[current]; ok {
		return next
	}
	return nil
}

// AllowedNextStrings は webfront / API レスポンス用の string スライス
func AllowedNextStrings(current string) []string {
	next := AllowedNext(OrderStatus(current))
	out := make([]string, 0, len(next))
	for _, s := range next {
		out = append(out, string(s))
	}
	return out
}

// CanTransition は from → to が許可されているか判定
func CanTransition(from, to OrderStatus) bool {
	for _, s := range AllowedNext(from) {
		if s == to {
			return true
		}
	}
	return false
}
