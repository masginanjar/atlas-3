import { useMemo, useState } from 'react'
import { FileStack, Truck, Check, Pencil, AlertTriangle, History, PackageCheck, X, ArrowUp, ArrowDown, LayoutGrid, Table2, Grid3X3, Package } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Input, Select, Field, Sheet, Empty, cx } from '../components/ui.jsx'
import { MapTabs } from '../components/SubTab.jsx'
import { BRANCHES } from '../config/access.js'
import { tanggalJam, tanggal } from '../lib/waktu.js'
import {
  ARAH_AFFIDAVIT, arahLabel, AMBANG_RENDAH, statusStok, canKelolaAffidavit, canPantauSemua,
  cabangTerlihat, barisStok, riwayatPakai, riwayatKirim,
} from '../lib/affidavit.js'

// ============================================================
//  AFFIDAVIT — STOK LEMBAR (desain 9 Nov 2026)
//  Berorientasi "mana yang harus ditindak dulu": angka ringkas →
//  map bertingkat (Stok · Pengiriman · Pemakaian · Riwayat) → kartu
//  per cabang dengan 4 batang arah (sisa vs ambang) + perkiraan habis
//  dari pemakaian 14 hari. Fungsi Isi stok / Kirim / Terima tidak berubah.
// ============================================================

const TONE = {
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const HARI_PAKAI = 14
const ARAH_PENDEK = { 'id-en': 'ID → EN', 'en-id': 'EN → ID', 'id-nl': 'ID → NL', 'nl-id': 'NL → ID' }
/** Skala batang: 100% = 4× ambang (200 lembar) supaya garis ambang ada di 25%. */
const SKALA = AMBANG_RENDAH * 4

const Status = ({ s }) => (
  <span className={cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-bold leading-none ring-1', TONE[s.tone])}>
    {s.key === 'habis' && <AlertTriangle className="h-3 w-3" />}{s.label}
  </span>
)
const Sisa = ({ n }) => (
  n == null
    ? <span className="text-[14px] text-ink-mute">—</span>
    : <span className={cx('text-[14px] font-bold tabular-nums', n <= 0 ? 'text-rose-700' : n < AMBANG_RENDAH ? 'text-amber-700' : 'text-ink')}>{n}</span>
)
const fmt1 = (n) => (n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',').replace(/,0$/, ''))

/** Rata-rata pemakaian/hari (14 hari) per cabang|arah, dari catatan cetak. */
function rataPakai(pakai) {
  const batas = Date.now() - HARI_PAKAI * 86400000
  const m = {}
  for (const x of pakai || []) {
    const t = new Date(x.at || x.created_at || 0).getTime()
    if (t < batas) continue
    const k = `${x.cabang}|${x.arah}`; m[k] = (m[k] || 0) + (Number(x.lembar) || 0)
  }
  return m // total 14 hari; bagi HARI_PAKAI untuk per hari
}
/** "±N hari" / ">30 hari" / "habis" / null (tanpa data pemakaian). */
function perkiraan(sisa, perHari) {
  if (sisa == null) return null
  if (sisa <= 0) return 'habis'
  if (!perHari) return null
  const h = Math.round(sisa / perHari)
  return h > 30 ? '>30 hari' : `±${h} hari`
}

const TABS = (nKirim) => [
  { key: 'stok', label: 'Stok per cabang', icon: LayoutGrid },
  { key: 'kirim', label: 'Pengiriman', icon: Truck, n: nKirim },
  { key: 'pakai', label: 'Pemakaian', icon: FileStack },
  { key: 'riwayat', label: 'Riwayat', icon: History },
]

export default function Affidavit() {
  const { user, data, notify, setStokAffidavit, catatPengiriman, terimaPengiriman } = useApp()
  const boleh = canKelolaAffidavit(user)
  const pantau = canPantauSemua(user)
  const cabangSaya = useMemo(() => cabangTerlihat(user, BRANCHES), [user])

  const [tab, setTab] = useState('stok')
  const [saring, setSaring] = useState('perlu') // perlu | semua | habis | rendah | belum
  const [fCabang, setFCabang] = useState('Semua')
  const [fArah, setFArah] = useState('Semua')
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('atlas-affidavit-mode') || 'kartu' } catch { return 'kartu' } })
  const gantiMode = (m) => { setMode(m); try { localStorage.setItem('atlas-affidavit-mode', m) } catch { /* abaikan */ } }
  const [isiStok, setIsiStok] = useState(null)
  const [kirim, setKirim] = useState(null)
  const [riwayat, setRiwayat] = useState(null)
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const klikJudul = (k) => { if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(k); setSortDir('asc') } }

  const semua = useMemo(() => barisStok(cabangSaya, data.affidavit_stok, data.affidavit_kirim), [cabangSaya, data.affidavit_stok, data.affidavit_kirim])
  const pakai14 = useMemo(() => rataPakai(data.affidavit_pakai), [data.affidavit_pakai])
  const baris = useMemo(() => semua.map((r) => {
    const tot = pakai14[`${r.cabang}|${r.arah}`] || 0
    const perHari = tot / HARI_PAKAI
    return { ...r, pakai14: tot, perHari, perkiraan: perkiraan(r.sisa, perHari) }
  }), [semua, pakai14])

  // ---- angka ringkas
  const total = baris.reduce((a, r) => a + (r.sisa || 0), 0)
  const nHabis = baris.filter((r) => r.status.key === 'habis').length
  const nRendah = baris.filter((r) => r.status.key === 'rendah').length
  const nBelum = baris.filter((r) => r.status.key === 'belum_diisi').length
  const nPerlu = nHabis + nRendah + nBelum
  const terpakai14 = Object.entries(pakai14).filter(([k]) => cabangSaya.includes(k.split('|')[0])).reduce((a, [, v]) => a + v, 0)
  const menunggu = useMemo(() => (data.affidavit_kirim || [])
    .filter((k) => k.status === 'dalam_pengiriman' && cabangSaya.includes(k.cabang))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))), [data.affidavit_kirim, cabangSaya])
  const dalamJalan = menunggu.reduce((a, k) => a + (Number(k.lembar) || 0), 0)

  // ---- saringan
  const cocokSaring = (r) => saring === 'semua' || (saring === 'perlu' ? r.status.key !== 'cukup' : saring === 'habis' ? r.status.key === 'habis' : saring === 'rendah' ? r.status.key === 'rendah' : r.status.key === 'belum_diisi')
  const rows = useMemo(() => {
    const s = baris.filter((r) => (fCabang === 'Semua' || r.cabang === fCabang) && (fArah === 'Semua' || r.arah === fArah))
    const kol = KOLOM.find((c) => c.key === sortKey && c.sort)
    if (!kol) return s
    const arah = sortDir === 'asc' ? 1 : -1
    return [...s].sort((a, b) => { const x = kol.sort(a), y = kol.sort(b); return typeof x === 'number' && typeof y === 'number' ? (x - y) * arah : String(x).localeCompare(String(y), 'id') * arah })
  }, [baris, fCabang, fArah, sortKey, sortDir])
  const rowsSaring = useMemo(() => rows.filter(cocokSaring), [rows, saring]) // eslint-disable-line react-hooks/exhaustive-deps

  // kartu per cabang: urut paling genting (habis → rendah → belum → cukup), lalu sisa terkecil
  const kartu = useMemo(() => {
    const m = new Map()
    for (const r of rows) { if (!m.has(r.cabang)) m.set(r.cabang, []); m.get(r.cabang).push(r) }
    // urutan kartu: habis → rendah → belum diisi → cukup
    const peringkat = { habis: 0, rendah: 1, belum_diisi: 2, cukup: 3 }
    const skor = (list) => Math.min(...list.map((r) => peringkat[r.status.key] ?? 3))
    return [...m.entries()].map(([cabang, list]) => ({
      cabang, list: ARAH_AFFIDAVIT.map((a) => list.find((r) => r.arah === a.key)).filter(Boolean),
      rank: skor(list), sisa: list.reduce((a, r) => a + (r.sisa || 0), 0),
      nHabis: list.filter((r) => r.status.key === 'habis').length, nRendah: list.filter((r) => r.status.key === 'rendah').length,
      dikirim: list.reduce((a, r) => a + (r.dikirim || 0), 0),
      perlu: list.some((r) => r.status.key !== 'cukup'),
    })).filter((c) => saring === 'semua' || c.list.some(cocokSaring))
      .sort((a, b) => a.rank - b.rank || a.sisa - b.sisa || a.cabang.localeCompare(b.cabang))
  }, [rows, saring]) // eslint-disable-line react-hooks/exhaustive-deps

  const chips = [
    ['perlu', 'Perlu tindakan', nPerlu], ['semua', 'Semua', baris.length], ['habis', 'Habis', nHabis], ['rendah', 'Rendah', nRendah], ['belum', 'Belum diisi', nBelum],
  ]
  const Chip = ({ on, onClick, children, kelas }) => (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[11.5px] font-semibold ring-1 transition', on ? 'bg-[#1e3a5f] text-white ring-[#1e3a5f]' : 'bg-white text-[#1e3a5f] ring-[#c7d3e0] hover:ring-brand', kelas)}>{children}</button>
  )
  const panel = tab === 'stok' ? (
    <>
      {chips.map(([k, l, n]) => <Chip key={k} on={saring === k} onClick={() => setSaring(k)}>{l}<span className={cx('text-[10px] tabular-nums', saring === k ? 'text-slate-300' : 'text-ink-mute')}>{n}</span></Chip>)}
      <span className="hidden w-2 sm:block" />
      {pantau && (
        <select value={fCabang} onChange={(e) => setFCabang(e.target.value)} aria-label="Filter cabang" className="h-9 w-auto max-w-[46%] rounded-xl border-0 bg-white pl-2.5 pr-7 text-[11.5px] font-semibold text-[#1e3a5f] ring-1 ring-[#c7d3e0]">
          <option value="Semua">Semua cabang</option>{cabangSaya.map((b) => <option key={b}>{b}</option>)}
        </select>
      )}
      <select value={fArah} onChange={(e) => setFArah(e.target.value)} aria-label="Filter arah bahasa" className="h-9 w-auto max-w-[46%] rounded-xl border-0 bg-white pl-2.5 pr-7 text-[11.5px] font-semibold text-[#1e3a5f] ring-1 ring-[#c7d3e0]">
        <option value="Semua">Semua arah</option>{ARAH_AFFIDAVIT.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
      </select>
      {(fCabang !== 'Semua' || fArah !== 'Semua') && <button type="button" onClick={() => { setFCabang('Semua'); setFArah('Semua') }} className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[11.5px] font-semibold text-[#1e3a5f] hover:bg-white"><X className="h-3.5 w-3.5" />Reset</button>}
      <div className="ml-auto hidden h-9 items-center rounded-xl bg-white p-0.5 ring-1 ring-[#c7d3e0] md:flex" role="group" aria-label="Tampilan">
        {[['kartu', 'Kartu', LayoutGrid], ['tabel', 'Tabel', Table2], ['peta', 'Peta panas', Grid3X3]].map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => gantiMode(k)} aria-pressed={mode === k} className={cx('inline-flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[11px] font-bold', mode === k ? 'bg-[#1e3a5f] text-white' : 'text-[#1e3a5f] hover:bg-slate-50')}><I className="h-3.5 w-3.5" />{l}</button>
        ))}
      </div>
    </>
  ) : null

  const bukaKirim = (cabang, arah) => setKirim({ cabang: cabang || (fCabang === 'Semua' ? cabangSaya[0] : fCabang), arah: arah || (fArah === 'Semua' ? ARAH_AFFIDAVIT[0].key : fArah) })

  // ---- kartu cabang
  const KartuCabang = ({ c }) => {
    const nada = c.nHabis ? 'bg-rose-500' : c.nRendah ? 'bg-amber-500' : c.list.some((r) => r.status.key === 'belum_diisi') ? 'bg-slate-400' : 'bg-emerald-500'
    return (
      <Card className={cx('p-3', !c.perlu && 'opacity-90')} data-kartu-cabang={c.cabang}>
        <div className="mb-2 flex items-center gap-2">
          <span className={cx('h-2 w-2 shrink-0 rounded-full', nada)} />
          <b className="text-sm font-extrabold">{c.cabang}</b>
          {c.nHabis > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700">{c.nHabis} habis</span>}
          {!c.nHabis && c.nRendah > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">{c.nRendah} rendah</span>}
          {!c.nHabis && !c.nRendah && !c.list.some((r) => r.status.key === 'belum_diisi') && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">cukup</span>}
          {c.dikirim > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700">+{c.dikirim} dikirim</span>}
          <span className="ml-auto text-[11px] font-semibold text-ink-mute">sisa <b className="text-[13px] text-ink">{c.sisa}</b></span>
        </div>
        <div className="divide-y divide-slate-100">
          {c.list.map((r) => {
            const w = r.sisa == null ? 0 : Math.min(100, (r.sisa / SKALA) * 100)
            const warna = r.status.key === 'habis' ? 'bg-rose-500' : r.status.key === 'rendah' ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <div key={r.arah} className="grid grid-cols-[104px_minmax(0,1fr)_60px] items-center gap-2 py-1.5" data-arah={r.arah}>
                <div className="min-w-0"><b className="block text-[11.5px] font-bold text-ink-soft">{ARAH_PENDEK[r.arah]}</b><small className="block text-[10px] font-semibold text-ink-mute">{r.perHari ? `${fmt1(r.perHari)}/hari` : '—'}</small></div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100" title={`Ambang ${AMBANG_RENDAH} lembar`}>
                  <span className={cx('block h-full rounded-full', warna)} style={{ width: `${w}%` }} />
                  <span className="absolute bottom-0 top-0 w-0.5 bg-slate-300" style={{ left: '25%' }} />
                </div>
                <div className="text-right">
                  {r.sisa == null ? <b className="block text-sm text-ink-mute">–</b> : <b className={cx('block text-sm font-extrabold tabular-nums', r.status.key === 'habis' ? 'text-rose-600' : r.status.key === 'rendah' ? 'text-amber-700' : 'text-ink')}>{r.sisa}</b>}
                  <small className="block text-[9.5px] font-semibold text-ink-mute">{r.sisa == null ? 'belum diisi' : r.perkiraan || '—'}</small>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {boleh && <button type="button" onClick={() => bukaKirim(c.cabang, c.list.find((r) => r.status.key !== 'cukup')?.arah)} className={cx('inline-flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-bold', c.perlu ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-slate-200')}><Truck className="h-3.5 w-3.5" />Kirim</button>}
          {boleh && <button type="button" onClick={() => setIsiStok({ cabang: c.cabang, arah: c.list[0]?.arah, sisa: c.list[0]?.sisa, pilih: true })} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-[11px] font-bold text-ink-soft ring-1 ring-slate-200"><Pencil className="h-3.5 w-3.5" />Isi stok</button>}
          <button type="button" onClick={() => setRiwayat({ cabang: c.cabang })} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-[11px] font-bold text-ink-soft ring-1 ring-slate-200"><History className="h-3.5 w-3.5" />Riwayat</button>
        </div>
      </Card>
    )
  }

  // ---- peta panas
  const PetaPanas = ({ ringkas }) => (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2"><b className="text-sm font-extrabold">Peta panas sisa</b><span className="ml-auto text-[11px] text-ink-mute">lembar</span></div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `${ringkas ? 88 : 110}px repeat(4, minmax(0,1fr))` }}>
        <span />{ARAH_AFFIDAVIT.map((a) => <span key={a.key} className="text-center text-[10px] font-bold text-ink-mute">{ARAH_PENDEK[a.key]}</span>)}
        {[...new Set(rows.map((r) => r.cabang))].map((cab) => (
          <Fragment2 key={cab}>
            <span className="truncate text-[11.5px] font-bold text-ink-soft">{cab}</span>
            {ARAH_AFFIDAVIT.map((a) => {
              const r = rows.find((x) => x.cabang === cab && x.arah === a.key)
              const k = r?.status.key
              return (
                <button key={a.key} type="button" onClick={() => r && (boleh ? setIsiStok({ cabang: cab, arah: a.key, sisa: r.sisa }) : setRiwayat({ cabang: cab, arah: a.key }))}
                  title={`${cab} · ${a.label}`}
                  className={cx('grid h-9 place-items-center rounded-lg text-[12.5px] font-extrabold tabular-nums', k === 'cukup' ? 'bg-emerald-100 text-emerald-900' : k === 'rendah' ? 'bg-amber-200 text-amber-900' : k === 'habis' ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 font-semibold text-slate-400')}>
                  {r?.sisa == null ? '–' : r.sisa}
                </button>
              )
            })}
          </Fragment2>
        ))}
      </div>
    </Card>
  )

  const DaftarKirim = ({ penuh }) => (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2"><PackageCheck className="h-4 w-4 text-sky-600" /><b className="text-sm font-extrabold">Dalam pengiriman</b>{menunggu.length > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700">{menunggu.length}</span>}</div>
      {!menunggu.length ? <p className="text-xs text-ink-mute">Tidak ada kiriman yang menunggu konfirmasi.</p> : (
        <ul className="divide-y divide-slate-100">
          {menunggu.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
              <span className="min-w-0 flex-1"><b className="block font-bold text-ink">{k.cabang} · {ARAH_PENDEK[k.arah]}</b><small className="block text-[10.5px] text-ink-mute">dikirim {tanggal(k.at)} oleh {k.oleh}{k.catatan ? ` · ${k.catatan}` : ''}</small></span>
              <b className="text-sm font-extrabold tabular-nums">{k.lembar}</b>
              {penuh && <TerimaBtn kirim={k} onTerima={terimaPengiriman} notify={notify} />}
            </li>
          ))}
        </ul>
      )}
      {penuh && <p className="mt-2 text-[11px] text-ink-mute">Lembar ini belum masuk stok tersedia. Stok bertambah setelah cabang mengonfirmasi jumlah yang benar-benar diterima.</p>}
    </Card>
  )

  const topPakai = useMemo(() => Object.entries(pakai14).map(([k, v]) => { const [cabang, arah] = k.split('|'); return { cabang, arah, v } }).filter((x) => cabangSaya.includes(x.cabang)).sort((a, b) => b.v - a.v), [pakai14, cabangSaya])
  const DaftarPakai = ({ penuh }) => (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2"><b className="text-sm font-extrabold">Pemakaian {HARI_PAKAI} hari</b><span className="ml-auto text-[11px] text-ink-mute">{penuh ? `${terpakai14} lembar · ≈ ${fmt1(terpakai14 / HARI_PAKAI)}/hari` : 'terbanyak'}</span></div>
      {!topPakai.length ? <p className="text-xs text-ink-mute">Belum ada pemakaian tercatat {HARI_PAKAI} hari terakhir.</p> : (
        <ul className="divide-y divide-slate-100">
          {(penuh ? topPakai : topPakai.slice(0, 5)).map((x) => (
            <li key={`${x.cabang}|${x.arah}`} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 font-bold text-ink">{x.cabang} · {ARAH_PENDEK[x.arah]}</span>
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (x.v / (topPakai[0]?.v || 1)) * 100)}%` }} /></span>
              <b className="w-10 text-right text-sm font-extrabold tabular-nums">{x.v}</b>
              {penuh && <button type="button" onClick={() => setRiwayat({ cabang: x.cabang, arah: x.arah })} aria-label="Riwayat" className="grid h-9 w-9 place-items-center rounded-lg text-ink-mute hover:bg-slate-100"><History className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )

  const RiwayatSemua = () => {
    const pk = riwayatPakai(data.affidavit_pakai).filter((x) => cabangSaya.includes(x.cabang)).slice(0, 40)
    const kr = riwayatKirim(data.affidavit_kirim).filter((x) => cabangSaya.includes(x.cabang)).slice(0, 20)
    const semuaR = [...pk.map((x) => ({ ...x, jenis: 'pakai' })), ...kr.map((x) => ({ ...x, jenis: 'kirim' }))].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 50)
    return (
      <Card className="p-3">
        <b className="mb-2 block text-sm font-extrabold">Riwayat terbaru</b>
        {!semuaR.length ? <p className="text-xs text-ink-mute">Belum ada catatan.</p> : (
          <ul className="divide-y divide-slate-100">
            {semuaR.map((x) => (
              <li key={`${x.jenis}-${x.id}`} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-extrabold', x.jenis === 'pakai' ? 'bg-slate-100 text-ink-soft' : 'bg-sky-50 text-sky-700')}>{x.jenis === 'pakai' ? `−${x.lembar}` : `+${x.lembar_diterima ?? x.lembar}`}</span>
                <span className="min-w-0 flex-1"><b className="block font-bold text-ink">{x.cabang} · {ARAH_PENDEK[x.arah]}{x.invoice_no ? ` · ${String(x.invoice_no).replace(/^INV-/i, '')}` : ''}</b><small className="block text-[10.5px] text-ink-mute">{tanggalJam(x.at)} · {x.jenis === 'pakai' ? x.cs : `${x.status === 'diterima' ? 'diterima' : 'dalam pengiriman'} · ${x.oleh}`}{x.catatan ? ` · ${x.catatan}` : ''}</small></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    )
  }

  const Tabel = () => (
    !rowsSaring.length ? <Empty icon={FileStack} title="Tidak ada baris" text="Ubah saringan, cabang, atau arah bahasa." /> : (
      <Card className="overflow-hidden">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              {KOLOM.map((c) => (
                <th key={c.key} scope="col" style={{ width: c.w }} className={cx('h-9 whitespace-nowrap px-3 text-[11px] font-bold uppercase tracking-wide text-ink-mute', c.num ? 'text-right' : 'text-left')}>
                  {c.sort ? <button type="button" onClick={() => klikJudul(c.key)} className={cx('inline-flex items-center gap-1 hover:text-ink', c.num && 'w-full justify-end')}>{c.label}{sortKey === c.key && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button> : c.label}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {rowsSaring.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 align-middle last:border-0 hover:bg-brand-soft/30">
                  <td className="px-3 py-1.5 font-semibold text-ink">{r.cabang}</td>
                  <td className="px-3 py-1.5 text-ink-soft">{r.arahLabel}</td>
                  <td className="px-3 py-1.5 text-right"><Sisa n={r.sisa} /></td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">{r.perHari ? fmt1(r.perHari) : <span className="text-ink-mute">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">{r.perkiraan || <span className="text-ink-mute">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">{r.dikirim ? <span className="font-semibold text-sky-800">{r.dikirim}</span> : <span className="text-ink-mute">—</span>}</td>
                  <td className="px-3 py-1.5"><Status s={r.status} /></td>
                  <td className="px-3 py-1.5"><div className="flex items-center justify-end gap-0.5">
                    <button type="button" onClick={() => setRiwayat({ cabang: r.cabang, arah: r.arah })} aria-label={`Riwayat ${r.cabang} ${r.arahLabel}`} className="inline-grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 hover:text-ink md:h-[30px] md:w-[30px]"><History className="h-4 w-4" /></button>
                    {boleh && <button type="button" onClick={() => setIsiStok({ cabang: r.cabang, arah: r.arah, sisa: r.sisa })} aria-label={`Ubah stok ${r.cabang} ${r.arahLabel}`} className="inline-grid h-11 w-11 place-items-center rounded-lg text-brand hover:bg-brand-soft md:h-[30px] md:w-[30px]"><Pencil className="h-4 w-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  )

  const K = ({ v, l, s, tone }) => (
    <Card className="p-2.5 lg:p-3"><b className={cx('block text-xl font-extrabold leading-none tabular-nums lg:text-2xl', tone)}>{v}</b><span className="mt-1 block text-[10.5px] font-semibold text-ink-soft lg:text-[11.5px]">{l}</span>{s && <small className="hidden text-[10.5px] text-ink-mute lg:block">{s}</small>}</Card>
  )

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-3 p-3 sm:p-4" data-affidavit>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-ink"><FileStack className="h-5 w-5 text-brand" />Affidavit — Stok Lembar</h1>
          <p className="text-[11.5px] text-ink-soft">{pantau ? `${cabangSaya.length} cabang` : `Cabang ${cabangSaya.join(', ') || '—'}`} × 4 arah bahasa · ambang peringatan {AMBANG_RENDAH} lembar · stok berkurang otomatis setiap cetak</p>
        </div>
        {boleh && <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => setIsiStok({ cabang: cabangSaya[0], arah: ARAH_AFFIDAVIT[0].key, sisa: null, pilih: true })}><Pencil className="h-3.5 w-3.5" />Isi stok</Button>}
        {boleh && <Button size="sm" onClick={() => bukaKirim()}><Truck className="h-3.5 w-3.5" />Kirim</Button>}
      </div>

      <div className="grid grid-cols-4 gap-2 lg:grid-cols-6 lg:gap-3">
        <K v={total.toLocaleString('id-ID')} l="Total lembar" s={dalamJalan ? `+${dalamJalan} dalam perjalanan` : 'di cabang'} />
        <K v={nHabis} l="Habis" tone={nHabis ? 'text-rose-600' : ''} s={nHabis ? baris.filter((r) => r.status.key === 'habis').slice(0, 2).map((r) => `${r.cabang} ${ARAH_PENDEK[r.arah]}`).join(' · ') : 'tidak ada'} />
        <K v={nRendah} l={`Rendah (<${AMBANG_RENDAH})`} tone={nRendah ? 'text-amber-700' : ''} s={`${new Set(baris.filter((r) => r.status.key === 'rendah').map((r) => r.cabang)).size} cabang`} />
        <K v={menunggu.length} l="Dikirim" tone={menunggu.length ? 'text-sky-700' : ''} s="menunggu konfirmasi" />
        <div className="hidden lg:block"><K v={terpakai14} l={`Terpakai ${HARI_PAKAI} hari`} s={`≈ ${fmt1(terpakai14 / HARI_PAKAI)} lembar/hari`} /></div>
        <div className="hidden lg:block"><K v={nBelum} l="Belum diisi pusat" s="kombinasi cabang×arah" /></div>
      </div>

      <MapTabs tabs={TABS(menunggu.length)} aktif={tab} onPilih={setTab} ada={!!panel} setPanelEl={() => {}} panel={panel} label="Bagian affidavit" />

      {tab === 'stok' && (
        <>
          {menunggu.length > 0 && cabangSaya.length <= 2 && (
            <div className="space-y-2">{menunggu.map((k) => (
              <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-200">
                <Package className="h-5 w-5 shrink-0 text-sky-700" />
                <p className="min-w-0 flex-1 text-xs text-sky-900"><b>{k.cabang} · {ARAH_PENDEK[k.arah]} · {k.lembar} lembar</b><span className="block text-[11px] text-sky-700">dikirim pusat {tanggal(k.at)}{k.catatan ? ` · ${k.catatan}` : ''} · menunggu konfirmasi terima</span></p>
                <TerimaBtn kirim={k} onTerima={terimaPengiriman} notify={notify} />
              </div>
            ))}</div>
          )}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <div className="min-w-0">
              {mode === 'tabel' ? <Tabel /> : mode === 'peta' ? <PetaPanas /> : (
                !kartu.length ? <Empty icon={FileStack} title="Semua aman" text="Tidak ada stok yang perlu ditindak pada saringan ini." /> : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{kartu.map((c) => <KartuCabang key={c.cabang} c={c} />)}</div>
                )
              )}
              <p className="mt-2 text-[11px] text-ink-mute">Urutan kartu: cabang paling genting dulu (habis → rendah → cukup). Garis tipis di batang = ambang {AMBANG_RENDAH} lembar. "±N hari" = sisa ÷ rata-rata pemakaian {HARI_PAKAI} hari terakhir, dihitung dari catatan cetak.</p>
            </div>
            <div className="hidden space-y-3 lg:block">
              {pantau && mode !== 'peta' && <PetaPanas ringkas />}
              <DaftarKirim />
              <DaftarPakai />
            </div>
          </div>
        </>
      )}
      {tab === 'kirim' && <DaftarKirim penuh />}
      {tab === 'pakai' && <DaftarPakai penuh />}
      {tab === 'riwayat' && <RiwayatSemua />}

      {isiStok && <IsiStok s={isiStok} onClose={() => setIsiStok(null)} onSimpan={setStokAffidavit} notify={notify} cabangList={cabangSaya} stok={baris} />}
      {kirim && <KirimSheet s={kirim} cabangList={cabangSaya} onClose={() => setKirim(null)} onKirim={catatPengiriman} notify={notify} />}
      {riwayat && <RiwayatSheet s={riwayat} data={data} onClose={() => setRiwayat(null)} />}
    </div>
  )
}

const Fragment2 = ({ children }) => <>{children}</>

const KOLOM = [
  { key: 'cabang', label: 'Cabang', w: '18%', sort: (r) => r.cabang.toLowerCase() },
  { key: 'arah', label: 'Arah Bahasa', w: '22%', sort: (r) => r.arahLabel.toLowerCase() },
  { key: 'sisa', label: 'Sisa', w: '9%', num: true, sort: (r) => (r.sisa == null ? -1 : r.sisa) },
  { key: 'pakai', label: 'Pakai/hari', w: '10%', num: true, sort: (r) => r.perHari || 0 },
  { key: 'habis', label: 'Perkiraan', w: '11%', num: true, sort: (r) => (r.sisa == null ? 1e9 : r.perHari ? r.sisa / r.perHari : 1e8) },
  { key: 'dikirim', label: 'Dikirim', w: '9%', num: true, sort: (r) => r.dikirim || 0 },
  { key: 'status', label: 'Status', w: '13%', sort: (r) => r.status.rank },
  { key: 'aksi', label: 'Aksi', w: '8%' },
]

/** Konfirmasi terima — jumlah bisa dikoreksi bila yang sampai tidak sebanyak yang dikirim. */
function TerimaBtn({ kirim, onTerima, notify }) {
  const [buka, setBuka] = useState(false)
  const [n, setN] = useState(String(kirim.lembar))
  const [busy, setBusy] = useState(false)
  const jalan = async () => {
    setBusy(true)
    try { await onTerima(kirim, Number(n)); notify(`${n} lembar masuk stok cabang ${kirim.cabang}`); setBuka(false) }
    catch (e) { notify(e.message || 'Gagal mencatat', 'err') } finally { setBusy(false) }
  }
  if (!buka) return <Button size="sm" onClick={() => setBuka(true)}><Check className="h-3.5 w-3.5" />Konfirmasi Terima</Button>
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" min="1" max={kirim.lembar} value={n} onChange={(e) => setN(e.target.value)}
        aria-label="Jumlah lembar yang diterima" className="w-24" />
      <Button size="sm" loading={busy} onClick={jalan}><Check className="h-3.5 w-3.5" />Simpan</Button>
      <Button size="sm" variant="ghost" onClick={() => setBuka(false)}>Batal</Button>
    </div>
  )
}

function IsiStok({ s, onClose, onSimpan, notify, cabangList = [], stok = [] }) {
  const [cabang, setCabang] = useState(s.cabang)
  const [arah, setArah] = useState(s.arah)
  const sisaKini = s.pilih ? (stok.find((r) => r.cabang === cabang && r.arah === arah)?.sisa ?? null) : s.sisa
  const [v, setV] = useState(sisaKini == null ? '' : String(sisaKini))
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const simpan = async () => {
    setBusy(true)
    try {
      await onSimpan(cabang, arah, v === '' ? null : Number(v), catatan)
      notify(v === '' ? 'Stok dikembalikan ke "belum diisi"' : `Stok ${cabang} ${arahLabel(arah)} disetel ${v} lembar`)
      onClose()
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title="Tetapkan Stok Affidavit" subtitle={s.pilih ? 'Pilih cabang & arah, lalu isi sisa lembar' : `${s.cabang} · ${arahLabel(s.arah)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={busy} onClick={simpan}><Check className="h-4 w-4" />Simpan</Button></>}>
      <div className="space-y-3">
        {s.pilih && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cabang"><Select value={cabang} onChange={(e) => { setCabang(e.target.value); const r = stok.find((x) => x.cabang === e.target.value && x.arah === arah); setV(r?.sisa == null ? '' : String(r.sisa)) }}>{cabangList.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Arah bahasa"><Select value={arah} onChange={(e) => { setArah(e.target.value); const r = stok.find((x) => x.cabang === cabang && x.arah === e.target.value); setV(r?.sisa == null ? '' : String(r.sisa)) }}>{ARAH_AFFIDAVIT.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</Select></Field>
          </div>
        )}
        <Field label="Sisa lembar" hint="Kosongkan untuk mengembalikan ke status “belum diisi”.">
          <Input type="number" min="0" value={v} onChange={(e) => setV(e.target.value)} placeholder="mis. 200" aria-label="Sisa lembar" />
        </Field>
        <Field label="Catatan" hint="Opsional — mis. alasan koreksi stok.">
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. koreksi setelah hitung fisik" aria-label="Catatan" />
        </Field>
        <p className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 ring-1 ring-amber-200">
          Angka ini menimpa stok tersedia. Untuk <b>menambah</b> lembar yang dikirim ke cabang, pakai
          <b> Catat Pengiriman</b> supaya tercatat sebagai perjalanan dan cabang bisa mengonfirmasi.
        </p>
      </div>
    </Sheet>
  )
}

function KirimSheet({ s, cabangList, onClose, onKirim, notify }) {
  const [cabang, setCabang] = useState(s.cabang || cabangList[0] || '')
  const [arah, setArah] = useState(s.arah || ARAH_AFFIDAVIT[0].key)
  const [lembar, setLembar] = useState('100')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const jalan = async () => {
    setBusy(true)
    try { await onKirim({ cabang, arah, lembar: Number(lembar), catatan }); notify(`${lembar} lembar tercatat dalam pengiriman ke ${cabang}`); onClose() }
    catch (e) { notify(e.message || 'Gagal mencatat', 'err') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title="Catat Pengiriman Lembar" subtitle="Lembar masuk stok setelah cabang mengonfirmasi terima"
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={busy} onClick={jalan}><Truck className="h-4 w-4" />Catat</Button></>}>
      <div className="space-y-3">
        <Field label="Cabang tujuan" required>
          <Select value={cabang} onChange={(e) => setCabang(e.target.value)} aria-label="Cabang tujuan">
            {cabangList.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Arah bahasa" required>
          <Select value={arah} onChange={(e) => setArah(e.target.value)} aria-label="Arah bahasa">
            {ARAH_AFFIDAVIT.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Jumlah lembar" required>
          <Input type="number" min="1" value={lembar} onChange={(e) => setLembar(e.target.value)} aria-label="Jumlah lembar" />
        </Field>
        <Field label="Catatan" hint="Opsional — mis. nomor resi kurir.">
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. JNE 1234567890" aria-label="Catatan pengiriman" />
        </Field>
      </div>
    </Sheet>
  )
}

function RiwayatSheet({ s, data, onClose }) {
  const pakai = useMemo(() => riwayatPakai(data.affidavit_pakai, s).slice(0, 60), [data.affidavit_pakai, s])
  const kirim = useMemo(() => riwayatKirim(data.affidavit_kirim, s).slice(0, 30), [data.affidavit_kirim, s])
  return (
    <Sheet open onClose={onClose} title="Riwayat Affidavit" subtitle={s.arah ? `${s.cabang} · ${arahLabel(s.arah)}` : `${s.cabang} · semua arah`} wide
      footer={<Button variant="ghost" onClick={onClose}>Tutup</Button>}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Pemakaian ({pakai.length})</p>
          {!pakai.length ? <p className="text-xs text-ink-mute">Belum ada pemakaian tercatat.</p> : (
            <ul className="space-y-1.5">
              {pakai.map((x) => (
                <li key={x.id} className="rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
                  <p className="font-semibold text-ink">−{x.lembar} lembar{x.invoice_no ? ` · ${String(x.invoice_no).replace(/^INV-/i, '')}` : ''}</p>
                  <p className="text-ink-soft">{tanggalJam(x.at)} · {x.cs}{x.sub_title ? ` · ${x.sub_title}` : ''}{x.catatan ? ` · ${x.catatan}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Pengiriman ({kirim.length})</p>
          {!kirim.length ? <p className="text-xs text-ink-mute">Belum ada pengiriman tercatat.</p> : (
            <ul className="space-y-1.5">
              {kirim.map((x) => (
                <li key={x.id} className="rounded-xl bg-sky-50 p-3 text-xs ring-1 ring-sky-200">
                  <p className="font-semibold text-sky-900">
                    +{x.lembar_diterima ?? x.lembar} lembar · {x.status === 'diterima' ? 'Diterima' : 'Dalam pengiriman'}
                  </p>
                  <p className="text-sky-800">
                    dikirim {tanggalJam(x.at)} oleh {x.oleh}
                    {x.status === 'diterima' && x.diterima_at ? ` · diterima ${tanggalJam(x.diterima_at)} oleh ${x.diterima_oleh}` : ''}
                    {x.catatan ? ` · ${x.catatan}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  )
}
