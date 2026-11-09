import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Check, X, Plane, Download, Loader2, AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Select, Sheet, Input, Field, Popover, cx } from './ui.jsx'
import Avatar from './Avatar.jsx'
import { LIBUR, shiftLabel } from '../config/shifts.js'
import {
  HARI_PENDEK, hariKunci, labelBulan, geserBulan, mingguBulan, pakaiShift, isiShift, yangLibur, isiHari, namaPendek,
  jamBaris, barisUntukCabang, stafCabang, tanggalCuti, jadwalSaya, cabangBolehLihat,
} from '../lib/jadwal.js'
import { branchesOf } from '../config/access.js'
import { htmlCetak, cetakHtml } from '../lib/jadwalCetak.js'

// ============================================================
//  JADWAL v2 — tampilan baru (desain 10 Nov 2026):
//  PC: per minggu (baris = shift) + panel kanan; HP: pilih tanggal.
//  Ajukan Libur bulan depan · Rekap Libur · Unduh A4 (4 format).
// ============================================================

export const WARNA_SHIFT = {
  admin_pagi: 'bg-white', admin_siang: 'bg-yellow-50', pagi: 'bg-white', tengah: 'bg-sky-50', siang: 'bg-white', malam: 'bg-slate-100',
}
export const CHIP_SHIFT = {
  admin_pagi: 'bg-slate-100 text-slate-800', admin_siang: 'bg-yellow-100 text-yellow-900', pagi: 'bg-sky-100 text-sky-900', tengah: 'bg-blue-200 text-blue-950',
  siang: 'bg-violet-100 text-violet-900', malam: 'bg-slate-300 text-slate-900', libur: 'bg-rose-100 text-rose-700',
}
export const KUOTA_LIBUR = 4
export const MIN_MASUK_BAWAAN = 4
const hariIdx = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7

/** Chip nama + foto kecil. */
function Orang({ r, nameOf, users }) {
  const u = users.find((x) => x.id === r.user_id)
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-ink ring-1 ring-slate-200" title={nameOf(r.user_id)}>
      <Avatar user={u || { name: nameOf(r.user_id) }} size={18} />
      <span className="truncate">{namaPendek(nameOf(r.user_id))}</span>
      {r.jam_mulai && <span className="shrink-0 text-[10px] font-normal text-ink-mute">({r.jam_mulai.slice(0, 2)})</span>}
    </span>
  )
}

/** Indeks minggu yang memuat hari ini (atau minggu pertama). */
export const mingguAwal = (minggu) => Math.max(0, minggu.findIndex((mg) => mg.some((h) => h.iso === hariKunci(new Date()))))

/* ---------------- PC: satu cabang per minggu ---------------- */
export function CabangMinggu({ minggu, wi, setWi, cabang, peta, bolehUbah, onEdit }) {
  const { data, nameOf } = useApp()
  const baris = useMemo(() => barisUntukCabang(data.users, cabang), [data.users, cabang])
  const mg = minggu[Math.min(wi, minggu.length - 1)] || []
  const hariIni = hariKunci(new Date())
  return (
    <Card className="overflow-hidden" data-cabang-minggu>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={() => setWi(Math.max(0, wi - 1))} disabled={wi === 0} aria-label="Minggu sebelumnya" className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <b className="text-sm">{mg[0]?.tanggal}–{mg[6]?.tanggal} · minggu ke-{wi + 1}</b>
        <button type="button" onClick={() => setWi(Math.min(minggu.length - 1, wi + 1))} disabled={wi >= minggu.length - 1} aria-label="Minggu berikutnya" className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        <span className="ml-auto text-[11px] text-ink-mute">Cabang {cabang}</span>
      </div>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-[124px] px-3 py-2 text-left text-[11px] font-bold uppercase text-ink-mute">Shift</th>
            {mg.map((h) => (
              <th key={h.iso} className={cx('border-l border-slate-100 py-2 text-center', h.iso === hariIni ? 'bg-brand text-white' : '', !h.bulanIni && 'opacity-40')}>
                <span className={cx('block text-[10px] font-bold uppercase', h.iso === hariIni ? 'text-white/80' : 'text-ink-mute')}>{HARI_PENDEK[hariIdx(h.iso)]}</span>
                <span className="text-[15px] font-extrabold">{h.tanggal}</span>
                {bolehUbah && h.bulanIni && <button type="button" onClick={() => onEdit({ iso: h.iso, cabang })} aria-label={`Atur ${h.iso}`} title="Atur shift hari ini" className={cx('ml-1 inline-grid h-6 w-6 place-items-center rounded align-middle', h.iso === hariIni ? 'hover:bg-white/20' : 'text-brand hover:bg-brand-soft')}><Pencil className="h-3 w-3" /></button>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.key} className={WARNA_SHIFT[b.key]}>
              <td className="border-t border-slate-100 px-3 py-2"><b className="text-[12px]">{b.label}</b>
                {(() => { const j = jamBaris(peta, { shift: b.key, tanggal: mg[0]?.iso, cabang }); return j ? <span className="block text-[10px] text-ink-mute">{j.mulai.slice(0, 2)}–{j.selesai.slice(0, 2)} · {j.lokasi === 'OFFICE' ? 'Office' : j.lokasi}</span> : null })()}
              </td>
              {mg.map((h) => {
                const isi = h.bulanIni ? isiShift(peta, h.iso, cabang, b.key) : []
                return (
                  <td key={h.iso} className={cx('border-l border-t border-slate-100 px-1.5 py-1.5 text-center', h.iso === hariIni && 'bg-brand-soft/50', !h.bulanIni && 'opacity-40')}>
                    {isi.length ? <span className="flex flex-col items-center gap-1">{isi.map((r) => <Orang key={r.id} r={r} nameOf={nameOf} users={data.users} />)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td className="border-t border-slate-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">Libur</td>
            {mg.map((h) => {
              const l = h.bulanIni ? yangLibur(peta, h.iso, cabang) : []
              return <td key={h.iso} className="border-l border-t border-slate-200 bg-rose-50 px-1 py-2 text-center text-[11px] font-bold leading-snug text-rose-700">{l.length ? l.map((r) => namaPendek(nameOf(r.user_id))).join(', ') : <span className="text-rose-200">—</span>}</td>
            })}
          </tr>
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-ink-mute">Jam shift otomatis mengikuti aturan cabang (berubah bila ada yang libur). {bolehUbah ? 'Klik ✎ di tanggal untuk mengatur shift hari itu.' : ''}</p>
    </Card>
  )
}

/* ---------------- PC: panel kanan ---------------- */
export function PanelKanan({ cabang, peta, ym, cuti, onRekap, bolehUbah }) {
  const { data, nameOf, user } = useApp()
  const hariIni = hariKunci(new Date())
  const isi = isiHari(peta, hariIni, cabang).sort((a, b) => String(a.shift).localeCompare(String(b.shift)))
  const masuk = isi.filter((r) => r.shift !== LIBUR)
  const daftarCabang = cabangBolehLihat(user)
  const mg = (mingguBulan(ym).find((w) => w.some((h) => h.iso === hariIni)) || mingguBulan(ym)[0])
  const ymDepan = geserBulan(ym, 1)
  const ajuDepan = cuti.filter((c) => tanggalCuti(c).some((d) => d.startsWith(ymDepan)))
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">Hari ini · {cabang}</p>
        <p className="mt-1 text-[13px]"><b className="text-emerald-700">{masuk.length} masuk</b> · <span className="text-ink-mute">{isi.length - masuk.length} libur</span></p>
        <div className="mt-2 space-y-1.5">
          {masuk.map((r) => <div key={r.id} className="flex items-center gap-2"><Orang r={r} nameOf={nameOf} users={data.users} /><span className="ml-auto text-[11px] text-ink-mute">{shiftLabel(r.shift)}</span></div>)}
          {!isi.length && <p className="text-xs text-ink-mute">Belum ada jadwal hari ini.</p>}
        </div>
      </Card>
      {daftarCabang.length > 1 && (
        <Card className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">Semua cabang · minggu ini</p>
          <table className="mt-2 w-full">
            <thead><tr><th />{HARI_PENDEK.map((h) => <th key={h} className="text-[9px] text-ink-mute">{h}</th>)}</tr></thead>
            <tbody>{daftarCabang.map((cb) => (
              <tr key={cb}><td className="py-0.5 pr-1 text-[12px] font-semibold">{cb}</td>{mg.map((h) => {
                const n = isiHari(peta, h.iso, cb).filter((r) => r.shift !== LIBUR).length
                const ada = isiHari(peta, h.iso, cb).length
                return <td key={h.iso} className="p-0.5 text-center"><span className={cx('mx-auto grid h-6 w-7 place-items-center rounded-md text-[10px] font-bold', !ada ? 'text-slate-300' : n === 0 ? 'bg-rose-600 text-white' : n < ada / 2 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700')}>{ada ? n : '·'}</span></td>
              })}</tr>
            ))}</tbody>
          </table>
          <p className="mt-1 text-[10px] text-ink-mute">angka = orang masuk · kuning = kurang dari separuh · merah = tidak ada yang masuk</p>
        </Card>
      )}
      <div className="rounded-2xl bg-gradient-to-r from-brand to-[#6d5cf6] p-4 text-white">
        <p className="text-[11px] font-bold text-white/80">PENGAJUAN LIBUR {labelBulan(ymDepan).toUpperCase()}</p>
        <p className="text-[14px] font-extrabold">{ajuDepan.filter((c) => c.status === 'diajukan').length} menunggu · {ajuDepan.filter((c) => c.status === 'disetujui').length} disetujui</p>
        {bolehUbah && <button type="button" onClick={onRekap} className="mt-2 rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-brand">Buka rekap →</button>}
      </div>
    </div>
  )
}

/* ---------------- HP: deret tanggal ---------------- */
function DeretTanggal({ hari, pilih, setPilih, tanda }) {
  return (
    <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" data-deret-tanggal>
      {hari.map((h) => (
        <button key={h.iso} type="button" onClick={() => setPilih(h.iso)} aria-pressed={pilih === h.iso}
          className={cx('grid w-[46px] shrink-0 place-items-center rounded-xl py-1.5', pilih === h.iso ? 'bg-brand text-white' : 'bg-white ring-1 ring-slate-200')}>
          <span className={cx('text-[9px] font-bold', pilih === h.iso ? 'text-white/80' : 'text-ink-mute')}>{HARI_PENDEK[hariIdx(h.iso)]}</span>
          <b className="text-[15px] tabular-nums">{h.tanggal}</b>
          <span className={cx('mt-0.5 h-1 w-1 rounded-full', tanda?.(h.iso) ? (pilih === h.iso ? 'bg-white' : 'bg-rose-500') : 'bg-transparent')} />
        </button>
      ))}
    </div>
  )
}
const hariBulan = (ym) => mingguBulan(ym).flat().filter((h) => h.bulanIni)
const awalPilih = (ym) => { const t = hariKunci(new Date()); return t.startsWith(ym) ? t : `${ym}-01` }

export function HpCabang({ ym, cabang, peta }) {
  const { data, nameOf } = useApp()
  const [pilih, setPilih] = useState(() => awalPilih(ym))
  const baris = barisUntukCabang(data.users, cabang)
  const l = yangLibur(peta, pilih, cabang)
  return (
    <div className="space-y-2" data-hp-cabang>
      <DeretTanggal hari={hariBulan(ym)} pilih={pilih} setPilih={setPilih} tanda={(iso) => yangLibur(peta, iso, cabang).length > 0} />
      {baris.map((b) => {
        const isi = isiShift(peta, pilih, cabang, b.key)
        const j = isi[0] ? jamBaris(peta, isi[0]) : null
        return (
          <div key={b.key} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
            <div className="w-[84px] shrink-0"><p className="text-[12px] font-bold">{b.label}</p>{j && <p className="text-[10px] text-ink-mute">{j.mulai}–{j.selesai}</p>}</div>
            <div className="flex min-w-0 flex-wrap gap-1">{isi.length ? isi.map((r) => <Orang key={r.id} r={r} nameOf={nameOf} users={data.users} />) : <span className="text-xs text-slate-300">—</span>}</div>
          </div>
        )
      })}
      <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 ring-1 ring-rose-200">
        <b className="text-[12px] text-rose-700">Libur</b>
        <span className="text-[12px] font-semibold text-rose-700">{l.length ? l.map((r) => namaPendek(nameOf(r.user_id))).join(', ') : <span className="font-normal text-rose-700/60">semua masuk</span>}</span>
      </div>
    </div>
  )
}

export function HpPerusahaan({ ym, peta }) {
  const { user, nameOf } = useApp()
  const [pilih, setPilih] = useState(() => awalPilih(ym))
  const cabangList = cabangBolehLihat(user)
  const total = cabangList.reduce((a, cb) => a + isiHari(peta, pilih, cb).filter((r) => r.shift !== LIBUR).length, 0)
  const libur = cabangList.reduce((a, cb) => a + yangLibur(peta, pilih, cb).length, 0)
  return (
    <div className="space-y-2" data-hp-perusahaan>
      <DeretTanggal hari={hariBulan(ym)} pilih={pilih} setPilih={setPilih} tanda={(iso) => cabangList.some((cb) => yangLibur(peta, iso, cb).length)} />
      <p className="text-[11px] font-bold text-ink-mute">{total} orang masuk · {libur} libur</p>
      {cabangList.map((cb) => {
        const n = isiHari(peta, pilih, cb).filter((r) => r.shift !== LIBUR).length
        const l = yangLibur(peta, pilih, cb)
        return (
          <div key={cb} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
            <b className="w-[84px] shrink-0 text-[12px]">{cb}</b>
            <span className={cx('grid h-6 w-7 shrink-0 place-items-center rounded-md text-[11px] font-bold', n === 0 ? 'bg-rose-600 text-white' : 'bg-emerald-50 text-emerald-700')}>{n}</span>
            <span className="text-[11px] text-ink-mute">masuk</span>
            {l.length > 0 && <span className="ml-auto truncate rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Libur: {l.map((r) => namaPendek(nameOf(r.user_id))).join(', ')}</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Saya: kalender (PC) & per minggu (HP) ---------------- */
export function SayaBaru({ ym, peta, rows }) {
  const { user } = useApp()
  const milik = useMemo(() => new Map(jadwalSaya(rows, user.id, ym).map((r) => [r.tanggal, r])), [rows, user.id, ym])
  const minggu = mingguBulan(ym)
  const [wi, setWi] = useState(() => mingguAwal(minggu))
  const hariIni = hariKunci(new Date())
  const hit = {}; for (const r of milik.values()) hit[r.shift] = (hit[r.shift] || 0) + 1
  const Sel = ({ h, besar }) => {
    const r = milik.get(h.iso); const j = r ? jamBaris(peta, r) : null
    return (
      <>
        <span className={cx('rounded-md px-2 py-0.5 text-[11px] font-bold', r ? CHIP_SHIFT[r.shift] : 'text-ink-mute')}>{r ? shiftLabel(r.shift) : '—'}</span>
        {j && <span className={cx('text-ink-mute', besar ? 'mt-1 block text-[10.5px]' : 'text-[11px]')}>{r.jam_mulai ? `mulai ${r.jam_mulai}` : `${j.mulai}–${j.selesai}`} · {j.lokasi === 'OFFICE' ? 'Office' : j.lokasi}</span>}
      </>
    )
  }
  return (
    <div className="space-y-3" data-saya-baru>
      <div className="flex flex-wrap gap-1.5">
        {['pagi', 'tengah', 'siang', 'malam', 'admin_pagi', 'admin_siang', LIBUR].filter((k) => hit[k]).map((k) => (
          <span key={k} className={cx('rounded-lg px-2.5 py-1 text-[11px] font-bold', CHIP_SHIFT[k])}>{hit[k]} hari {shiftLabel(k)}</span>
        ))}
        {!milik.size && <span className="text-xs text-ink-mute">Belum ada jadwal bulan ini — jadwal disusun Direktur/Superadmin.</span>}
      </div>
      {/* HP: per minggu */}
      <div className="space-y-1.5 lg:hidden">
        <div className="flex items-center text-[12px] font-bold">
          <button type="button" onClick={() => setWi(Math.max(0, wi - 1))} aria-label="Minggu sebelumnya" className="grid h-9 w-9 place-items-center"><ChevronLeft className="h-4 w-4" /></button>
          <span className="flex-1 text-center">{minggu[wi]?.[0]?.tanggal}–{minggu[wi]?.[6]?.tanggal} · minggu ke-{wi + 1}</span>
          <button type="button" onClick={() => setWi(Math.min(minggu.length - 1, wi + 1))} aria-label="Minggu berikutnya" className="grid h-9 w-9 place-items-center"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {(minggu[wi] || []).filter((h) => h.bulanIni).map((h) => (
          <div key={h.iso} className={cx('flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1', h.iso === hariIni ? 'ring-2 ring-brand' : 'ring-slate-200')}>
            <div className="w-9 shrink-0 text-center"><p className="text-[9px] font-bold text-ink-mute">{HARI_PENDEK[hariIdx(h.iso)]}</p><p className="text-[16px] font-extrabold tabular-nums">{h.tanggal}</p></div>
            <div className="flex min-w-0 flex-wrap items-center gap-2"><Sel h={h} /></div>
            {h.iso === hariIni && <span className="ml-auto text-[10px] font-bold text-brand">Hari ini</span>}
          </div>
        ))}
      </div>
      {/* PC: kalender sebulan */}
      <Card className="hidden overflow-hidden lg:block">
        <table className="w-full table-fixed border-collapse">
          <thead><tr>{HARI_PENDEK.map((h, i) => <th key={h} className={cx('py-2 text-[11px] font-bold uppercase', i === 6 ? 'text-rose-600' : 'text-ink-mute')}>{h}</th>)}</tr></thead>
          <tbody>{minggu.map((mg, i) => (
            <tr key={i}>{mg.map((h) => (
              <td key={h.iso} className={cx('h-[92px] border-t border-l border-slate-100 p-2 align-top', !h.bulanIni && 'bg-slate-50', h.iso === hariIni && 'bg-brand-soft/60')}>
                <p className={cx('text-[13px] font-extrabold', !h.bulanIni ? 'text-slate-300' : hariIdx(h.iso) === 6 ? 'text-rose-600' : '')}>{h.tanggal}</p>
                {h.bulanIni && <div className="mt-1"><Sel h={h} besar /></div>}
              </td>
            ))}</tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  )
}

/* ---------------- Ajukan libur bulan depan ---------------- */
export function SheetAjukanLibur({ onClose, ymDepan }) {
  const { user, data, save, notify } = useApp()
  const cabang = branchesOf(user)[0] || user.branch
  const [pilih, setPilih] = useState([])
  const [jenis, setJenis] = useState('libur')
  const [alasan, setAlasan] = useState('')
  const [busy, setBusy] = useState(false)
  const minggu = mingguBulan(ymDepan)
  const lain = (data.cuti || []).filter((c) => c.cabang === cabang && c.user_id !== user.id && c.status !== 'ditolak')
  const nLain = (iso) => lain.filter((c) => tanggalCuti(c).includes(iso)).length
  const sudah = (data.cuti || []).filter((c) => c.user_id === user.id && c.status !== 'ditolak' && tanggalCuti(c).some((d) => d.startsWith(ymDepan)))
  const terpakai = sudah.reduce((a, c) => a + tanggalCuti(c).filter((d) => d.startsWith(ymDepan)).length, 0)
  const sisa = KUOTA_LIBUR - terpakai
  const ramai = pilih.filter((d) => nLain(d) >= 2)
  const toggle = (iso) => setPilih((p) => (p.includes(iso) ? p.filter((x) => x !== iso) : jenis === 'libur' && p.length >= sisa ? (notify(`Kuota libur ${KUOTA_LIBUR} hari per bulan`, 'err'), p) : [...p, iso].sort()))
  const kirim = async () => {
    if (!pilih.length) return
    setBusy(true)
    try {
      const periode = pilih.map((d) => ({ mulai: d, selesai: d }))
      await save('cuti', { user_id: user.id, nama: user.name, cabang, jenis, periode, mulai: pilih[0], selesai: pilih[pilih.length - 1], alasan, status: 'diajukan', at: new Date().toISOString() })
      notify(`Pengajuan ${pilih.length} hari dikirim ke Direktur`)
      onClose()
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <Sheet open side onClose={onClose} title={`Ajukan Libur · ${labelBulan(ymDepan)}`} subtitle={`Kuota ${KUOTA_LIBUR} hari · sisa ${Math.max(0, sisa)} · dipilih ${pilih.length}`}
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={busy} disabled={!pilih.length} onClick={kirim} data-aksi="kirim-libur"><Plane className="h-4 w-4" />Kirim pengajuan ({pilih.length} hari)</Button></>}>
      <div className="space-y-3" data-ajukan-libur>
        <div className="flex gap-1.5">
          {[['libur', 'Libur'], ['cuti', 'Cuti tahunan'], ['izin', 'Izin']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setJenis(k)} className={cx('h-10 rounded-lg px-3 text-[12px] font-bold ring-1', jenis === k ? 'bg-ink text-white ring-ink' : 'bg-white ring-slate-200')}>{l}</button>
          ))}
        </div>
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-ink-mute">{HARI_PENDEK.map((h) => <span key={h}>{h}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {minggu.flat().map((h) => !h.bulanIni ? <span key={h.iso} /> : (
              <button key={h.iso} type="button" onClick={() => toggle(h.iso)} aria-pressed={pilih.includes(h.iso)} data-tgl={h.iso}
                className={cx('grid h-11 place-items-center rounded-lg text-[13px] font-bold ring-1', pilih.includes(h.iso) ? 'bg-brand text-white ring-brand' : 'bg-white ring-slate-200 hover:ring-brand', hariIdx(h.iso) === 6 && !pilih.includes(h.iso) && 'text-rose-600')}>
                <span className="leading-none">{h.tanggal}<span className={cx('mx-auto mt-1 block h-1 w-1 rounded-full', nLain(h.iso) >= 2 ? (pilih.includes(h.iso) ? 'bg-white' : 'bg-amber-500') : 'bg-transparent')} /></span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-mute"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />sudah ≥2 orang {cabang} mengajukan hari itu</p>
        </div>
        <Field label="Alasan (opsional)"><Input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. acara keluarga" /></Field>
        {ramai.length > 0 && <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900 ring-1 ring-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />Tanggal {ramai.map((d) => Number(d.slice(8))).join(', ')} sudah banyak yang mengajukan. Tetap bisa diajukan, keputusan di Direktur.</p>}
        {sudah.length > 0 && <p className="text-[11px] text-ink-mute">Sudah diajukan bulan ini: {sudah.map((c) => tanggalCuti(c).map((d) => Number(d.slice(8))).join(', ') + ` (${c.status})`).join(' · ')}</p>}
      </div>
    </Sheet>
  )
}

/* ---------------- Rekap pengajuan libur ---------------- */
export function RekapLibur({ ym: ymAwal, cabangUbah }) {
  const { user, data, save, notify, nameOf } = useApp()
  const [ym, setYm] = useState(ymAwal)
  const [cabang, setCabang] = useState(() => (cabangUbah.includes(branchesOf(user)[0]) ? branchesOf(user)[0] : cabangUbah[0]))
  const [minMasuk, setMin] = useState(MIN_MASUK_BAWAAN)
  const [sibuk, setSibuk] = useState('')
  const staf = stafCabang(data.users, cabang)
  const hari = mingguBulan(ym).flat().filter((h) => h.bulanIni)
  const aju = (data.cuti || []).filter((c) => c.cabang === cabang && c.status !== 'ditolak' && tanggalCuti(c).some((d) => d.startsWith(ym)))
  const selOf = (uid, iso) => aju.find((c) => c.user_id === uid && tanggalCuti(c).includes(iso))
  const offHari = (iso, hanyaSetuju) => aju.filter((c) => (!hanyaSetuju || c.status === 'disetujui') && tanggalCuti(c).includes(iso)).length
  const masuk = (iso) => staf.length - offHari(iso)
  const menunggu = aju.filter((c) => c.status === 'diajukan')
  const putus = async (c, status) => {
    setSibuk(c.id)
    try { await save('cuti', { ...c, status, diputus_oleh: user.name, diputus_at: new Date().toISOString() }); notify(`${namaPendek(c.nama || nameOf(c.user_id))}: ${status === 'disetujui' ? 'disetujui' : 'ditolak'}`) }
    catch (e) { notify(e.message, 'err') } finally { setSibuk('') }
  }
  // aman = semua tanggalnya tetap menyisakan ≥ minimal orang masuk (dihitung dari yang sudah disetujui + pengajuan ini)
  const aman = (c) => tanggalCuti(c).filter((d) => d.startsWith(ym)).every((d) => staf.length - offHari(d, true) - 1 >= minMasuk)
  const setujuiAman = async () => {
    const list = menunggu.filter(aman)
    if (!list.length) return notify('Tidak ada pengajuan yang aman disetujui otomatis', 'err')
    setSibuk('semua')
    try { for (const c of list) await save('cuti', { ...c, status: 'disetujui', diputus_oleh: user.name, diputus_at: new Date().toISOString() }); notify(`${list.length} pengajuan disetujui`) }
    catch (e) { notify(e.message, 'err') } finally { setSibuk('') }
  }
  const terapkan = async () => {
    setSibuk('terapkan')
    let n = 0
    try {
      const ada = new Set((data.jadwal || []).filter((r) => r.shift === LIBUR).map((r) => `${r.user_id}|${r.tanggal}`))
      for (const c of aju.filter((x) => x.status === 'disetujui')) for (const d of tanggalCuti(c).filter((x) => x.startsWith(ym))) {
        if (ada.has(`${c.user_id}|${d}`)) continue
        const lama = (data.jadwal || []).find((r) => r.user_id === c.user_id && r.tanggal === d)
        await save('jadwal', lama ? { ...lama, shift: LIBUR, dari_cuti: c.id } : { tanggal: d, cabang: c.cabang, user_id: c.user_id, shift: LIBUR, dari_cuti: c.id }); n++
      }
      notify(n ? `${n} hari libur diterapkan ke jadwal ${labelBulan(ym)}` : 'Semua libur yang disetujui sudah ada di jadwal')
    } catch (e) { notify(e.message, 'err') } finally { setSibuk('') }
  }
  return (
    <Card className="overflow-hidden" data-rekap-libur>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <b className="text-sm">Rekap Pengajuan Libur</b>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{menunggu.length} menunggu</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{aju.length - menunggu.length} disetujui</span>
        <span className="flex items-center rounded-lg ring-1 ring-slate-200">
          <button type="button" onClick={() => setYm(geserBulan(ym, -1))} className="grid h-9 w-9 place-items-center" aria-label="Bulan sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
          <b className="px-1 text-[12px]">{labelBulan(ym)}</b>
          <button type="button" onClick={() => setYm(geserBulan(ym, 1))} className="grid h-9 w-9 place-items-center" aria-label="Bulan berikutnya"><ChevronRight className="h-4 w-4" /></button>
        </span>
        {cabangUbah.length > 1 && <Select value={cabang} onChange={(e) => setCabang(e.target.value)} className="!h-9 !w-36 text-[12px]">{cabangUbah.map((b) => <option key={b}>{b}</option>)}</Select>}
        <label className="flex items-center gap-1 text-[12px] font-semibold">Min. masuk/hari <Input type="number" min={1} max={20} value={minMasuk} onChange={(e) => setMin(Math.max(1, Number(e.target.value) || 1))} className="!h-9 !w-16" /></label>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" loading={sibuk === 'semua'} onClick={setujuiAman}><Check className="h-4 w-4" />Setujui yang aman</Button>
          <Button size="sm" loading={sibuk === 'terapkan'} onClick={terapkan} data-aksi="terapkan-libur">Terapkan ke jadwal</Button>
        </span>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[900px] border-collapse">
          <thead><tr><th className="w-36 text-left text-[11px] text-ink-mute">Nama</th>
            {hari.map((h) => <th key={h.iso} className={cx('px-0 py-1 text-center text-[9px] font-bold', hariIdx(h.iso) === 6 ? 'bg-rose-50 text-rose-600' : 'text-ink-mute')}>{HARI_PENDEK[hariIdx(h.iso)].slice(0, 2)}<br /><span className="text-[11px] text-ink">{h.tanggal}</span></th>)}
            <th className="w-14 text-[10px] text-ink-mute">Kuota</th></tr></thead>
          <tbody>
            {staf.map((u) => {
              const n = aju.filter((c) => c.user_id === u.id).reduce((a, c) => a + tanggalCuti(c).filter((d) => d.startsWith(ym)).length, 0)
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-1 py-1 text-[12px] font-semibold"><span className="flex items-center gap-1.5"><Avatar user={u} size={20} />{namaPendek(u.name)}</span></td>
                  {hari.map((h) => {
                    const c = selOf(u.id, h.iso)
                    return (
                      <td key={h.iso} className={cx('border-l border-slate-100 py-1 text-center', hariIdx(h.iso) === 6 && 'bg-rose-50/40')}>
                        {c && (
                          <Popover label="Pengajuan" align="left" width="min-w-[240px]"
                            button={({ toggle }) => (
                              <button type="button" onClick={toggle} data-sel-libur={`${u.id}|${h.iso}`}
                                className={cx('mx-auto grid h-6 w-6 place-items-center rounded text-[10px] font-bold', c.status === 'disetujui' ? 'bg-emerald-500 text-white' : 'bg-amber-300 text-amber-950 hover:ring-2 hover:ring-brand')}>
                                {sibuk === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : c.status === 'disetujui' ? '✓' : 'L'}
                              </button>
                            )}>
                            {({ close }) => (
                              <div className="space-y-2 p-1 text-left">
                                <p className="text-sm font-bold">{namaPendek(c.nama || u.name)} · {c.jenis === 'cuti' ? 'Cuti' : c.jenis === 'izin' ? 'Izin' : 'Libur'}</p>
                                <p className="text-xs text-ink-soft">Tanggal: {tanggalCuti(c).map((d) => Number(d.slice(8))).join(', ')} {labelBulan(ym)}</p>
                                {c.alasan && <p className="text-xs text-ink-soft">Alasan: {c.alasan}</p>}
                                <p className="text-[11px] font-semibold">{c.status === 'disetujui' ? <span className="text-emerald-700">Disetujui {c.diputus_oleh ? `oleh ${c.diputus_oleh}` : ''}</span> : <span className="text-amber-700">Menunggu keputusan</span>}</p>
                                <div className="flex gap-1.5">
                                  {c.status !== 'disetujui' && <Button size="sm" onClick={() => { close(); putus(c, 'disetujui') }}><Check className="h-3.5 w-3.5" />Setujui</Button>}
                                  <Button size="sm" variant="outline" onClick={() => { close(); putus(c, 'ditolak') }}><X className="h-3.5 w-3.5" />Tolak</Button>
                                </div>
                              </div>
                            )}
                          </Popover>
                        )}
                      </td>
                    )
                  })}
                  <td className={cx('text-center text-[12px] font-bold', n > KUOTA_LIBUR && 'text-rose-600')}>{n}/{KUOTA_LIBUR}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="px-1 py-1.5 text-[11px] font-bold">Orang masuk</td>
              {hari.map((h) => { const n = masuk(h.iso); const off = offHari(h.iso); return (
                <td key={h.iso} className="border-l border-slate-100 py-1 text-center"><span className={cx('mx-auto grid h-5 w-6 place-items-center rounded text-[10px] font-bold', n < minMasuk ? 'bg-rose-600 text-white' : off ? 'bg-amber-100 text-amber-800' : 'text-ink-mute')}>{n}</span></td>) })}
              <td />
            </tr>
          </tbody>
        </table>
        {!staf.length && <p className="py-6 text-center text-xs text-ink-mute">Belum ada staf terjadwal di cabang ini.</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-soft">
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-300 align-middle" />Diajukan (klik untuk setujui/tolak)</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500 align-middle" />Disetujui</span>
          <span><span className="mr-1 inline-block h-3 w-4 rounded bg-rose-600 align-middle" />Kurang dari minimal</span>
        </div>
      </div>
    </Card>
  )
}

/* ---------------- Unduh A4 ---------------- */
export function TombolUnduh({ ym, peta, cabang, rows }) {
  const { user, data, nameOf } = useApp()
  const lihatSemua = cabangBolehLihat(user).length > 1
  const buat = (jenis) => {
    const minggu = mingguBulan(ym)
    const o = { ym, minggu, peta, rows, users: data.users, cabang, cabangList: cabangBolehLihat(user), nameOf, user: data.users.find((u) => u.id === user.id) || user, nama: user.name, oleh: user.name,
      judul: jenis === 'orang' ? `Jadwal ${namaPendek(user.name)} ${labelBulan(ym)}` : jenis === 'perusahaan' ? `Jadwal Perusahaan ${labelBulan(ym)}` : `Jadwal ${cabang} ${labelBulan(ym)}` }
    cetakHtml(htmlCetak(jenis, o))
  }
  const opsi = [
    ['orang', 'Jadwal saya', 'Kalender pribadi · A4'],
    ['cabang', `Per cabang · ${cabang}`, 'Baris = orang · A4'],
    ...(pakaiShift(cabang) ? [['shift', `Shift cabang · ${cabang}`, 'Baris = shift (format Tim Bali) · A4']] : []),
    ...(lihatSemua ? [['perusahaan', 'Perusahaan', 'Libur semua cabang · A4']] : []),
  ]
  return (
    <Popover label="Unduh jadwal" align="right" width="min-w-[280px]"
      button={({ toggle }) => <Button size="sm" variant="outline" onClick={toggle} data-aksi="unduh-jadwal"><Download className="h-3.5 w-3.5" />Unduh</Button>}>
      {({ close }) => (
        <div className="space-y-0.5">
          <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Unduh {labelBulan(ym)} (A4, siap print)</p>
          {opsi.map(([k, l, s]) => (
            <button key={k} type="button" onClick={() => { close(); buat(k) }} data-unduh={k} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">
              <b className="text-sm text-ink">{l}</b><span className="text-[11px] text-ink-mute">{s}</span>
            </button>
          ))}
          <p className="px-2 pt-1 text-[10.5px] text-ink-mute">Di jendela cetak pilih "Simpan sebagai PDF" untuk mengunduh.</p>
        </div>
      )}
    </Popover>
  )
}
