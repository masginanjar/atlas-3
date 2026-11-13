import { useMemo, useState } from 'react'
import { Play, Check, Flag, Loader2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { branchesOf } from '../config/access.js'
import { flowOf, stagesOf, stageLabel } from '../config/workflows.js'
import { Button, Card, cx } from './ui.jsx'
import { ROLES, roleLabel } from '../config/access.js'

// ============================================================
//  CENTANG PROGRES APOSTILLE — langsung dari daftar (List & Tabel),
//  supaya staf apostille Jakarta bisa kerja cepat tanpa membuka detail.
//  · Belum diproses → ▶ Mulai
//  · Sedang diproses → bulatan per langkah (sekali klik tersimpan, klik lagi batal)
//  · Semua langkah wajib tercentang → 🏁 Selesai (membuka detail untuk unggah hasil)
//  Langkah yang butuh isian/berkas (mis. Bayar Pajak, Scan) membuka halaman detail.
//  Yang bisa mencentang: Staf Apostille cabang Jakarta (tugasnya sendiri / belum
//  dipegang siapa pun), Direktur, Superadmin. Peran lain hanya melihat progres.
// ============================================================

const PIMPINAN = ['superadmin', 'direktur', 'supervisor']
const SINGKAT = { Permohonan: 'Mohon', Ditunda: 'Tunda', Verifikasi: 'Verif', 'Bayar Pajak': 'Pajak', Cetak: 'Cetak', Scan: 'Scan' }

/** Info alur apostille untuk sub ini — null bila bukan sub dengan ceklist proses. */
function infoAlur(sb, p) {
  const stages = stagesOf(flowOf(sb, p))
  const proses = stages.find((st) => st.fields?.some((f) => f.type === 'checklist' && f.key === 'proses_checklist'))
  if (!proses) return null
  const f = proses.fields.find((x) => x.key === 'proses_checklist')
  const idx = stages.findIndex((st) => st.key === sb.stage)
  const idxProses = stages.indexOf(proses)
  return { stages, proses, f, sebelum: idx === idxProses - 1, sedang: idx === idxProses }
}

/** Pengaturan siapa yang melihat tahapan centang Apostille/Legalisasi di daftar project.
 *  Superadmin selalu. Bawaan: Direktur, Supervisor, dan Khrisna. Disimpan di app_settings 'akses_apostille'. */
export function aksesApostille(data) {
  const row = (data?.app_settings || []).find((r) => r.key === 'akses_apostille')
  if (row) return { roles: row.roles || [], users: row.users || [] }
  const khrisna = (data?.users || []).find((u) => /^khrisna/i.test(u.name || ''))
  return { roles: ['direktur', 'supervisor'], users: khrisna ? [khrisna.id] : [] }
}
export const lihatTahapApostille = (user, data) => {
  if ((user?.base_role || user?.role) === 'superadmin') return true
  const a = aksesApostille(data)
  return a.roles.includes(user?.role) || a.users.includes(user?.id)
}

export function bolehCentang(user, sb) {
  if (PIMPINAN.includes(user?.role)) return true
  const staf = user?.role === 'staf_apostille' || (user?.extra_roles || []).includes('staf_apostille')
  if (!staf || !branchesOf(user).includes('Jakarta')) return false
  const pemegang = sb.data?.staff_apostille || sb.data?.started_by
  return !pemegang || pemegang === user.id
}

/** Dipakai di kolom Tahap. Bila bukan apostille dengan ceklist, kembalikan label tahap biasa. */
export default function CentangApostille({ p, sb, label, bulat, onPanel }) {
  const { user, data, processStage, patchSubData, notify } = useApp()
  const [sibuk, setSibuk] = useState('')
  const info = infoAlur(sb, p)
  const teks = label ?? stageLabel(flowOf(sb, p), sb.stage)
  if (!info || (!info.sebelum && !info.sedang) || !lihatTahapApostille(user, data)) return <span className="text-brand">{teks}</span>
  const boleh = bolehCentang(user, sb)
  const stop = (e) => e.stopPropagation()

  if (info.sebelum) {
    if (!boleh) return <span className="text-brand">{teks}</span>
    const mulai = async (e) => {
      stop(e); setSibuk('mulai')
      try { await processStage(p, sb.id, {}, true); notify(`${sb.title}: mulai diproses`) } catch (er) { notify(er.message, 'err') } finally { setSibuk('') }
    }
    return (
      <button type="button" onClick={mulai} disabled={!!sibuk} data-aksi="apostille-mulai"
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-[11px] font-bold text-white hover:bg-brand-dark disabled:opacity-60">
        {sibuk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Mulai
      </button>
    )
  }

  const { f } = info
  const cur = Array.isArray(sb.data?.[f.key]) ? sb.data[f.key] : []
  const items = (f.items || []).filter((it) => !f.itemRoles?.[it] || f.itemRoles[it].includes(user.role))
  const wajibSemua = (f.items || []).filter((it) => !(f.opsional || []).includes(it))
  const lengkap = wajibSemua.every((it) => cur.includes(it))
  const toggle = async (e, it) => {
    stop(e)
    if (!boleh) return
    if (!cur.includes(it) && f.itemForm?.[it]?.length) { if (onPanel) onPanel(); else go(`projects/${p.id}`); return } // butuh isian/berkas
    const n = cur.includes(it) ? cur.filter((x) => x !== it) : [...cur, it]
    setSibuk(it)
    try { await patchSubData(p, sb.id, { [f.key]: n }, `${cur.includes(it) ? 'Batal centang' : 'Centang'} ${it} (${f.label})`) }
    catch (er) { notify(er.message, 'err') } finally { setSibuk('') }
  }
  if (bulat) return (
    <span className="inline-flex items-center gap-1" onClick={stop} role="group" aria-label="Langkah proses" data-centang-apostille={sb.id}>
      {items.map((it) => {
        const on = cur.includes(it)
        return (
          <button key={it} type="button" onClick={(e) => toggle(e, it)} disabled={!boleh || !!sibuk} aria-pressed={on} aria-label={it} title={`${it}${(f.opsional || []).includes(it) ? ' (opsional)' : ''}`} data-centang={it}
            className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[12px] font-bold transition', on ? 'border-[#141B34] bg-[#141B34] text-white' : 'border-[#D9DBE7] bg-white text-[#141B34]', boleh && !on && 'hover:border-[#4169E1]', !boleh && 'cursor-default')}>
            {sibuk === it ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? '✓' : it[0]}
          </button>
        )
      })}
    </span>
  )
  return (
    <span className="inline-flex flex-wrap items-center gap-1" onClick={stop} data-centang-apostille={sb.id}>
      {items.map((it) => {
        const on = cur.includes(it)
        const opsi = (f.opsional || []).includes(it)
        return (
          <button key={it} type="button" onClick={(e) => toggle(e, it)} disabled={!boleh || !!sibuk} aria-pressed={on} title={`${it}${opsi ? ' (opsional)' : ''}${f.itemForm?.[it]?.length && !on ? ' — butuh isian/berkas, buka panel kerja' : ''}`}
            data-centang={it}
            className={cx('inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10.5px] font-bold ring-1 transition',
              on ? 'bg-emerald-500 text-white ring-emerald-500' : opsi ? 'bg-white text-ink-mute ring-slate-200' : 'bg-white text-ink-soft ring-slate-300',
              boleh && !on && 'hover:ring-brand hover:text-brand', !boleh && 'cursor-default')}>
            {sibuk === it ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <Check className="h-3 w-3" /> : <span className="h-2.5 w-2.5 rounded-full ring-1 ring-current" />}
            {SINGKAT[it] || it}
          </button>
        )
      })}
      {boleh && (
        <button type="button" onClick={(e) => { stop(e); if (onPanel) onPanel(); else go(`projects/${p.id}`) }} title={lengkap ? 'Semua langkah selesai — unggah hasil lalu Selesai' : 'Buka panel kerja untuk unggah hasil & selesaikan'}
          data-aksi="apostille-selesai"
          className={cx('inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10.5px] font-bold ring-1', lengkap ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-mute ring-slate-200')}>
          <Flag className="h-3 w-3" />Selesai
        </button>
      )}
    </span>
  )
}

/** Pengaturan (Superadmin): siapa yang melihat & mengerjakan tahapan Apostille/Legalisasi dari daftar project. */
export function AksesApostilleSettings() {
  const { data, save, notify } = useApp()
  const awal = useMemo(() => aksesApostille(data), [data])
  const [roles, setRoles] = useState(awal.roles)
  const [users, setUsers] = useState(awal.users)
  const [sibuk, setSibuk] = useState(false)
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const orang = (data.users || []).filter((u) => u.active !== false && u.role !== 'superadmin').sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const simpan = async () => {
    setSibuk(true)
    try {
      const row = (data.app_settings || []).find((r) => r.key === 'akses_apostille')
      await save('app_settings', { ...(row || {}), key: 'akses_apostille', roles, users })
      notify('Akses tahapan Apostille disimpan')
    } catch (e) { notify(e.message, 'err') } finally { setSibuk(false) }
  }
  const chip = (on) => cx('h-9 rounded-lg px-3 text-[12px] font-semibold ring-1', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-slate-300')
  return (
    <Card className="space-y-4 p-4 sm:p-5" data-akses-apostille>
      <div>
        <h2 className="text-sm font-bold">Tahapan Apostille &amp; Legalisasi</h2>
        <p className="mt-0.5 text-xs text-ink-mute">Siapa yang melihat centang progres (Mohon · Tunda · Verif · Cetak · Scan) di rincian project, tampilan List maupun Tabel. Superadmin selalu bisa. Orang lain hanya melihat nama tahapnya.</p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold text-ink-soft">Per peran</p>
        <div className="flex flex-wrap gap-1.5">{Object.entries(ROLES).filter(([k]) => k !== 'superadmin').map(([k, r]) => <button key={k} type="button" onClick={() => toggle(roles, setRoles, k)} className={chip(roles.includes(k))}>{k === 'supervisor' ? 'Supervisor' : r.label}</button>)}</div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold text-ink-soft">Per orang</p>
        <div className="flex flex-wrap gap-1.5">{orang.map((u) => <button key={u.id} type="button" onClick={() => toggle(users, setUsers, u.id)} className={chip(users.includes(u.id))} title={roleLabel(u)}>{u.name}</button>)}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={simpan} loading={sibuk} data-aksi="simpan-akses-apostille">Simpan</Button>
        <button type="button" onClick={() => { const b = aksesApostille({ users: data.users }); setRoles(b.roles); setUsers(b.users) }} className="text-xs font-semibold text-ink-mute hover:underline">Kembalikan bawaan (Direktur, Supervisor, Khrisna)</button>
      </div>
      <p className="text-[11px] text-ink-mute">Yang bisa mencentang tetap dibatasi: Staf Apostille Jakarta untuk tugasnya sendiri, Direktur, Supervisor, dan Superadmin.</p>
    </Card>
  )
}
