import { defineConfig } from "vite";
export default defineConfig({
  envDir: "../..",
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
        xfwd: true,
      },
      "/camera": {
        target: "http://127.0.0.1:5174",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
});
