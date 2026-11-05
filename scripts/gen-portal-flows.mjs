// Membuat versi ramping config/workflows.js untuk Edge Function portal pelanggan.
// SEMUA isinya diturunkan langsung dari src/config/workflows.js (tabel tahap dibaca
// dari CATEGORIES, fungsi disalin dari fungsi aslinya), jadi tidak mungkin melenceng.
// Yang tidak dibawa: label, hint, roles, fields, notify — portal tidak memakainya.
import { writeFileSync } from 'node:fs'
import * as W from '../src/config/workflows.js'

const keys = Object.fromEntries(Object.entries(W.CATEGORIES).map(([k, v]) => [k, v.stages.map((s) => s.key)]))
const fn = (f) => f.toString()

writeFileSync(new URL('../supabase/functions/portal-cek/config/workflows.js', import.meta.url), `// DIBUAT OTOMATIS oleh scripts/gen-portal-flows.mjs — jangan diedit.
// Sumber: src/config/workflows.js. Perbarui dengan: npm run sync:portal
export const STAGE_KEYS = ${JSON.stringify(keys, null, 2)}
export const PAYMENT_TERMS = ${JSON.stringify(W.PAYMENT_TERMS)}
export const DONE = ${JSON.stringify(W.DONE)}
export const stagesOf = (cat) => (STAGE_KEYS[cat] ?? []).map((key) => ({ key }))
export function stageIndex(cat, key) {
  if (key === DONE) return (STAGE_KEYS[cat] ?? []).length
  return (STAGE_KEYS[cat] ?? []).indexOf(key)
}
export const termOf = ${fn(W.termOf)}
export const isBilled = ${fn(W.isBilled)}
export const deriveFlow = ${fn(W.deriveFlow)}
export const flowOf = ${fn(W.flowOf)}
export const docListOf = ${fn(W.docListOf)}
export const totalPengajuan = ${fn(W.totalPengajuan)}
`)
console.log(`config/workflows.js ramping dibuat — ${Object.keys(keys).length} alur kerja`)
