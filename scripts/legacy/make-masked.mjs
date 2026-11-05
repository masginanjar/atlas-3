// Membuat payload tersamar untuk demo publik: node scripts/legacy/make-masked.mjs
import fs from 'node:fs'
import { maskPayload } from '../../src/lib/legacyImport.js'
const src = new URL('../../src/lib/legacy/payload-2026-11-04.json', import.meta.url)
const out = new URL('../../src/lib/legacy/payload-2026-11-04.masked.json', import.meta.url)
const masked = maskPayload(JSON.parse(fs.readFileSync(src)))
masked.review = masked.review.map((r) => ({ row: r.row, invoice: r.invoice, issue: r.issue.replace(/teks detail: [^)]*/, 'teks detail') }))
fs.writeFileSync(out, JSON.stringify(masked))
console.log('masked ->', out.pathname)
