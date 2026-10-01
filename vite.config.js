import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    // Lets your phone open the dev site via your PC's LAN IP.
    host: true,

    // Frontend calls /api/... and Vite forwards it to Express.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});