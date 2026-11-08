import { defineConfig } from "vite";
export default defineConfig({
  envDir: "../..",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/camera-companion-app-[hash].js",
        chunkFileNames: "assets/camera-companion-[name]-[hash].js",
        assetFileNames: (asset) => {
          const names = asset.names || [asset.name || ""];
          return names.some((name) => name.endsWith(".css"))
            ? "assets/camera-companion-styles-[hash][extname]"
            : "assets/camera-companion-[name]-[hash][extname]";
        },
      },
    },
  },
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
