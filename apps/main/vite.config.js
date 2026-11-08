import { defineConfig } from "vite";
export default defineConfig({
  envDir: "../..",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/refridge-app-[hash].js",
        chunkFileNames: "assets/refridge-[name]-[hash].js",
        assetFileNames: (asset) => {
          const names = asset.names || [asset.name || ""];
          return names.some((name) => name.endsWith(".css"))
            ? "assets/refridge-styles-[hash][extname]"
            : "assets/refridge-[name]-[hash][extname]";
        },
      },
    },
  },
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
