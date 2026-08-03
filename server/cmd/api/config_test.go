package main

import "testing"

func TestDevDefaults(t *testing.T) {
	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("dev config should load: %v", err)
	}
	if cfg.addr != ":8080" {
		t.Fatalf("default port: got %s", cfg.addr)
	}
	if !cfg.playground {
		t.Fatal("playground should be on outside production")
	}
	if !cfg.allowsOrigin("http://localhost:5173") {
		t.Fatal("the vite dev server should be allowed by default")
	}
	if cfg.allowsOrigin("https://evil.example") {
		t.Fatal("an unlisted origin should never be allowed")
	}
}

func TestProductionRefusesDevDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	if _, err := loadConfig(); err == nil {
		t.Fatal("production without JWT_SECRET or ALLOWED_ORIGINS should refuse to start")
	}

	t.Setenv("JWT_SECRET", "s3cret")
	t.Setenv("ALLOWED_ORIGINS", "https://koi.app")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("configured production should load: %v", err)
	}
	if cfg.playground {
		t.Fatal("playground should be off in production unless asked for")
	}
	if cfg.allowsOrigin("http://localhost:5173") {
		t.Fatal("dev origins should not leak into production")
	}

	t.Setenv("DEV_NO_AUTH", "1")
	if _, err := loadConfig(); err == nil {
		t.Fatal("DEV_NO_AUTH in production should refuse to start")
	}
}
