const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  root: __dirname,
  test: {
    environment: "node",
    globals: false,
    include: ["__tests__/**/*.test.mjs"],
  },
  css: { postcss: { plugins: [] } },
});
