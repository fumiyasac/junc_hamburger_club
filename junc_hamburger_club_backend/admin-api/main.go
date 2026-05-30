package main

import (
	"fmt"
	"log"
	"os"

	"github.com/junc/admin-api/config"
	"github.com/junc/admin-api/router"
)

func main() {
	cfg := config.Load()

	db, err := config.NewDB(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	r := router.Setup(db, cfg)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 JUNC Admin API running on :%s\n", port)
	fmt.Printf("📚 Swagger docs: http://localhost:%s/swagger/index.html\n", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
