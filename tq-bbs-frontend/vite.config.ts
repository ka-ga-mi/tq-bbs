import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from '@unocss/vite'

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, process.cwd(), '')
  let viteApiBase = loaded.VITE_API_BASE_URL ?? ''

  // 生产构建时若只有根目录 .env（常含 localhost），Vite 会把该串静态打进 JS；部署后浏览器会去连用户本机。
  if (mode === 'production' && viteApiBase && /localhost|127\.0\.0\.1/.test(viteApiBase)) {
    viteApiBase = ''
  }

  return {
    plugins: [vue(), Unocss()],
    define: {
      // 不用 import.meta.env.VITE_*：否则 Vite 会从 .env 再注入一遍，覆盖我们在下面的清空逻辑
      __TQ_BBS_API_BASE__: JSON.stringify(viteApiBase),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) return 'vue-vendor'
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
  }
})
