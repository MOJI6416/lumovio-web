import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // next-intl through Vite: its entry imports "next/navigation" without an extension, which Node alone can't resolve.
  test: { include: ["test/**/*.test.ts"], environment: "node", server: { deps: { inline: ["next-intl"] } } },
});
