package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

type config struct {
	addr           string
	allowedOrigins []string
	playground     bool
	production     bool
	databaseURL    string
	devNoAuth      bool
}

var devOrigins = []string{"http://localhost:5173", "http://localhost:5174"}

func loadConfig() (config, error) {
	production := os.Getenv("APP_ENV") == "production"

	cfg := config{
		addr:           ":" + envOr("PORT", "8080"),
		allowedOrigins: splitOrigins(os.Getenv("ALLOWED_ORIGINS")),
		playground:     envBool("ENABLE_PLAYGROUND", !production),
		production:     production,
		databaseURL:    os.Getenv("DATABASE_URL"),
		devNoAuth:      envBool("DEV_NO_AUTH", false),
	}

	if len(cfg.allowedOrigins) == 0 && !production {
		cfg.allowedOrigins = devOrigins
	}

	if !production {
		return cfg, nil
	}

	// Every default that makes development pleasant is a hole in production,
	// so refuse to start rather than run wide open.
	var problems []string
	if os.Getenv("JWT_SECRET") == "" {
		problems = append(problems, "JWT_SECRET is not set (tokens would be signed with a public constant)")
	}
	if len(cfg.allowedOrigins) == 0 {
		problems = append(problems, "ALLOWED_ORIGINS is not set")
	}
	if cfg.devNoAuth {
		problems = append(problems, "DEV_NO_AUTH is on")
	}
	if len(problems) > 0 {
		return cfg, errors.New("APP_ENV=production but " + strings.Join(problems, "; "))
	}

	return cfg, nil
}

func (c config) allowsOrigin(origin string) bool {
	for _, allowed := range c.allowedOrigins {
		if allowed == origin {
			return true
		}
	}
	return false
}

func splitOrigins(raw string) []string {
	out := []string{}
	for _, part := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	switch os.Getenv(key) {
	case "1", "true":
		return true
	case "0", "false":
		return false
	default:
		return fallback
	}
}

func (c config) String() string {
	return fmt.Sprintf(
		"addr=%s production=%t playground=%t origins=%s",
		c.addr, c.production, c.playground, strings.Join(c.allowedOrigins, ","),
	)
}
