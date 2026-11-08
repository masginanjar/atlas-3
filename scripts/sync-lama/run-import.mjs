// Payload transform.py + data live -> project baru (yang invoice-nya belum ada di live).
// Pakai: node run-import.mjs <payload.json> <live-mem.json> <out-new-projects.json> <out-new-master.json>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const { applyLegacyImport } = await import(path.resolve(here, '../../src/lib/legacyImport.js'))
const [payloadF, liveF, outP, outM] = process.argv.slice(2)
const live = JSON.parse(fs.readFileSync(liveF, 'utf8'))
const payload = JSON.parse(fs.readFileSync(payloadF, 'utf8'))
const digits = (s) => String(s || '').replace(/\D/g, '')
const liveByDigits = new Map(live.live_invoices.map((v) => [digits(v), v]))
for (const p of payload.projects) { const hit = liveByDigits.get(digits(p.invoice_no)); if (hit) p.invoice_no = hit }
const mem = { users: live.users, people: live.people, couriers: live.couriers,
  projects: live.live_invoices.map((v) => ({ id: 'live-' + v, invoice_no: v, legacy: { masked: false, source: 'live' }, sub_projects: [] })) }
const before = { people: new Set(mem.people.map((p) => p.id)), couriers: new Set(mem.couriers.map((c) => c.id)) }
const source = `atlas-lama-${new Date().toISOString().slice(0, 10)}`
const log = applyLegacyImport(mem, { ...payload, source, masked: false })
const ALIAS = { 'legacy-vendor-stanislaus': 'p-ved-stanislau', 'legacy-vendor-bapak-stanislaus': 'p-ved-stanislau', 'legacy-vendor-deddy': 'p-ved-dedi', 'legacy-vendor-bapak-deddy': 'p-ved-dedi' }
const CS_ALIAS = { wahyu: ['u-cs-jkt2', 'Wahyu'], gin: ['u-sa', 'Super Admin'] }
const tsIso = (s) => { const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2}:\d{2})$/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}+08:00` : null }
const prune = (o) => Array.isArray(o) ? o.map(prune) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).filter(([k, v]) => !(v === '' || v == null || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) || ['translator', 'stage', 'type'].includes(k)).map(([k, v]) => [k, prune(v)])) : o
const out = []
for (const p of mem.projects) {
  if (!String(p.id).startsWith('legacy-')) continue
  if (/^\d{13}$/.test(p.invoice_no)) p.invoice_no = 'INV-' + p.invoice_no
  if (!p.created_by) { const a = CS_ALIAS[(p.about.legacy_cs || '').toLowerCase()]; if (a) { p.created_by = a[0]; p.about.cs_name = a[1] } }
  let created = null
  for (const s of p.sub_projects) {
    for (const k of ['translator', 'executor_id']) if (ALIAS[s[k]]) s[k] = ALIAS[s[k]]
    if (ALIAS[s.data?.vendor]) s.data.vendor = ALIAS[s.data.vendor]
    const lg = s.data?.legacy || {}
    const t = tsIso(lg.Timestamp); if (t && (!created || t < created)) created = t
    s.data.legacy = { 'ID Lama': lg['ID Lama'] || '', Status: lg.Status || '', Proses: lg['Proses Terjemahan'] || '', Penerjemah: lg.Penerjemah || '' }
    delete s.data.legacy_row
    s.history = [{ at: new Date().toISOString(), by: 'Impor ATLAS lama', action: `Diimpor dari ATLAS lama (${lg.Status || ''} / ${lg['Proses Terjemahan'] || ''})` }]
    if (s.docs?.length === 1 && /\b2\./.test(s.docs[0].desc)) delete s.docs
  }
  for (const k of ['legacy_print', 'legacy_courier', 'legacy_ship_raw', 'received_at']) delete p.about[k]
  p.about.deadline_time = '17:00'
  p.legacy = { source, masked: false }
  p.created_at = created || p.created_at
  out.push(prune(p))
}
const newPeople = mem.people.filter((x) => !before.people.has(x.id) && !ALIAS[x.id])
const newCouriers = mem.couriers.filter((x) => !before.couriers.has(x.id))
fs.writeFileSync(outP, JSON.stringify(out)); fs.writeFileSync(outM, JSON.stringify({ people: newPeople, couriers: newCouriers }))
console.log(JSON.stringify({ baru: out.length, sudah_ada: log.projects_existing, master_baru: [...newPeople, ...newCouriers].map((x) => x.name), invoices: out.map((p) => p.invoice_no) }))
