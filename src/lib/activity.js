// ============================================================
//  RIWAYAT AKTIVITAS
//  1) activity_log  : dicatat otomatis saat data disimpan/dihapus (project, file, vendor, pengguna, setting…)
//  2) digabung dengan riwayat yang sudah ada: tahap sub project, pengajuan umum, petty cash,
//     tagihan vendor & saldo sumber dana — tanpa duplikasi.
// ============================================================
import { rupiah } from './format.js'

// Tabel yang tidak dicatat di activity_log (sudah punya riwayat sendiri / teknis)
const SKIP = new Set(['activity_log', 'perf_daily', 'notifications', 'pings', 'share_log', 'requests', 'petty_cash', 'vendor_bills', 'fund_balances'])
const ABOUT_LABEL = { deadline: 'deadline', deadline_time: 'jam deadline', priority: 'prioritas', courier: 'kurir', resi_no: 'no. resi', resi_photo: 'foto resi', print_location: 'lokasi print', received_at: 'tanggal masuk', cs_name: 'CS', notes: 'catatan' }
const PERSON = { vendor: 'vendor', customer: 'pelanggan', translator: 'penerjemah' }
const names = (arr) => arr.slice(0, 3).map((f) => f.name).join(', ') + (arr.length > 3 ? ` +${arr.length - 3}` : '')

/** Ringkasan perubahan untuk dicatat; null = tidak perlu dicatat. */
export function describe(t, prev, row, op = prev ? 'update' : 'insert') {
  if (SKIP.has(t)) return null
  if (t === 'projects') {
    const base = { project_id: row?.id || prev?.id, ref_label: row?.invoice_no || prev?.invoice_no, kind: 'project' }
    if (op === 'remove') return { ...base, action: `Menghapus project ${prev?.invoice_no || ''}` }
    if (op === 'insert') return { ...base, action: `Membuat project ${row.invoice_no} (${(row.sub_projects || []).length} sub project)` }
    const out = []
    const pf = prev.files || []; const nf = row.files || []
    const pid = new Set(pf.map((f) => f.id)); const nid = new Set(nf.map((f) => f.id))
    const added = nf.filter((f) => !pid.has(f.id)); const removed = pf.filter((f) => !nid.has(f.id))
    if (added.length) out.push(`Upload ${added.length} file: ${names(added)}`)
    if (removed.length) out.push(`Menghapus ${removed.length} file: ${names(removed)}`)
    const renamed = nf.filter((f) => { const o = pf.find((x) => x.id === f.id); return o && o.name !== f.name })
    renamed.forEach((f) => out.push(`Ganti nama file ${pf.find((x) => x.id === f.id).name} → ${f.name}`))
    const keys = [...new Set([...Object.keys(prev.about || {}), ...Object.keys(row.about || {})])].filter((k) => JSON.stringify(prev.about?.[k] ?? '') !== JSON.stringify(row.about?.[k] ?? ''))
    if (keys.length) out.push(`Mengubah ${keys.map((k) => ABOUT_LABEL[k] || k).join(', ')}`)
    if (JSON.stringify(prev.customer || {}) !== JSON.stringify(row.customer || {})) out.push('Mengubah data pelanggan')
    const ps = prev.sub_projects || []; const ns = row.sub_projects || []
    const subAdd = ns.filter((s) => !ps.some((x) => x.id === s.id)); const subDel = ps.filter((s) => !ns.some((x) => x.id === s.id))
    if (subAdd.length) out.push(`Menambah sub project: ${subAdd.map((s) => s.title).join(', ')}`)
    if (subDel.length) out.push(`Menghapus sub project: ${subDel.map((s) => s.title).join(', ')}`)
    // file di tahap yang diubah tanpa catatan riwayat tahap (mis. hapus/ganti nama dari File Project)
    if (!out.length && ns.some((s) => { const o = ps.find((x) => x.id === s.id); return o && JSON.stringify(o.data) !== JSON.stringify(s.data) && (s.history || []).length === (o.history || []).length })) out.push('Mengubah file / data sub project')
    if (row.cancelled !== prev.cancelled) out.push(row.cancelled ? 'Membatalkan project' : 'Mengaktifkan kembali project')
    return out.length ? { ...base, action: out.join(' · ') } : null
  }
  const r = row || prev || {}
  const label = r.name || r.email || r.key || r.code || r.id
  const what = t === 'people' ? (PERSON[r.type] || 'kontak') : t === 'users' ? 'pengguna' : t === 'couriers' ? 'kurir' : t === 'app_settings' ? 'pengaturan' : t === 'share_links' ? 'tautan bagikan' : t
  const verb = op === 'remove' ? 'Menghapus' : op === 'insert' ? 'Menambah' : 'Mengubah'
  if (t === 'users' && op === 'update' && prev && row && (prev.avatar || null) !== (row.avatar || null)) return { kind: 'setting', ref_label: label, action: `${row.avatar ? 'Mengganti' : 'Menghapus'} foto profil ${label}` }
  if (t === 'users' && op === 'update' && prev && row && prev.active !== row.active) return { kind: 'setting', ref_label: label, action: `${row.active === false ? 'Menonaktifkan' : 'Mengaktifkan'} pengguna ${label}` }
  return { kind: t === 'share_links' ? 'project' : 'setting', project_id: r.project_id, ref_label: label, action: `${verb} ${what} ${label}` }
}

const KIND_LABEL = { project: 'Project', stage: 'Alur kerja', finance: 'Keuangan', petty: 'Petty cash', setting: 'Pengaturan' }
export const ACTIVITY_KINDS = KIND_LABEL

/** Semua aktivitas, terbaru di atas. */
export function allActivities(data) {
  const out = []
  const userByName = new Map((data.users || []).map((u) => [u.name, u]))
  const push = (x) => x.at && out.push({ ...x, role: x.role || userByName.get(x.by)?.role || '' })
  for (const a of data.activity_log || []) push({ id: a.id, at: a.created_at, by: a.by, role: a.role, action: a.action, kind: a.kind || 'setting', project_id: a.project_id, ref: a.ref_label })
  for (const p of data.projects || []) {
    if (p.archive || p.demo_perf) continue
    for (const s of p.sub_projects || []) (s.history || []).forEach((h, i) => push({ id: `h:${s.id}:${i}`, at: h.at, by: h.by, action: h.action, kind: 'stage', project_id: p.id, ref: p.invoice_no, sub: s.title }))
  }
  for (const r of data.requests || []) (r.history || []).forEach((h, i) => push({ id: `r:${r.id}:${i}`, at: h.at, by: h.by, action: `Pengajuan umum ${rupiah(r.amount)} — ${h.action}`, kind: 'finance', ref: r.title || r.note || r.kind }))
  for (const c of data.petty_cash || []) push({ id: `pc:${c.id}`, at: c.created_at, by: c.by, action: `${c.type === 'in' ? 'Top up' : 'Pengeluaran'} ${rupiah(c.amount)} — ${c.note}${c.nota ? ' (nota)' : ''}`, kind: 'petty', project_id: c.project_id, ref: c.branch })
  for (const b of data.vendor_bills || []) {
    const v = (data.people || []).find((x) => x.id === b.vendor_id)?.name || 'vendor'
    push({ id: `vb:${b.id}:c`, at: b.created_at, by: b.created_name, action: `Membuat tagihan ${v} ${rupiah(b.total)} (${b.items?.length || 0} order)`, kind: 'finance', ref: v })
    if (b.approved_at) push({ id: `vb:${b.id}:a`, at: b.approved_at, by: b.approved_name, action: `ACC tagihan ${v} ${rupiah(b.total)} · dana ${b.sumber_dana}`, kind: 'finance', ref: v })
    if (b.rejected_at) push({ id: `vb:${b.id}:r`, at: b.rejected_at, by: b.rejected_name, action: `Menolak tagihan ${v}: ${b.rejected_reason || ''}`, kind: 'finance', ref: v })
    if (b.paid_at) push({ id: `vb:${b.id}:p`, at: b.paid_at, by: b.paid_name, action: `Membayar tagihan ${v} ${rupiah(b.total)}`, kind: 'finance', ref: v })
  }
  for (const f of data.fund_balances || []) push({ id: `fb:${f.id}`, at: f.created_at, by: f.by, action: `Memperbarui saldo ${f.code} → ${rupiah(f.balance)}`, kind: 'finance', ref: f.code })
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

/** Aktivitas satu project (tahap, file, edit, petty cash & tagihan terkait). */
export function projectActivities(data, project) {
  const subIds = new Set((project.sub_projects || []).map((s) => s.id))
  const bills = (data.vendor_bills || []).filter((b) => b.items?.some((it) => it.project_id === project.id || subIds.has(it.sub_id))).map((b) => `vb:${b.id}:`)
  const own = allActivities({ ...data, projects: [{ ...project, archive: false, demo_perf: false }] })
  return own.filter((a) => a.project_id === project.id || bills.some((p) => String(a.id).startsWith(p)))
}
