import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 发布到 https://tatartatarlia.github.io/dada-rogue/ 时，资源要带上仓库名。
// 本地 npm run dev 仍用根路径，不受影响。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/dada-rogue/' : '/',
}))
