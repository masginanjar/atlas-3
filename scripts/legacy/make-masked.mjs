// Membuat payload tersamar untuk demo publik.
// Sumber mentah tidak boleh ada di git. Simpan di scripts/legacy/private/payload.json
// lalu jalankan: node scripts/legacy/make-masked.mjs
import fs from 'node:fs'
import { maskPayload } from '../../src/lib/legacyImport.js'

const src = new URL('./private/payload.json', import.meta.url)
const out = new URL('../../src/lib/legacy/payload-2026-11-04.masked.json', import.meta.url)
if (!fs.existsSync(src)) {
  console.error('Sumber tidak ada. Simpan dump lokal di scripts/legacy/private/payload.json (folder ini di-gitignore).')
  process.exit(1)
}
const masked = maskPayload(JSON.parse(fs.readFileSync(src)))
const unsafe = (masked.projects || []).filter((p) => !String(p.customer_name || '').includes('***') || p.ship || String(p.notes || '').trim())
const addressNotes = (masked.review || []).filter((r) => /Beda alamat antar baris: dipakai/.test(r.issue || ''))
if (unsafe.length || addressNotes.length) {
  console.error('Penyamaran gagal; berkas tersamar tidak ditulis.')
  process.exit(1)
}
fs.writeFileSync(out, JSON.stringify(masked))
console.log('masked projects', masked.projects.length)
