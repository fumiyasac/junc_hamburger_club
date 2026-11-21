package router

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/junc/admin-api/config"
	"github.com/junc/admin-api/handlers"
	"github.com/junc/admin-api/middleware"
)

func Setup(db *sql.DB, cfg *config.Config) *gin.Engine {
	gin.SetMode(cfg.GinMode)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(middleware.CORS())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "junc-admin-api"})
	})

	authH := &handlers.AuthHandler{DB: db, JWTSecret: cfg.JWTSecret}
	burgerH := &handlers.BurgerHandler{DB: db}
	orderH := &handlers.OrderHandler{DB: db}
	userH := &handlers.UserHandler{DB: db}
	dashH := &handlers.DashboardHandler{DB: db}
	pickupH := &handlers.PickupHandler{DB: db}
	optionsH := &handlers.OptionsHandler{DB: db}
	appConfigH := &handlers.AppConfigHandler{DB: db}

	api := r.Group("/api/v1/admin")

	api.POST("/login", authH.Login)

	protected := api.Group("")
	protected.Use(middleware.AdminAuth(cfg.JWTSecret))
	{
		protected.GET("/dashboard", dashH.GetStats)

		protected.GET("/burgers", burgerH.ListBurgers)
		protected.GET("/burgers/:id", burgerH.GetBurger)
		protected.POST("/burgers", burgerH.CreateBurger)
		protected.PUT("/burgers/:id", burgerH.UpdateBurger)
		protected.PUT("/burgers/:id/availability", burgerH.ToggleAvailability)
		protected.DELETE("/burgers/:id", burgerH.DeleteBurger)

		protected.GET("/orders", orderH.ListOrders)
		protected.GET("/orders/:id", orderH.GetOrder)
		protected.PUT("/orders/:id/status", orderH.UpdateOrderStatus)

		protected.GET("/users", userH.ListUsers)
		protected.GET("/users/:id", userH.GetUser)
		protected.PUT("/users/:id/toggle", userH.ToggleUserActive)

		protected.GET("/pickup-settings", pickupH.GetSettings)
		protected.PUT("/pickup-settings", pickupH.UpdateSettings)
		protected.GET("/pickup-slots", pickupH.GetSlots)

		// オプション管理
		protected.GET("/option-groups", optionsH.ListGroups)
		protected.POST("/option-groups", optionsH.CreateGroup)
		protected.PUT("/option-groups/:id", optionsH.UpdateGroup)
		protected.POST("/options", optionsH.CreateOption)
		protected.PUT("/options/:id", optionsH.UpdateOption)
		protected.PUT("/options/:id/availability", optionsH.ToggleAvailability)
		protected.GET("/burgers/:id/option-groups", optionsH.ListBurgerGroups)
		protected.PUT("/burgers/:id/option-groups", optionsH.SetBurgerGroups)

		// アプリ設定
		protected.GET("/app-config", appConfigH.Get)
		protected.PUT("/app-config", appConfigH.Update)
	}

	return r
}
