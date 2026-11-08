import { defineConfig } from "vite";
export default defineConfig({
  envDir: "../..",
  base: "/camera/",
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
});
