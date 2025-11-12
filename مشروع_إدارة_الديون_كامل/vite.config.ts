import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // فصل مكتبات React
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // فصل مكتبات UI
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-select'],
          // فصل مكتبات المخططات
          'charts-vendor': ['recharts'],
          // فصل مكتبات PDF
          'pdf-vendor': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          // فصل مكتبات النماذج
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // فصل Supabase
          'supabase-vendor': ['@supabase/supabase-js'],
          // فصل أيقونات ومساعدات
          'utils-vendor': ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})

