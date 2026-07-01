import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  server: {
    port: 5173,
    strictPort: false,
    open: false,

    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    minify: "terser",
    rollupOptions: {
      output: {
        // Optimize bundle splitting for production
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          antd: ["antd"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },

  // Environment variables
  define: {
    __VITE_API_URL__: JSON.stringify(process.env.VITE_API_URL || "http://localhost:4000"),
  },
});
