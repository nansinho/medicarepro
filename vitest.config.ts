import { defineConfig } from "vitest/config";
import path from "node:path";

/* ============================================================
   Vitest — tests unitaires des libs serveur (crypto, monetico,
   pricing…). Environnement Node pur ; le paquet "server-only"
   (qui jette hors React Server) est remplacé par un stub vide.
   ============================================================ */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
