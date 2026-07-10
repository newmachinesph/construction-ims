import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Unit tests target pure domain logic (tax, units, RBAC, ledger math) and
    // never touch the database, so the default node environment is enough.
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
