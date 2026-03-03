import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isVercelBuild = process.env.VERCEL === "1";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_ORIGIN || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: isVercelBuild ? "dist" : "../web",
    emptyOutDir: true,
  },
});
