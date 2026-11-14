import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Download, Share, PlusSquare, Check } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { MODE } from '../lib/db.js'
import { changelogUntuk, VERSI_TERBARU } from '../config/changelog.js'
import { Button, Sheet, cx } from './ui.jsx'
import { tgl } from '../lib/format.js'

// ============================================================
//  "YANG BARU DI ATLAS" (catatan versi) + "PASANG APLIKASI" (PWA)
// ============================================================

const kunci = (u) => `atlas-yangbaru:${u?.id || 'x'}`
const bacaDibaca = (u) => { try { return Number(localStorage.getItem(kunci(u))) || 0 } catch { return VERSI_TERBARU } }
const tandaiDibaca = (u) => { try { localStorage.setItem(kunci(u), String(VERSI_TERBARU)) } catch { /* abaikan */ } }

// ---- event pembuka dari menu profil ----
const BUKA = 'atlas-buka-yangbaru'
export const bukaYangBaru = () => window.dispatchEvent(new Event(BUKA))

/** Popup otomatis sekali per versi per pengguna; bisa dibuka lagi dari menu profil. */
export default function YangBaru() {
  const { user } = useApp()
  const [buka, setBuka] = useState(false)
  const [lama, setLama] = useState(0)
  const daftar = useMemo(() => changelogUntuk(user), [user])
  useEffect(() => {
    if (!user || user._hantu) return
    const d = bacaDibaca(user)
    // Pengguna baru (belum pernah buka) → tidak dibanjiri riwayat: tandai saja.
    if (!d) { tandaiDibaca(user); return }
    if (d < VERSI_TERBARU && daftar.some((e) => e.id > d)) { setLama(d); setBuka(true) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => { setLama(bacaDibaca(user)); setBuka(true) }; window.addEventListener(BUKA, f); return () => window.removeEventListener(BUKA, f) }, [user])
  const tutup = () => { tandaiDibaca(user); setBuka(false) }
  if (!buka) return null
  return (
    <Sheet open onClose={tutup} title="Yang baru di ATLAS" subtitle="Perubahan terbaru untuk Anda"
      footer={<Button onClick={tutup} data-aksi="saya-mengerti"><Check className="h-4 w-4" />Oke, mengerti</Button>}>
      <ol className="space-y-4" data-yang-baru>
        {daftar.map((e) => {
          const baru = e.id > lama
          return (
            <li key={e.id} className={cx('rounded-2xl p-3 ring-1', baru ? 'bg-brand-soft/40 ring-brand/30' : 'ring-slate-200')}>
              <p className="flex flex-wrap items-center gap-2">
                {baru && <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-bold text-white"><Sparkles className="h-3 w-3" aria-hidden="true" />Baru</span>}
                <b className="text-sm text-ink">{e.judul}</b>
                <span className="ml-auto text-[11px] text-ink-mute">{tgl(e.tanggal)}</span>
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-ink-soft">
                {e.poin.map((p, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-mute" />{p.teks}</li>)}
              </ul>
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

// ---------------- PWA ----------------
let tundaPasang = null
const pendengar = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); tundaPasang = e; pendengar.forEach((f) => f()) })
  window.addEventListener('appinstalled', () => { tundaPasang = null; pendengar.forEach((f) => f()) })
}
export const sudahTerpasang = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
const iOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Daftarkan service worker (live saja — demo/artifact tidak). */
export function daftarSW() {
  if (MODE === 'demo' || !import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}) })
}

const PANDUAN = 'atlas-panduan-pasang'
/** Dipanggil dari menu profil: munculkan dialog pasang bawaan browser, atau panduan bila tidak tersedia (iPhone, demo). */
export async function pasangAplikasi() {
  if (tundaPasang) { const t = tundaPasang; tundaPasang = null; t.prompt(); try { await t.userChoice } catch { /* abaikan */ } pendengar.forEach((f) => f()); return }
  window.dispatchEvent(new Event(PANDUAN))
}

/** Panduan pasang (dipasang sekali di App). */
export function PanduanPasang() {
  const [buka, setBuka] = useState(false)
  useEffect(() => { const f = () => setBuka(true); window.addEventListener(PANDUAN, f); return () => window.removeEventListener(PANDUAN, f) }, [])
  if (!buka) return null
  return (
    <Sheet open onClose={() => setBuka(false)} title="Pasang ATLAS di perangkat ini" footer={<Button onClick={() => setBuka(false)}>Tutup</Button>}>
      <div className="space-y-3 text-sm text-ink-soft" data-panduan-pasang>
        {iOS() ? (
          <ol className="list-decimal space-y-2 pl-5">
            <li>Buka ATLAS di <b>Safari</b>.</li>
            <li>Ketuk tombol <b>Bagikan</b> <Share className="inline h-4 w-4" aria-label="ikon bagikan" /> di bawah layar.</li>
            <li>Pilih <b>Tambah ke Layar Utama</b> <PlusSquare className="inline h-4 w-4" aria-label="ikon tambah" />, lalu <b>Tambah</b>.</li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-2 pl-5">
            <li>Buka ATLAS di <b>Google Chrome</b> atau <b>Microsoft Edge</b>.</li>
            <li>Klik ikon <b>Pasang</b> <Download className="inline h-4 w-4" aria-label="ikon pasang" /> di ujung kanan kolom alamat, atau menu <b>⋮ → Pasang aplikasi / Install ATLAS</b>.</li>
            <li>Di HP Android: menu <b>⋮ → Tambahkan ke layar utama</b>.</li>
          </ol>
        )}
        <p className="text-xs text-ink-mute">Setelah terpasang, ATLAS punya ikon sendiri dan terbuka penuh tanpa bilah browser. Data tetap sama — login seperti biasa.</p>
        {MODE === 'demo' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Ini versi demo — pemasangan berlaku di ATLAS live (app.247translator.id).</p>}
      </div>
    </Sheet>
  )
}
