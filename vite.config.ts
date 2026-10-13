import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/sens-lab/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
});
