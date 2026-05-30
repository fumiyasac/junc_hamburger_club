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
	}

	return r
}
