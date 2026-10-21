import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${root}$1` },
      { find: "server-only", replacement: `${root}tests/server-only-stub.ts` },
    ],
  },
  test: { include: ["tests/**/*.test.ts"] },
});
