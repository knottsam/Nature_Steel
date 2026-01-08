import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteImagemin from 'vite-plugin-imagemin'

export default defineConfig({
  plugins: [
    react(),
    viteImagemin({
      // Global options
      verbose: true,
      // PNG options
      pngquant: {
        quality: [0.6, 0.8]
      },
      // JPG options
      mozjpeg: {
        quality: 80
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase'
            }
            if (id.includes('stripe')) {
              return 'vendor-stripe'
            }
            return 'vendor-other'
          }
          
          // Feature chunks
          if (id.includes('pages/Checkout') || id.includes('pages/Cart') || id.includes('@stripe')) {
            return 'checkout'
          }
          
          // Admin is separate but we're not optimizing it per user request
        },
      },
    },
    // Optimize chunks
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
})
