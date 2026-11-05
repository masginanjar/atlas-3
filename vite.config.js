import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:demo` menghasilkan 1 file HTML (untuk demo/preview).
// `npm run build` biasa dipakai Vercel.
// VITE_MASK_PII=1 → bundel memakai payload impor yang sudah disamarkan (data pribadi pelanggan tidak ikut ter-bundle).
const legacyPayload = process.env.VITE_MASK_PII === '1' ? './src/lib/legacy/payload-2026-11-04.masked.json' : './src/lib/legacy/payload-2026-11-04.json'
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  resolve: { alias: { '@legacy-payload': fileURLToPath(new URL(legacyPayload, import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 900,
    // Pustaka pihak ketiga dipisah agar tetap tersimpan di cache browser
    // walau kode aplikasi diperbarui (buka berikutnya jadi lebih cepat).
    rollupOptions: mode === 'single' ? {} : {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return
          if (/react|scheduler/.test(id)) return 'vendor-react'
          if (/supabase|insforge/.test(id)) return 'vendor-data'
          if (/lucide-react/.test(id)) return 'vendor-icons'
        },
      },
    },
  },
}))
