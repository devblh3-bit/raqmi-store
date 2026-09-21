import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirrors the "@/*" -> "./src/*" alias from tsconfig so tests can import the
// same specifiers the app uses (Server Actions and components rely on them).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/.git/**", "**/.claude/worktrees/**"],
  },
});
