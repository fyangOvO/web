import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8888,
    host: true,
    proxy: {
      // 开发环境：前端请求 /api 直接转发到本地 Node 服务
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // 图文笔记上传的图片（存 Node 服务 uploads 目录）
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 手動分包：把大依賴拆成獨立 chunk，瀏覽器可以並行下載 + 長期緩存
        manualChunks(id) {
          // node_modules 才拆
          if (!id.includes('node_modules')) return;

          // 核心框架：單獨一個 chunk，所有頁面共享 + 長期緩存
          if (id.includes('vue/') || id.includes('vue-router/')) return 'vendor-framework';
          if (id.includes('@vueuse/')) return 'vendor-vueuse';

          // 圖表 / 可視化
          if (id.includes('@unovis/') || id.includes('d3-')) return 'vendor-charts';

          // 地圖（leaflet 很大）
          if (id.includes('leaflet')) return 'vendor-leaflet';

          // 輪播
          if (id.includes('swiper')) return 'vendor-swiper';

          // 工具庫
          if (id.includes('axios')) return 'vendor-network';
          if (id.includes('zod')) return 'vendor-zod';
          if (id.includes('lunar-javascript')) return 'vendor-lunar';
          if (id.includes('@floating-ui/')) return 'vendor-ui';

          // 其餘 node_modules 合併成一個 vendor
          return 'vendor-misc';
        },
      },
    },
  },
});
