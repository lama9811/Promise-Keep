import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 5173 and 8000 are used by other local projects on this machine.
  server: { port: 5180, strictPort: true },
})
