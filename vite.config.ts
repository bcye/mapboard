import { defineConfig } from "vite-plus";

export default defineConfig({
  // `vp dev`, `vp build` and `vp preview` at the root target the app.
  defaultPackage: "./apps/web",
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    printWidth: 110,
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/web/**"],
        plugins: ["react"],
        rules: {
          "react/rules-of-hooks": "error",
          "react/only-export-components": ["warn", { allowConstantExport: true }],
        },
      },
    ],
  },
  run: {
    cache: true,
  },
});
