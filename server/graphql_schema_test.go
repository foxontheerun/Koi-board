package server_test

import (
	"os"
	"testing"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestTransientBatchTypesPresent(t *testing.T) {
	schema := gqlparser.MustLoadSchema(
		&ast.Source{Name: "graphql/transient.graphqls", Input: mustReadFile(t, "graphql/transient.graphqls")},
		&ast.Source{Name: "graphql/shape.graphqls", Input: mustReadFile(t, "graphql/shape.graphqls")},
		&ast.Source{Name: "graphql/board.graphqls", Input: mustReadFile(t, "graphql/board.graphqls")},
		&ast.Source{Name: "graphql/root.graphqls", Input: mustReadFile(t, "graphql/root.graphqls")},
	)

	for _, typeName := range []string{"TransientShapePatchInput", "TransientShapePatch", "TransientBatchEvent"} {
		if schema.Types[typeName] == nil {
			t.Fatalf("expected type %q to exist in GraphQL schema", typeName)
		}
	}
}

func mustReadFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read schema file %s: %v", path, err)
	}
	return string(b)
}
