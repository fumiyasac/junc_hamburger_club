package models

import "time"

// ID フィールドは JSON 出力時に string へシリアライズする (user-api との契約統一のため)。
// Go 内部では int のまま扱い、`json:"...,string"` タグで出力時のみ文字列化する。

type User struct {
	ID              int        `json:"id,string"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	ProfileImageURL *string    `json:"profileImageUrl"`
	IsActive        bool       `json:"isActive"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type BurgerCategory struct {
	ID           int       `json:"id,string"`
	Name         string    `json:"name"`
	Emoji        string    `json:"emoji"`
	Description  *string   `json:"description"`
	DisplayOrder int       `json:"displayOrder"`
	IsActive     bool      `json:"isActive"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Burger struct {
	ID          int      `json:"id,string"`
	CategoryID  int      `json:"categoryId,string"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Price       float64  `json:"price"`
	ImageURL    *string  `json:"imageUrl"`
	Rating      float64  `json:"rating"`
	ReviewCount int      `json:"reviewCount"`
	IsPopular   bool     `json:"isPopular"`
	IsAvailable bool     `json:"isAvailable"`
	Calories    *int     `json:"calories"`
	Ingredients []string `json:"ingredients"`
	Tags        []string `json:"tags"`
}

type Order struct {
	ID               int         `json:"id,string"`
	UserID           int         `json:"userId,string"`
	UserName         string      `json:"userName"`
	UserEmail        string      `json:"userEmail"`
	OrderNumber      string      `json:"orderNumber"`
	Status           string      `json:"status"`
	TotalAmount      float64     `json:"totalAmount"`
	TaxAmount        float64     `json:"taxAmount"`
	Notes            *string     `json:"notes"`
	EstimatedReadyAt *time.Time  `json:"estimatedReadyAt"`
	CreatedAt        time.Time   `json:"createdAt"`
	UpdatedAt        time.Time   `json:"updatedAt"`
	Items            []OrderItem `json:"items"`
}

type OrderItem struct {
	ID             int     `json:"id,string"`
	BurgerID       int     `json:"burgerId,string"`
	BurgerName     string  `json:"burgerName"`
	BurgerImageURL *string `json:"burgerImageUrl"`
	Quantity       int     `json:"quantity"`
	UnitPrice      float64 `json:"unitPrice"`
	Subtotal       float64 `json:"subtotal"`
}

type DashboardStats struct {
	TotalOrders    int     `json:"totalOrders"`
	TodayOrders    int     `json:"todayOrders"`
	TotalRevenue   float64 `json:"totalRevenue"`
	TodayRevenue   float64 `json:"todayRevenue"`
	ActiveOrders   int     `json:"activeOrders"`
	TotalUsers     int     `json:"totalUsers"`
	TotalBurgers   int     `json:"totalBurgers"`
	PopularBurgers []struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	} `json:"popularBurgers"`
}

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateOrderStatusRequest struct {
	Status string `json:"status" binding:"required"`
}
