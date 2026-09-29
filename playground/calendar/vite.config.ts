import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { somoimData } from './vite/somoimData.ts'

export default defineConfig({
  base: './',
  plugins: [react(), somoimData()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
})
