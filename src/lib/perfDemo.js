// ============================================================
//  DATA CONTOH PERFORMA HARIAN (demo)
//  Setiap hari (WITA) dibuat ulang: setiap staf punya tugas ber-deadline hari ini
//  dengan progres beragam (0%, 10%, 20%, 30%, 80%, 100%).
//  Sub project contoh ditandai data.demo_owner agar hanya dihitung untuk pemiliknya.
// ============================================================
import { summarize, hasPersonalTasks, dayKey } from './performance.js'
import { DEMO_PDF } from './seed.js'

const TARGETS = [0, 10, 20, 30, 80, 100]
const DOCS = ['Akta Kelahiran', 'Ijazah', 'Transkrip Nilai', 'Kartu Keluarga', 'Paspor', 'Surat Nikah', 'SKCK', 'Rekening Koran', 'NPWP', 'Surat Keterangan Kerja', 'Sertifikat', 'Akta Pendirian']
const LANGS = [['Indonesia', 'Inggris'], ['Inggris', 'Indonesia'], ['Indonesia', 'Jepang'], ['Jerman', 'Indonesia'], ['Indonesia', 'Mandarin']]
const TIMES = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:00', '17:00']
const PRIO = ['Normal', 'Normal', 'Ekspres', 'Normal', 'Super Ekspres', 'Normal', 'Sameday']
const JASA = ['Fotokopi legalisir', 'Penjilidan dokumen', 'Scan & arsip digital', 'Pengecekan dokumen', 'Cetak ulang']

/** Bentuk sub project contoh per role: { flow, type, active, done, data } */
function shapeFor(u, vendor) {
  const own = { demo_owner: u.id }
  switch (u.role) {
    case 'penerjemah': return { flow: 'tr_int', type: 'terjemahan', active: 'penerjemahan', data: { ...own, translator: u.id } }
    case 'proofreader': return { flow: 'tr_int', type: 'terjemahan', active: 'proofread', data: { ...own, translator: 'u-tr-andre', proofreader: u.id } }
    case 'otorisator': return { flow: 'tr_int', type: 'terjemahan', active: 'otorisasi', data: { ...own, proofreader: 'u-pr-kevin' }, doneData: { authorized_by: u.id, authorized_name: u.name } }
    case 'supervisor': return { flow: 'tr_int', type: 'terjemahan', active: 'pilih_penerjemah', data: { ...own } }
    case 'staf_apostille': return { flow: 'ap_int', type: 'apostille', active: 'antrian', data: { ...own, staff_apostille: u.id } }
    case 'direktur':
    case 'akunting': {
      const cost = 350000 + (u.id.length % 4) * 50000
      const v = { vendor: vendor?.id, vendor_service: vendor?.services?.[0]?.name || 'Terjemahan dokumen', vendor_cost: cost, total_pengajuan: cost }
      return u.role === 'direktur'
        ? { flow: 'tr_ext', type: 'terjemahan', active: 'persetujuan', vendor: true, data: { ...own, ...v } }
        : { flow: 'tr_ext', type: 'terjemahan', active: 'pembayaran', vendor: true, data: { ...own, ...v, sumber_dana: 'ATS' } }
    }
    default: return { flow: 'jl', type: 'jasa_lain', active: 'proses', mine: true, data: { ...own } }
  }
}

/** Cari tambahan (selesai a, aktif b) paling sedikit agar progres = target (target berikutnya bila tidak mungkin). */
function solve(D, T, targets) {
  for (const p of targets) {
    for (let n = Math.max(3 - T, 0); n <= 24; n++) {
      for (let a = 0; a <= n; a++) {
        if (T + n && Math.round(((D + a) / (T + n)) * 100) === p) return { p, a, b: n - a }
      }
    }
  }
  return null
}

export function perfDemo(m, now = new Date()) {
  const today = dayKey(now)
  const enabled = ((m.app_settings || []).find((r) => r.key === 'demo') || {}).perf !== false
  if (!enabled) { const n = m.projects.length; m.projects = m.projects.filter((p) => !String(p.id).startsWith('pd-')); m.perf_demo_day = ''; return n !== m.projects.length }
  if (m.perf_demo_day === today) return false
  m.projects = m.projects.filter((p) => !String(p.id).startsWith('pd-'))
  const vendor = m.people.find((p) => p.type === 'vendor')
  const users = m.users.filter((u) => u.active !== false && hasPersonalTasks(u)).sort((a, b) => a.id.localeCompare(b.id))
  // progres awal tiap orang (tugas nyata hari ini), lalu bagi target merata ke orang yang memungkinkan
  const base = new Map(users.map((u) => { const r = summarize(u, m.projects, today, now); return [u.id, { D: r.done.length, T: r.total }] }))
  const plans = new Map()
  const left = [...users]
  for (let round = 0; left.length && round < users.length; round++) {
    for (const p of TARGETS) {
      const i = left.findIndex((u) => solve(base.get(u.id).D, base.get(u.id).T, [p]))
      if (i < 0) continue
      const u = left.splice(i, 1)[0]; plans.set(u.id, solve(base.get(u.id).D, base.get(u.id).T, [p]))
      if (!left.length) break
    }
  }
  for (const u of left) { const { D, T } = base.get(u.id); plans.set(u.id, solve(D, T, TARGETS) || { a: 0, b: 3 }) }
  let k = 0
  users.forEach((u) => {
    const plan = plans.get(u.id)
    const shape = shapeFor(u, vendor)
    const make = (done) => {
      const i = k++; const [lf, lt] = LANGS[i % LANGS.length]
      const title = shape.type === 'jasa_lain' ? JASA[i % JASA.length] : DOCS[i % DOCS.length]
      const time = TIMES[i % TIMES.length]
      const at = new Date(now.getTime() - (3 + (i % 5)) * 3600e3).toISOString()
      const sub = {
        id: `pd-s-${today}-${i}`, type: shape.type, flow: shape.flow, stage: done ? 'selesai' : shape.active, title, description: `1. ${title}`,
        file_count: 1, pages: 1 + (i % 6), lang_from: shape.type === 'terjemahan' ? lf : '', lang_to: shape.type === 'terjemahan' ? lt : '',
        docs: shape.type === 'terjemahan' ? [{ desc: title, pages: 1 + (i % 6), kind: i % 3 === 0 ? 'non_reguler' : 'reguler' }] : undefined,
        translator: shape.data.translator || (shape.vendor ? vendor?.id : ''), translator_kind: shape.vendor ? 'vendor' : 'translator', ...(shape.vendor ? { executor_kind: 'vendor', executor_id: vendor?.id } : {}),
        data: { ...shape.data, ...(shape.type === 'terjemahan' && shape.flow === 'tr_int' ? { dokumen_sumber: DEMO_PDF(`contoh-${i + 1}-sumber.pdf`), ...(shape.active !== 'penerjemahan' && shape.active !== 'pilih_penerjemah' ? { hasil_terjemahan: DEMO_PDF(`contoh-${i + 1}-terjemahan.pdf`) } : {}) } : {}), ...(done ? { ...(shape.doneData || {}), done_demo_at: at } : {}) },
        history: [{ at, by: 'Sistem (contoh)', action: 'Dibuat' }, ...(done ? [{ at, by: u.name, action: 'Selesai (contoh)' }] : [])],
      }
      m.projects.push({
        id: `pd-${today}-${i}`, invoice_no: `TGS-${today.slice(5).replace('-', '')}${String(i + 1).padStart(3, '0')}`, branch: u.branch || 'Bali',
        customer: { zoho_id: null, name: `Pelanggan Contoh ${i + 1}`, email: '', phone: '', city: '' },
        about: { deadline: today, deadline_time: time, priority: PRIO[i % PRIO.length], received_at: today, print_location: u.branch || 'Bali', cs_name: u.name },
        sub_projects: [sub], created_by: shape.mine ? u.id : 'u-sistem', created_at: at, demo_perf: true,
      })
    }
    for (let j = 0; j < plan.a; j++) make(true)
    for (let j = 0; j < plan.b; j++) make(false)
  })
  m.perf_demo_day = today
  return true
}
