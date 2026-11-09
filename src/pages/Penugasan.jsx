import { useMemo, useState } from 'react'
import { Users, Lock, Plane, Check, AlertTriangle, ChevronRight, MoreHorizontal, Gauge, Building2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Empty, Button, Sheet, cx } from '../components/ui.jsx'
import { useDashStats, halamanSub } from './Dashboard.jsx'
import { rolesOf, branchesOf, placeOf, foreignLang, coordinatorFor, invoiceLabel, BRANCHES } from '../config/access.js'
import { flowOf } from '../config/workflows.js'
import { kapasitasHarian, KapasitasAcc } from '../components/Kapasitas.jsx'
import { PilihPeriode, hariIni, tambahHari } from '../components/ToolbarRingkas.jsx'
import { indeksJadwal, yangLibur } from '../lib/jadwal.js'
import { PriorityBadge } from '../components/Priority.jsx'
import { InvoiceNo } from '../components/badges.jsx'
import Avatar from '../components/Avatar.jsx'
import { daysLeft, tgl } from '../lib/format.js'
import { go } from '../lib/router.js'

// ============================================================
//  PENUGASAN — kapasitas penerjemah sebagai acuan.
//  HP: 2 tab (Perlu penerjemah | Kapasitas), tiap dokumen punya "Saran"
//  + tombol Tugaskan sekali ketuk; pilih manual lewat lembar bawah.
//  PC: KPI → kiri antrean, kanan papan kapasitas; klik baris kiri →
//  papan kanan menandai siapa yang muat & bisa bahasanya.
// ============================================================

export const canSeePenugasan = (u) => rolesOf(u).some((r) => ['superadmin', 'supervisor', 'direktur'].includes(r))

const PERIODE_PENUGASAN = (t = hariIni()) => [
  ['Saat ini', { from: '', to: '' }],
  ['Hari ini', { from: t, to: t }],
  ['s/d Besok', { from: t, to: tambahHari(t, 1) }],
  ['7 hari', { from: t, to: tambahHari(t, 6) }],
  ['30 hari', { from: t, to: tambahHari(t, 29) }],
]

const KODE = { Indonesia: 'ID', Inggris: 'EN', Belanda: 'NL', Jepang: 'JP', Mandarin: 'ZH', Korea: 'KR', Jerman: 'DE', Prancis: 'FR', Arab: 'AR' }
const kode = (l) => KODE[l] || (l ? String(l).slice(0, 2).toUpperCase() : '?')
const arahSub = (s) => `${kode(s.lang_from)} → ${kode(s.lang_to)}`
const pasanganKey = (s) => `${s.lang_from}>${s.lang_to}`

/** Warna beban: hijau < 70 %, kuning 70–100 %, merah lebih. */
const nada = (pakai, kap) => (pakai >= kap ? 'rd' : pakai >= kap * 0.7 ? 'y' : 'g')
const NADA = {
  g: { bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700', txt: 'text-emerald-700' },
  y: { bar: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800', txt: 'text-amber-800' },
  rd: { bar: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700', txt: 'text-rose-700' },
  sk: { bar: 'bg-slate-300', pill: 'bg-slate-100 text-slate-500', txt: 'text-slate-500' },
}

function DeadlineKecil({ iso, className }) {
  if (!iso) return <span className={cx('text-xs text-ink-mute', className)}>Tanpa deadline</span>
  const d = daysLeft(iso); const t = new Date(iso)
  const jamS = t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const utama = d < 0 ? `Lewat ${Math.abs(d)} hr` : d === 0 ? `Hari ini ${jamS}` : d === 1 ? `Besok ${jamS}` : tgl(iso)
  const sub = d < 0 ? tgl(iso) : d <= 1 ? tgl(iso) : `${d} hari lagi`
  return (
    <span className={cx('block text-right leading-tight', className)}>
      <span className={cx('block text-xs font-bold', d < 0 ? 'text-rose-600' : d === 0 ? 'text-rose-600' : d <= 2 ? 'text-orange-600' : 'text-ink')}>{utama}</span>
      <span className={cx('block text-[10.5px]', d <= 0 ? 'text-rose-500' : 'text-ink-mute')}>{sub}</span>
    </span>
  )
}

export default function Penugasan() {
  const { user, data, assignTranslator, notify, branchFilter } = useApp()
  const s = useDashStats()
  const [range, setRange] = useState({ from: '', to: '' })
  const [tab, setTab] = useState('perlu')
  const [chip, setChip] = useState('semua')
  const [pilih, setPilih] = useState(null)     // sub id yang sedang dipilih (PC: tandai papan kanan)
  const [sheet, setSheet] = useState(null)     // sub yang dibuka di lembar bawah (HP)
  const [sibuk, setSibuk] = useState({})
  const today = hariIni()
  const ranged = !!(range.from || range.to)
  const dalamRange = (dl) => { if (!ranged) return true; if (!dl) return false; const day = String(dl).slice(0, 10); return (!range.from || day >= range.from) && (!range.to || day <= range.to) }

  // ---------- penerjemah & beban ----------
  const translators = useMemo(() => data.users.filter((u) => u.role === 'penerjemah' && u.active !== false), [data.users])
  const vendors = useMemo(() => data.people.filter((p) => p.type === 'vendor'), [data.people])
  const peta = useMemo(() => indeksJadwal(data.jadwal), [data.jadwal])
  const liburIds = useMemo(() => {
    const hari = range.from || today
    const set = new Set()
    for (const cb of BRANCHES) for (const r of yangLibur(peta, hari, cb)) set.add(r.user_id)
    return set
  }, [peta, range.from, today])
  const beban = useMemo(() => {
    const pakai = {}, dok = {}, dekat = {}, pernah = {}
    for (const p of data.projects) for (const x of p.sub_projects || []) {
      const uid = x.data?.translator; if (!uid) continue
      if (x.lang_from && x.lang_to) (pernah[pasanganKey(x)] ||= new Set()).add(uid)
      if (x.stage !== 'penerjemahan' || !dalamRange(p.about?.deadline)) continue
      pakai[uid] = (pakai[uid] || 0) + halamanSub(x, flowOf(x, p))
      dok[uid] = (dok[uid] || 0) + 1
      const dl = p.about?.deadline
      if (dl && (!dekat[uid] || dl < dekat[uid])) dekat[uid] = dl
    }
    return { pakai, dok, dekat, pernah }
  }, [data.projects, range.from, range.to, ranged]) // eslint-disable-line react-hooks/exhaustive-deps

  const barisTr = useMemo(() => translators.map((u) => {
    const kap = kapasitasHarian(u, data.kapasitas)
    const pakai = beban.pakai[u.id] || 0
    const libur = liburIds.has(u.id)
    const sisa = kap - pakai
    const bahasa = [...new Set(Object.entries(beban.pernah).filter(([, set]) => set.has(u.id)).map(([k]) => k.split('>').map(kode)).flat().filter((k) => k !== 'ID'))]
    const ajuan = (data.kapasitas || []).find((k) => k.user_id === u.id && k.status === 'diajukan')
    return { u, kap, pakai, sisa, libur, n: beban.dok[u.id] || 0, dekat: beban.dekat[u.id], bahasa, ajuan, tone: libur ? 'sk' : nada(pakai, kap) }
  }).sort((a, b) => (a.libur - b.libur) || (b.sisa - a.sisa) || a.u.name.localeCompare(b.u.name)), [translators, data.kapasitas, beban, liburIds])
  const byId = useMemo(() => Object.fromEntries(barisTr.map((r) => [r.u.id, r])), [barisTr])

  // ---------- antrean perlu penerjemah ----------
  const rowsAll = useMemo(() => s.needTr.filter((r) => dalamRange(r.project.about?.deadline)), [s.needTr, range.from, range.to, ranged]) // eslint-disable-line react-hooks/exhaustive-deps
  const hlmSub = (r) => halamanSub(r, r.flow || flowOf(r, r.project))
  const bisaPasangan = (tr, r) => (beban.pernah[pasanganKey(r)] || new Set()).has(tr.u.id)
  /** Kandidat untuk satu dokumen, urut: muat & pernah bahasa itu → muat → tidak muat → libur. */
  const kandidat = (r) => {
    const h = hlmSub(r)
    return barisTr.map((t) => ({ ...t, muat: !t.libur && t.sisa >= h, cocok: bisaPasangan(t, r) }))
      .sort((a, b) => (a.libur - b.libur) || (b.muat - a.muat) || (b.cocok - a.cocok) || (b.sisa - a.sisa) || a.u.name.localeCompare(b.u.name))
  }
  const saranOf = (r) => {
    const coord = coordinatorFor(data.users, foreignLang(r))
    if (coord) return { kind: 'coord', id: coord.id, nama: coord.name, ket: `Koordinator ${coord.coordinator_lang}`, ok: true }
    const k = kandidat(r)[0]
    if (!k) return null
    if (!k.muat) return { kind: 'internal', id: k.u.id, nama: k.u.name, ket: k.libur ? 'semua libur' : `sisa ${k.sisa} hlm`, ok: false }
    return { kind: 'internal', id: k.u.id, nama: k.u.name, ket: `sisa ${k.sisa} hlm · ${k.pakai} hlm dipegang${k.cocok ? '' : ' · belum pernah pasangan ini'}`, ok: true }
  }

  const rows = useMemo(() => {
    const d = (r) => daysLeft(r.project.about?.deadline)
    if (chip === 'terlambat') return rowsAll.filter((r) => d(r) !== null && d(r) < 0)
    if (chip === 'hariini') return rowsAll.filter((r) => d(r) !== null && d(r) <= 0)
    if (chip === 'prioritas') return rowsAll.filter((r) => (r.project.about?.priority || 'Normal') !== 'Normal')
    if (chip === 'nl') return rowsAll.filter((r) => [r.lang_from, r.lang_to].includes('Belanda'))
    if (chip === 'en') return rowsAll.filter((r) => [r.lang_from, r.lang_to].includes('Inggris'))
    return rowsAll
  }, [rowsAll, chip])
  const nTerlambat = rowsAll.filter((r) => { const d = daysLeft(r.project.about?.deadline); return d !== null && d < 0 }).length
  const nHariIni = rowsAll.filter((r) => { const d = daysLeft(r.project.about?.deadline); return d !== null && d <= 0 }).length
  const nPrio = rowsAll.filter((r) => (r.project.about?.priority || 'Normal') !== 'Normal').length
  const nNl = rowsAll.filter((r) => [r.lang_from, r.lang_to].includes('Belanda')).length
  const nEn = rowsAll.filter((r) => [r.lang_from, r.lang_to].includes('Inggris')).length

  // ---------- KPI ----------
  const aktif = barisTr.filter((t) => !t.libur)
  const kapTotal = aktif.reduce((a, t) => a + t.kap, 0)
  const pakaiTotal = aktif.reduce((a, t) => a + t.pakai, 0)
  const sisaTotal = aktif.reduce((a, t) => a + Math.max(0, t.sisa), 0)
  const hlmPerlu = rowsAll.reduce((a, r) => a + hlmSub(r), 0)
  const penuh = barisTr.filter((t) => !t.libur && t.tone !== 'g')
  const libur = barisTr.filter((t) => t.libur)
  const muatBerapa = (() => { let sisa = sisaTotal, n = 0; for (const r of [...rowsAll].sort((a, b) => hlmSub(a) - hlmSub(b))) { if (hlmSub(r) <= sisa) { sisa -= hlmSub(r); n++ } } return n })()
  const nSaran = rowsAll.filter((r) => saranOf(r)?.ok).length
  const ajuan = (data.kapasitas || []).filter((k) => k.status === 'diajukan')

  // ---------- aksi ----------
  const tugaskan = async (r, kind, id) => {
    if (!id) return notify('Pilih penerjemah dulu', 'err')
    setSibuk((m) => ({ ...m, [r.id]: true }))
    try {
      await assignTranslator(r.project, r.id, { kind, id, service: null })
      const nama = kind === 'vendor' ? vendors.find((v) => v.id === id)?.name : data.users.find((u) => u.id === id)?.name
      notify(`${invoiceLabel(r.project.invoice_no)} → ${nama}`)
      setSheet(null); if (pilih === r.id) setPilih(null)
    } catch (e) { notify(e.message, 'err') }
    setSibuk((m) => ({ ...m, [r.id]: false }))
  }
  const tugaskanSemua = async () => {
    const daftar = rowsAll.map((r) => [r, saranOf(r)]).filter(([, s]) => s?.ok)
    if (!daftar.length) return
    let n = 0
    for (const [r, sr] of daftar) { try { await assignTranslator(r.project, r.id, { kind: sr.kind, id: sr.id, service: null }); n++ } catch { /* lanjut */ } }
    notify(`${n} dokumen ditugaskan sesuai saran`)
  }

  if (!canSeePenugasan(user)) {
    return <div className="p-4"><Card><Empty icon={Lock} title="Halaman Penugasan hanya untuk Superadmin & Direktur" /></Card></div>
  }

  const terpilih = pilih ? rowsAll.find((r) => r.id === pilih) : null
  const kandidatPilih = terpilih ? kandidat(terpilih) : null

  // ====================== RENDER ======================
  return (
    <div className="space-y-3">
      {/* judul + periode */}
      <div className="flex items-center gap-2" data-alat>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><Users className="h-5 w-5 text-ink-mute" />Penugasan</h1>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200" data-perlu-n>{rowsAll.length} perlu penerjemah</span>
        <div className="ml-auto"><PilihPeriode range={range} setRange={setRange} pilihan={PERIODE_PENUGASAN()} label="Deadline" /></div>
      </div>

      {/* HP: tab bersegmen */}
      <div className="flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 lg:hidden" role="tablist" data-tab-penugasan>
        {[['perlu', 'Perlu penerjemah', rowsAll.length], ['kapasitas', 'Kapasitas', translators.length]].map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx('flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition', tab === k ? 'bg-white text-ink shadow-sm ring-1 ring-slate-200' : 'text-ink-soft')}>
            {l}<span className={cx('rounded-full px-1.5 text-[10px] font-bold', tab === k ? 'bg-ink text-white' : 'bg-slate-200 text-ink-soft')}>{n}</span>
          </button>
        ))}
      </div>

      {/* PC: KPI */}
      <div className="hidden gap-2.5 lg:grid lg:grid-cols-5" data-kpi-penugasan>
        <Kpi k="Perlu penerjemah" v={rowsAll.length} tone="text-rose-700" s={`${hlmPerlu} hlm${nTerlambat ? ` · ${nTerlambat} lewat deadline` : ''}`} />
        <Kpi k={`Kapasitas tim ${ranged ? 'periode ini' : 'hari ini'}`} v={<>{pakaiTotal} <span className="text-sm font-semibold text-ink-mute">/ {kapTotal} hlm</span></>}
          s="biru terpakai · kuning perlu orang" bar={[[Math.min(100, kapTotal ? (pakaiTotal / kapTotal) * 100 : 0), 'bg-brand'], [Math.min(100 - Math.min(100, kapTotal ? (pakaiTotal / kapTotal) * 100 : 0), kapTotal ? (hlmPerlu / kapTotal) * 100 : 0), 'bg-amber-400']]} />
        <Kpi k="Sisa kosong" v={`${sisaTotal} hlm`} tone="text-emerald-700" s={rowsAll.length ? `cukup untuk ${muatBerapa} dari ${rowsAll.length} dokumen` : 'tidak ada antrean'} />
        <Kpi k="Hampir penuh / lebih" v={penuh.length} tone="text-amber-800" s={penuh.map((t) => `${t.u.name.split(' ')[0]} ${t.pakai}/${t.kap}`).join(' · ') || 'semua masih longgar'} />
        <Kpi k="Libur" v={libur.length} s={libur.map((t) => t.u.name.split(' ')[0]).join(', ') || 'tidak ada yang libur'} />
      </div>

      {/* HP: ringkasan kapasitas */}
      <Card className={cx('p-3 lg:hidden', tab !== 'perlu' && 'hidden')} data-ringkas-kapasitas>
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">Kapasitas tim {ranged ? 'periode ini' : 'hari ini'}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm text-ink-mute"><b className="text-2xl font-extrabold text-ink">{pakaiTotal}</b>hlm terpakai dari <b className="text-ink">{kapTotal}</b> · sisa <b className="text-emerald-700">{sisaTotal} hlm</b></p>
        <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-200">
          <span className="bg-brand" style={{ width: `${Math.min(100, kapTotal ? (pakaiTotal / kapTotal) * 100 : 0)}%` }} />
          <span className="bg-amber-400" style={{ width: `${Math.min(100, kapTotal ? (hlmPerlu / kapTotal) * 100 : 0)}%` }} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] font-semibold text-ink-mute">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand" />Terpakai {pakaiTotal}</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />Perlu {hlmPerlu} hlm (belum ada orang)</span>
          {libur.length > 0 && <span><Plane className="mr-0.5 inline h-3 w-3 text-rose-500" />{libur.length} libur</span>}
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ============ KIRI / tab Perlu ============ */}
        <div className={cx('min-w-0', tab !== 'perlu' && 'max-lg:hidden')}>
          <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] lg:hidden" data-chip-perlu>
            <Chip on={chip === 'semua'} onClick={() => setChip('semua')} n={rowsAll.length}>Semua</Chip>
            <Chip on={chip === 'terlambat'} onClick={() => setChip('terlambat')} n={nTerlambat}>Terlambat</Chip>
            <Chip on={chip === 'hariini'} onClick={() => setChip('hariini')} n={nHariIni}>Hari ini</Chip>
            <Chip on={chip === 'prioritas'} onClick={() => setChip('prioritas')} n={nPrio}>Prioritas</Chip>
            <Chip on={chip === 'en'} onClick={() => setChip('en')} n={nEn}>EN</Chip>
            <Chip on={chip === 'nl'} onClick={() => setChip('nl')} n={nNl}>NL</Chip>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="hidden items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2 lg:flex">
              <h2 className="mr-1 flex-1 text-[13px] font-extrabold">Perlu penerjemah</h2>
              <Chip on={chip === 'semua'} onClick={() => setChip('semua')} n={rowsAll.length}>Semua</Chip>
              <Chip on={chip === 'terlambat'} onClick={() => setChip('terlambat')} n={nTerlambat}>Terlambat</Chip>
              <Chip on={chip === 'hariini'} onClick={() => setChip('hariini')} n={nHariIni}>Hari ini</Chip>
              <Chip on={chip === 'prioritas'} onClick={() => setChip('prioritas')} n={nPrio}>Prioritas</Chip>
              <Chip on={chip === 'en'} onClick={() => setChip('en')} n={nEn}>EN</Chip>
              <Chip on={chip === 'nl'} onClick={() => setChip('nl')} n={nNl}>NL</Chip>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-mute">{rowsAll.length ? 'Tidak ada yang cocok dengan saringan ini.' : 'Semua dokumen sudah punya penerjemah. 🎉'}</p>
            ) : (
              <>
                {/* PC: tabel */}
                <table className="hidden w-full table-fixed text-[12.5px] lg:table" data-tabel-perlu>
                  <thead>
                    <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">
                      <th className="w-[30%] px-3 py-2">Invoice · Pelanggan</th><th className="px-2 py-2">Dokumen</th><th className="w-[13%] px-2 py-2">Arah</th><th className="w-[8%] px-2 py-2 text-center">Hlm</th><th className="w-[15%] px-2 py-2">Deadline</th><th className="w-[112px] px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const sel = pilih === r.id
                      return (
                        <tr key={r.id} onClick={() => setPilih(sel ? null : r.id)} data-baris-perlu={r.id}
                          className={cx('cursor-pointer border-t border-slate-100 align-middle', sel ? 'bg-brand-soft/60 shadow-[inset_3px_0_0_theme(colors.brand.DEFAULT)]' : i % 2 ? 'bg-slate-50/80' : 'bg-white', 'hover:bg-brand-soft/30')}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5"><InvoiceNo project={r.project} />{(r.project.about?.priority || 'Normal') !== 'Normal' && <PriorityBadge p={r.project.about?.priority} />}</div>
                            <p className="mt-0.5 truncate text-[11px] text-ink-mute">{r.project.customer?.name || '—'} · {r.project.branch}</p>
                          </td>
                          <td className="px-2 py-2 font-bold"><span className="line-clamp-2">{r.title}</span></td>
                          <td className="px-2 py-2"><Arah s={r} /></td>
                          <td className="px-2 py-2 text-center text-sm font-extrabold">{hlmSub(r)}</td>
                          <td className="px-2 py-2"><DeadlineKecil iso={r.project.about?.deadline} className="!text-left" /></td>
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => setPilih(r.id)}>Pilih…</Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* HP: kartu */}
                <ul className="lg:hidden" data-kartu-perlu>
                  {rows.map((r, i) => {
                    return (
                      <li key={r.id} className={cx('mx-2.5 my-2 rounded-2xl p-3 ring-1 ring-slate-300', i % 2 ? 'bg-slate-100' : 'bg-white')}>
                        <div className="flex items-center gap-1.5">
                          <InvoiceNo project={r.project} />{(r.project.about?.priority || 'Normal') !== 'Normal' && <PriorityBadge p={r.project.about?.priority} />}
                          <DeadlineKecil iso={r.project.about?.deadline} className="ml-auto" />
                        </div>
                        <p className="mt-1.5 truncate text-[13.5px] font-bold">{r.project.customer?.name || '—'} · {r.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-mute"><Arah s={r} /><span className="rounded-md bg-slate-200/70 px-1.5 py-px font-bold text-ink">{hlmSub(r)} hlm</span>· {r.project.branch}{r.data?.submitted_name ? ` · ${r.data.submitted_name}` : ''}</p>
                        <div className="mt-2 flex gap-1.5">
                          <Button variant="outline" className="h-11 flex-1" onClick={() => setSheet(r)}>Pilih penerjemah…</Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Card>
        </div>

        {/* ============ KANAN / tab Kapasitas ============ */}
        <div className={cx('min-w-0 space-y-3', tab !== 'kapasitas' && 'max-lg:hidden')}>
          <Card className="overflow-hidden p-0" data-papan-kapasitas>
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <Gauge className="h-4 w-4 text-brand" />
              <h2 className="flex-1 text-[13px] font-extrabold">Kapasitas penerjemah <span className="font-semibold text-ink-mute">· {ranged ? 'periode' : tgl(today)}</span></h2>
              <span className="text-[11px] font-semibold text-emerald-700">{sisaTotal} hlm kosong</span>
            </div>
            {terpilih && (
              <div className="m-3 rounded-xl bg-brand-soft/60 px-3 py-2 text-[11.5px] text-ink ring-1 ring-brand/30" data-dipilih>
                Dipilih: <b>{invoiceLabel(terpilih.project.invoice_no)} · {terpilih.title} · {arahSub(terpilih)} · {hlmSub(terpilih)} hlm</b>
                <button type="button" onClick={() => setPilih(null)} className="ml-2 font-bold text-brand hover:underline">batal</button>
                <span className="block text-ink-mute">Garis-garis hijau = beban kalau ditugaskan ke orang itu.</span>
              </div>
            )}
            <PapanKapasitas baris={kandidatPilih || barisTr} dipilih={terpilih} hlm={terpilih ? hlmSub(terpilih) : 0}
              onTugaskan={terpilih ? (t) => tugaskan(terpilih, 'internal', t.u.id) : null} sibuk={terpilih ? !!sibuk[terpilih.id] : false} />
            {ajuan.length > 0 && (
              <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
                <span className="flex-1"><b>{ajuan.length} pengajuan tambah kapasitas</b> menunggu: {ajuan.map((k) => `${String(k.nama || '').split(' ')[0]} ${k.dari ?? ''}→${k.ke}`).join(', ')}</span>
              </div>
            )}
          </Card>
          <KapasitasAcc />
        </div>
      </div>

      {/* HP: lembar pilih penerjemah */}
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet ? `Pilih penerjemah · ${hlmSub(sheet)} hlm · ${arahSub(sheet)}` : ''} subtitle={sheet ? `${invoiceLabel(sheet.project.invoice_no)} · ${sheet.title}` : ''}>
        {sheet && (
          <div className="-mx-5 -my-4">
            <p className="px-5 pt-3 text-xs text-ink-mute">Hijau = masih muat. Angka = terpakai / kapasitas harian.</p>
            <PapanKapasitas baris={kandidat(sheet)} dipilih={sheet} hlm={hlmSub(sheet)} onTugaskan={(t) => tugaskan(sheet, 'internal', t.u.id)} sibuk={!!sibuk[sheet.id]} besar />
            {vendors.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3">
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">Vendor / freelance eksternal</p>
                <div className="flex flex-wrap gap-1.5">
                  {vendors.slice(0, 8).map((v) => <button key={v.id} type="button" onClick={() => tugaskan(sheet, 'vendor', v.id)} className="h-9 rounded-xl bg-white px-3 text-xs font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">{v.name}</button>)}
                </div>
              </div>
            )}
            <div className="px-5 pb-4 pt-2"><button type="button" onClick={() => { setSheet(null); go(`projects/${sheet.project.id}`) }} className="text-xs font-semibold text-brand hover:underline">Buka project →</button></div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

// ---------------- potongan kecil ----------------
function Kpi({ k, v, s, tone, bar }) {
  return (
    <Card className="p-3">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">{k}</p>
      <p className={cx('mt-0.5 text-2xl font-extrabold leading-tight', tone)}>{v}</p>
      {bar && <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200">{bar.map(([w, c], i) => <span key={i} className={c} style={{ width: `${w}%` }} />)}</div>}
      <p className="mt-0.5 truncate text-[11px] text-ink-mute" title={typeof s === 'string' ? s : undefined}>{s}</p>
    </Card>
  )
}
function Chip({ on, onClick, n, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx('inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold ring-1 transition', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
      {children}{n !== undefined && <span className={cx('text-[10px] font-semibold', on ? 'text-slate-300' : 'text-ink-mute')}>{n}</span>}
    </button>
  )
}
function Arah({ s }) {
  const nl = [s.lang_from, s.lang_to].includes('Belanda')
  return <span className={cx('inline-block whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-bold ring-1', nl ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-sky-50 text-sky-700 ring-sky-200')}>{arahSub(s)}</span>
}
function Saran({ sr, ringkas }) {
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1', ringkas ? '' : 'mt-2 flex', sr.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200')} data-saran={sr.ok ? 'ok' : 'tidak'}>
      {sr.ok ? <Check className="h-3 w-3 shrink-0" /> : <AlertTriangle className="h-3 w-3 shrink-0" />}
      <span className="min-w-0 truncate" title={sr.ok ? `Saran: ${sr.nama} · ${sr.ket}` : `Tidak ada yang muat — ${sr.nama} ${sr.ket}`}>
        {ringkas ? <><b>{sr.nama.split(' (')[0]}</b> <span className="font-medium opacity-80">· {sr.ok ? sr.ket.split(' · ')[0] : sr.ket}</span></>
          : sr.ok ? <>Saran: <b>{sr.nama}</b> · {sr.ket}</> : <>Tidak ada yang muat — <b>{sr.nama}</b> {sr.ket}</>}
      </span>
    </span>
  )
}

/** Papan beban penerjemah; kalau ada `dipilih`, dikelompokkan muat / tidak muat / libur. */
function PapanKapasitas({ baris, dipilih, hlm, onTugaskan, sibuk, besar }) {
  const grup = dipilih
    ? [['Muat & pernah pasangan ini', baris.filter((t) => t.muat && t.cocok)], ['Muat', baris.filter((t) => t.muat && !t.cocok)], ['Tidak muat', baris.filter((t) => !t.muat && !t.libur)], ['Libur', baris.filter((t) => t.libur)]]
    : [['Masih longgar', baris.filter((t) => t.tone === 'g')], ['Hampir penuh / lebih', baris.filter((t) => t.tone === 'y' || t.tone === 'rd')], ['Libur', baris.filter((t) => t.libur)]]
  if (!baris.length) return <p className="px-4 py-6 text-center text-sm text-ink-mute">Belum ada penerjemah aktif.</p>
  return (
    <div>
      {grup.filter(([, l]) => l.length).map(([judul, l]) => (
        <div key={judul}>
          <p className="bg-slate-50/80 px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-mute">{judul}</p>
          <ul>
            {l.map((t, i) => {
              const n = NADA[t.tone]
              const setelah = dipilih && t.muat ? t.pakai + hlm : null
              return (
                <li key={t.u.id} data-penerjemah={t.u.id}
                  className={cx('flex items-center gap-2.5 border-t border-slate-100 px-3', besar ? 'min-h-[64px] py-2.5' : 'min-h-[58px] py-2',
                    t.libur && 'opacity-55', dipilih && t.muat && t.cocok ? 'bg-emerald-50/70 shadow-[inset_3px_0_0_#059669]' : i % 2 ? 'bg-slate-50/70' : 'bg-white')}>
                  <Avatar user={t.u} size={36} ring={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="shrink-0 truncate text-[13px] font-bold">{t.u.name}</p>
                      {t.libur ? <span className="rounded-md bg-rose-50 px-1.5 py-px text-[9.5px] font-bold text-rose-700 ring-1 ring-rose-200"><Plane className="inline h-2.5 w-2.5" /> Libur</span>
                        : t.bahasa.length > 0 && <span className="truncate rounded-md bg-emerald-50 px-1.5 py-px text-[9.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">{t.bahasa.slice(0, 3).join(' · ')}</span>}
                    </div>
                    <p className="truncate text-[10.5px] text-ink-mute">
                      {placeOf(t.u)} · {t.pakai} hlm dipegang{t.dekat ? ` · deadline terdekat ${tgl(t.dekat)}` : ''}{t.ajuan ? <> · ajukan {t.kap}→{t.ajuan.ke} <b className="text-amber-700">menunggu ACC</b></> : ''}{dipilih && !t.libur && !t.cocok ? <> · <span className="text-ink-mute/80">belum pernah {arahSub(dipilih)}</span></> : ''}
                    </p>
                    {!t.libur && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="relative flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${t.pakai} dari ${t.kap} halaman`}>
                          <span className={n.bar} style={{ width: `${Math.min(100, (t.pakai / t.kap) * 100)}%` }} />
                          {setelah !== null && <span className="h-full bg-[repeating-linear-gradient(45deg,#059669_0_3px,#a7f3d0_3px_6px)]" style={{ width: `${Math.min(100 - Math.min(100, (t.pakai / t.kap) * 100), (hlm / t.kap) * 100)}%` }} />}
                        </div>
                        <span className="min-w-[44px] text-right text-[11px] font-extrabold tabular-nums">{setelah !== null ? <>{t.pakai}→{setelah}</> : t.pakai}<span className="font-semibold text-ink-mute">/{t.kap}</span></span>
                      </div>
                    )}
                  </div>
                  <span className={cx('shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold', n.pill)}>{t.libur ? 'libur' : t.sisa < 0 ? `lebih ${-t.sisa}` : `sisa ${t.sisa}`}</span>
                  {onTugaskan && (
                    t.muat
                      ? <Button size="sm" loading={sibuk} onClick={() => onTugaskan(t)} className={besar ? 'h-11 w-11 !px-0' : ''} aria-label={`Tugaskan ke ${t.u.name}`} data-aksi="tugaskan-ke">{besar ? <ChevronRight className="h-4 w-4" /> : 'Tugaskan'}</Button>
                      : t.libur ? <span className={cx('grid shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400', besar ? 'h-11 w-11' : 'h-8 w-8')}><ChevronRight className="h-4 w-4" /></span>
                        : <Button size="sm" variant="outline" loading={sibuk} onClick={() => onTugaskan(t)} className={cx('!text-ink-mute', besar ? 'h-11 w-11 !px-0' : '')} title="Melebihi kapasitas — tetap bisa ditugaskan" aria-label={`Tugaskan ke ${t.u.name} (melebihi kapasitas)`} data-aksi="tugaskan-ke-paksa">{besar ? <ChevronRight className="h-4 w-4" /> : 'Paksa'}</Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
