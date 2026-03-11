import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path must match the GitHub repository name exactly
const BASE = process.env.VITE_BASE_PATH || '/inspectflow-demo'

export default defineConfig({
  plugins: [react()],
  base: BASE,
})
