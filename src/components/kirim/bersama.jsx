import { useMemo, useState } from 'react'
import { Database, Upload, PenLine, FlaskConical } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { cx } from '../ui.jsx'
import { labelTahap, kelasTahap, AMBANG_BAWAAN, fmtWaktu } from '../../lib/kirim.js'

export function BadgeTahap({ tahap, className }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', kelasTahap(tahap), className)} data-tahap={tahap}>{labelTahap(tahap)}</span>
}

/** Penanda asal data — data manual/impor TIDAK pernah disebut real-time. */
export function BadgeSumber({ sumber, waktu }) {
  const s = String(sumber || 'Input manual')
  const Ik = /impor/i.test(s) ? Upload : /manual/i.test(s) ? PenLine : /demo|contoh|simulasi/i.test(s) ? FlaskConical : Database
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-mute" title={waktu ? `Diperbarui ${fmtWaktu(waktu)}` : 'Belum pernah diperbarui'}>
      <Ik className="h-3 w-3" aria-hidden="true" />{s}{waktu ? ` · ${fmtWaktu(waktu)}` : ''}
    </span>
  )
}

/** Data modul pengiriman, sudah disaring cabang aktif (RLS di server tetap pembatas utamanya). */
export function useKirim() {
  const { data, branchFilter } = useApp()
  return useMemo(() => {
    const cab = (r) => !branchFilter || branchFilter === 'Semua' || !r.cabang || r.cabang === branchFilter
    const setel = (data.app_settings || []).find((s) => s.key === 'kirim_setel') || null
    const sinkron = (data.app_settings || []).find((s) => s.key === 'kirim_sinkron') || null
    const alamatCabang = (data.app_settings || []).find((s) => s.key === 'alamat_kirim')?.cabang || {}
    return {
      kirim: (data.kirim || []).filter(cab),
      alamat: (data.kirim_alamat || []).filter(cab),
      templat: data.kirim_templat || [],
      kendala: (data.kirim_kendala || []).filter(cab),
      mutasi: data.kirim_mutasi || [],
      event: data.kirim_event || [],
      setel, ambang: { ...AMBANG_BAWAAN, ...(setel?.ambang || {}) }, sinkron, alamatCabang,
    }
  }, [data.kirim, data.kirim_alamat, data.kirim_templat, data.kirim_kendala, data.kirim_mutasi, data.kirim_event, data.app_settings, branchFilter])
}

export const Kotak = ({ className, ...p }) => <div {...p} className={cx('rounded-2xl bg-white p-3 ring-1 ring-[#E7E8F0] dark:bg-white/5 dark:ring-white/10', className)} />
export const Judul = ({ children, aside }) => <div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="mr-auto text-sm font-extrabold">{children}</h2>{aside}</div>
export const Catatan = ({ children }) => <p className="text-[11px] leading-relaxed text-ink-mute">{children}</p>

// ---------- Logo ekspedisi ----------
// Logo asli dari Everpro (dikirim bersama tarif). Disimpan per nama kurir agar bisa dipakai lagi
// di daftar/detail. Bila belum ada logo, tampil inisial berwarna (tidak menebak gambar).
const LOGO_KEY = 'atlas-kurir-logo'
const bacaLogo = () => { try { return JSON.parse(localStorage.getItem(LOGO_KEY)) || {} } catch { return {} } }
const kunciKurir = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function ingatLogo(list) {
  try { const m = bacaLogo(); let ubah = false; for (const t of list || []) if (t?.logo && t?.kurir && m[kunciKurir(t.kurir)] !== t.logo) { m[kunciKurir(t.kurir)] = t.logo; ubah = true } if (ubah) localStorage.setItem(LOGO_KEY, JSON.stringify(m)) } catch { /* abaikan */ }
}
const WARNA = ['#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#4B5563']
export function LogoKurir({ nama, logo, ukuran = 28, className }) {
  const src = logo || bacaLogo()[kunciKurir(nama)] || ''
  const [gagal, setGagal] = useState(false)
  const inisial = String(nama || '?').replace(/[^A-Za-z0-9& ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  const warna = WARNA[[...kunciKurir(nama)].reduce((a, c) => a + c.charCodeAt(0), 0) % WARNA.length]
  const gaya = { width: ukuran, height: ukuran }
  if (src && !gagal) return <span className={cx('inline-grid shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-slate-200', className)} style={gaya}><img src={src} alt={nama || 'kurir'} loading="lazy" className="max-h-full max-w-full object-contain p-0.5" onError={() => setGagal(true)} /></span>
  return <span className={cx('inline-grid shrink-0 place-items-center rounded-md text-[10px] font-extrabold text-white', className)} style={{ ...gaya, background: warna }} aria-label={nama} title={nama}>{inisial}</span>
}
