import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — сайт работает по любому адресу GitHub Pages (username.github.io/repo/)
export default defineConfig({
  plugins: [react()],
  base: './',
})
