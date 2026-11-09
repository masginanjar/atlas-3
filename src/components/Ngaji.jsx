import { useEffect, useMemo, useState } from 'react'
import { BookOpenText, Check, ChevronLeft, ChevronRight, Minus, Plus, Flame, Trophy, Loader2 } from 'lucide-react'
import '@fontsource/scheherazade-new/arabic-400.css'
import '@fontsource/scheherazade-new/arabic-700.css'
import { useApp } from '../lib/store.jsx'
import { Card, cx } from './ui.jsx'
import INDEKS from '../config/quranIndeks.json' // [[no, nama latin, jumlah ayat], …]

// ============================================================
//  MENGAJI — tiap orang membaca Al-Qur'an berurutan dari Al-Fatihah:1.
//  "Sudah baca" mencatat 1 ayat dan pindah ke ayat berikutnya.
//  Progres disimpan di baris users (doc.ngaji) supaya Superadmin bisa
//  memantau di Monitoring. Teks Utsmani + terjemahan Kemenag (quran-json,
//  CC-BY-4.0), dimuat per surah dari ./quran/<no>.json saat dibutuhkan.
// ============================================================

export const TOTAL_AYAT = 6236
const FONT_QURAN = '"Scheherazade New", "LPMQ Isep Misbah", "Amiri", "Noto Naskh Arabic", serif'
const ZOOM = [22, 26, 30, 36, 42, 50]
const tglWita = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)
const cache = new Map()
async function muatSurah(n) {
  if (cache.has(n)) return cache.get(n)
  const p = fetch(`./quran/${n}.json`).then((r) => { if (!r.ok) throw new Error('Gagal memuat surah'); return r.json() })
  cache.set(n, p); p.catch(() => cache.delete(n)); return p
}
/** Urutan ayat global (1…6236) → posisi. */
export const nomorGlobal = (s, a) => INDEKS.slice(0, s - 1).reduce((t, x) => t + x[2], 0) + a
const berikut = (s, a) => (a < INDEKS[s - 1][2] ? [s, a + 1] : s < 114 ? [s + 1, 1] : [1, 1])
const sebelum = (s, a) => (a > 1 ? [s, a - 1] : s > 1 ? [s - 1, INDEKS[s - 2][2]] : [114, INDEKS[113][2]])

/** Statistik mengaji seseorang dalam rentang tanggal (YYYY-MM-DD). */
export function statNgaji(u, from, to) {
  const g = u?.ngaji || {}
  const harian = g.harian || {}
  const dalam = Object.entries(harian).filter(([d]) => (!from || d >= from) && (!to || d <= to)).reduce((t, [, n]) => t + (Number(n) || 0), 0)
  return { total: Number(g.total) || 0, dalam, s: g.s || 1, a: g.a || 1, at: g.at || null, hari: Object.keys(harian).filter((d) => (!from || d >= from) && (!to || d <= to)).length }
}
const beruntun = (harian = {}) => {
  let n = 0; const d = new Date()
  if (!harian[tglWita(d)]) d.setDate(d.getDate() - 1)
  while (harian[tglWita(d)]) { n += 1; d.setDate(d.getDate() - 1) }
  return n
}

/** Kartu mengaji di Beranda. */
export function KartuNgaji() {
  const { user, data, save, notify } = useApp()
  const saya = data.users.find((u) => u.id === user.id) || user
  const g = saya.ngaji || {}
  const [pos, setPos] = useState([g.s || 1, g.a || 1]) // ayat yang sedang dilihat
  useEffect(() => { setPos([g.s || 1, g.a || 1]) }, [g.s, g.a]) // eslint-disable-line react-hooks/exhaustive-deps
  const [surah, setSurah] = useState(null)
  const [gagal, setGagal] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [zoom, setZoomRaw] = useState(() => { const v = Number(localStorage.getItem('atlas-ngaji-zoom')); return ZOOM.includes(v) ? v : 30 })
  const setZoom = (d) => { const i = Math.max(0, Math.min(ZOOM.length - 1, ZOOM.indexOf(zoom) + d)); setZoomRaw(ZOOM[i]); try { localStorage.setItem('atlas-ngaji-zoom', String(ZOOM[i])) } catch { /* abaikan */ } }
  useEffect(() => { let hidup = true; setGagal(''); muatSurah(pos[0]).then((x) => hidup && setSurah(x)).catch((e) => hidup && setGagal(e.message)); return () => { hidup = false } }, [pos[0]]) // eslint-disable-line react-hooks/exhaustive-deps
  const ayat = surah?.n === pos[0] ? surah.ayat[pos[1] - 1] : null
  const posisiSaya = pos[0] === (g.s || 1) && pos[1] === (g.a || 1)
  const hariIni = tglWita()
  const nHariIni = Number(g.harian?.[hariIni]) || 0
  const total = Number(g.total) || 0
  const runtun = beruntun(g.harian)

  const sudahBaca = async () => {
    setSibuk(true)
    try {
      const [s, a] = berikut(g.s || 1, g.a || 1)
      const harian = { ...(g.harian || {}), [hariIni]: nHariIni + 1 }
      // simpan maksimal 400 hari terakhir supaya baris users tidak membengkak
      const kunci = Object.keys(harian).sort(); while (kunci.length > 400) delete harian[kunci.shift()]
      await save('users', { ...saya, ngaji: { s, a, total: total + 1, harian, at: new Date().toISOString() } })
    } catch (e) { notify(e.message, 'err') } finally { setSibuk(false) }
  }

  const [ns, na] = pos
  return (
    <Card className="p-3.5" data-ngaji>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700"><BookOpenText className="h-4 w-4" /></span>
        <b className="text-[13px] font-extrabold">Mengaji</b>
        <span className="min-w-0 truncate text-[11px] font-semibold text-ink-mute">QS. {INDEKS[ns - 1][1]} ({ns}): {na}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1" aria-label="Ukuran huruf Arab">
          <button type="button" onClick={() => setZoom(-1)} disabled={zoom === ZOOM[0]} aria-label="Perkecil huruf" className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-ink-soft hover:bg-slate-200 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
          <button type="button" onClick={() => setZoom(1)} disabled={zoom === ZOOM[ZOOM.length - 1]} aria-label="Perbesar huruf" className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-ink-soft hover:bg-slate-200 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        </span>
      </div>
      <div className="min-h-[96px]">
        {gagal ? <p className="py-6 text-center text-xs text-rose-600">{gagal}</p>
          : !ayat ? <p className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></p>
            : (<>
              {na === 1 && ns !== 1 && ns !== 9 && <p dir="rtl" lang="ar" className="mb-1 text-center text-ink-soft" style={{ fontFamily: FONT_QURAN, fontSize: Math.round(zoom * 0.8) }}>بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</p>}
              <p dir="rtl" lang="ar" className="text-right text-ink" style={{ fontFamily: FONT_QURAN, fontSize: zoom, lineHeight: 2.1 }} data-ayat-arab>
                {ayat[0]} <span className="whitespace-nowrap text-violet-700">﴿{na.toLocaleString('ar-EG')}﴾</span>
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft lg:text-sm">“{ayat[1]}”</p>
            </>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPos(sebelum(ns, na))} aria-label="Ayat sebelumnya" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-ink-soft hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
        {posisiSaya ? (
          <button type="button" onClick={sudahBaca} disabled={sibuk || !ayat} data-aksi="sudah-baca-ayat"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-xs font-extrabold text-white shadow-sm hover:brightness-110 disabled:opacity-60">
            {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Sudah baca, lanjut
          </button>
        ) : (
          <button type="button" onClick={() => setPos([g.s || 1, g.a || 1])} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-4 text-xs font-extrabold text-violet-700">Kembali ke bacaan saya</button>
        )}
        <button type="button" onClick={() => setPos(berikut(ns, na))} aria-label="Ayat berikutnya" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-ink-soft hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        <span className="ml-auto text-right text-[11px] leading-tight text-ink-mute">
          <b className="text-ink">{nHariIni}</b> ayat hari ini · total <b className="text-ink">{total.toLocaleString('id-ID')}</b>
          {runtun > 0 && <span className="block font-bold text-amber-700"><Flame className="mr-0.5 inline h-3.5 w-3.5" />{runtun} hari berturut</span>}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" title={`Ayat ke-${nomorGlobal(g.s || 1, g.a || 1)} dari ${TOTAL_AYAT.toLocaleString('id-ID')}`}>
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(0.5, ((nomorGlobal(g.s || 1, g.a || 1) - 1) / TOTAL_AYAT) * 100)}%` }} />
      </div>
      <p className="mt-1 text-[10.5px] text-ink-mute">Khatam {(((nomorGlobal(g.s || 1, g.a || 1) - 1) / TOTAL_AYAT) * 100).toFixed(1)}% · ayat ke-{nomorGlobal(g.s || 1, g.a || 1).toLocaleString('id-ID')} dari {TOTAL_AYAT.toLocaleString('id-ID')} · Terjemahan Kemenag</p>
    </Card>
  )
}

/** Monitoring mengaji (Superadmin): juara 1–3 dan yang paling sedikit, dalam rentang tanggal. */
export function MonitorNgaji({ range }) {
  const { data } = useApp()
  const rows = useMemo(() => (data.users || []).filter((u) => u.active !== false && !['penerjemah', 'proofreader', 'otorisator'].includes(u.role))
    .map((u) => ({ u, ...statNgaji(u, range?.from, range?.to) }))
    .sort((a, b) => b.dalam - a.dalam || b.total - a.total), [data.users, range])
  const maks = Math.max(1, ...rows.map((r) => r.dalam))
  const juara = rows.slice(0, 3)
  const sedikit = [...rows].reverse().slice(0, 3)
  const MEDALI = ['🥇', '🥈', '🥉']
  const Bar = ({ r, i, tone }) => (
    <li className="flex items-center gap-2.5" data-ngaji-baris={r.u.id}>
      <span className="w-6 shrink-0 text-center text-base">{i != null ? MEDALI[i] : '·'}</span>
      <span className="w-32 shrink-0 truncate text-[12.5px] font-semibold sm:w-40" title={r.u.name}>{r.u.name}</span>
      <span className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-lg bg-slate-100">
        <span className={cx('absolute inset-y-0 left-0 rounded-lg', tone)} style={{ width: `${Math.max(2, (r.dalam / maks) * 100)}%` }} />
        <span className="relative z-[1] flex h-full items-center px-2 text-[11px] font-bold text-ink">{r.dalam} ayat</span>
      </span>
      <span className="hidden w-28 shrink-0 text-right text-[11px] text-ink-mute sm:block">{r.hari} hari · total {r.total}</span>
    </li>
  )
  return (
    <Card className="p-4" data-monitor-ngaji>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-700"><Trophy className="h-4 w-4" /></span>
        <h2 className="text-sm font-extrabold">Monitoring Mengaji</h2>
        <span className="text-[11px] text-ink-mute">jumlah ayat dibaca pada rentang di atas · {rows.filter((r) => r.dalam > 0).length} dari {rows.length} orang aktif mengaji</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Juara 1–3</p>
          <ul className="space-y-2">{juara.map((r, i) => <Bar key={r.u.id} r={r} i={i} tone={['bg-amber-300', 'bg-slate-300', 'bg-orange-300'][i]} />)}</ul>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-rose-700">Paling sedikit</p>
          <ul className="space-y-2">{sedikit.map((r) => <Bar key={r.u.id} r={r} tone="bg-rose-200" />)}</ul>
        </div>
      </div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-xs font-bold text-ink-soft">Semua orang ({rows.length})</summary>
        <ul className="mt-2 space-y-1.5">{rows.map((r, i) => <Bar key={r.u.id} r={r} i={i < 3 ? i : null} tone="bg-violet-200" />)}</ul>
      </details>
    </Card>
  )
}
