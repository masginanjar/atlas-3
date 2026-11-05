#!/bin/sh
# Menyiapkan Edge Function portal pelanggan (#/cek).
#  1) salin logika portal dari src/ (sumber tunggal — jangan edit salinannya)
#  2) buat versi ramping config/workflows.js dari CATEGORIES yang asli
#  3) bundel jadi satu berkas untuk di-deploy
# Jalankan setiap kali portalCust.js / portalCore.js / pay.js / workflows.js / index.ts berubah.
set -e
d=supabase/functions/portal-cek
mkdir -p "$d/lib" "$d/config"
cp src/lib/portalCore.js src/lib/portalCust.js src/lib/pay.js "$d/lib/"
node scripts/gen-portal-flows.mjs
npx esbuild "$d/index.ts" --bundle --format=esm --platform=neutral --target=es2022 \
  --external:'jsr:*' --external:'npm:*' --external:'node:*' --legal-comments=none \
  --banner:js='// DIBUAT OTOMATIS oleh sync-portal-fn.sh dari src/ — jangan diedit. Deploy berkas ini sebagai index.ts fungsi "portal-cek".' \
  --outfile="$d/bundle.js"
echo "Siap deploy: $d/bundle.js ($(wc -c < "$d/bundle.js") bytes, $(wc -l < "$d/bundle.js") baris)"
