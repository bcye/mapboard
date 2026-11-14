import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";
import { thirdPartyLicenses } from "./vite-plugins/licenses.ts";
import { siteMeta } from "./vite-plugins/site-meta.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: lazyPlugins(() => [react(), tailwindcss(), thirdPartyLicenses(), siteMeta()]),
});
