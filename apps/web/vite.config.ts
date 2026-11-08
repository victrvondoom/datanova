import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Code-split heavy vendor libs so the initial bundle stays lean:
        // three.js (Atlas 3D studio) and recharts/lucide (charts + icons).
        codeSplitting: {
          groups: [
            { name: 'vendor-three', test: /node_modules[\\/]three/ },
            { name: 'vendor-charts', test: /node_modules[\\/](recharts|lucide-react)/ },
          ],
        },
      },
    },
    // The only >500 kB chunk is vendor-three (three.js), loaded on demand by
    // the Atlas 3D studio — never part of the initial bundle.
    chunkSizeWarningLimit: 600,
  },
})
