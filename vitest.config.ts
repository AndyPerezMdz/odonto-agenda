import { defineConfig } from "vitest/config";
import path from "node:path";

// Pruebas automáticas (npm test): la lógica que no se ve pero que, si se rompe, nadie se da cuenta.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
