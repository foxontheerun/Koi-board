//go:build tools
// +build tools

// This file pins gqlgen as a build-time tool dependency so that
// `go run github.com/99designs/gqlgen generate` has all its codegen deps
// recorded in go.sum. It is never compiled into the application.
package tools

import _ "github.com/99designs/gqlgen"
