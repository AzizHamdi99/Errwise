import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

export default defineConfig({
  entry: { index: "src/index.ts", nestjs: "src/nestjs.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  platform: "node",
  target: "node20",
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
});
