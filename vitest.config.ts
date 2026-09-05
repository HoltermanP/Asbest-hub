import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/ai/agents/**/*.ts"],
      exclude: ["src/lib/**/*.d.ts", "src/lib/storage.ts", "src/lib/email.ts", "src/lib/ratelimit.ts", "src/lib/queue.ts", "src/lib/auth.ts", "src/lib/pdf.tsx", "src/lib/docx.ts", "src/lib/text-extract.ts", "src/lib/zip.ts", "src/lib/transcribe.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
