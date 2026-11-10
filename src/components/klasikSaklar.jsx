// Bagian kecil Mode Klasik yang selalu dimuat (saklar & status).
// Tampilan klasiknya sendiri (ModeKlasik.jsx) dimuat hanya saat dipakai.
import { useState, useSyncExternalStore } from 'react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { cx } from './ui.jsx'
import { kunciKlasik } from '../config/rilis.js'

/** Role yang boleh memakai Mode Klasik (bawaan; bisa diubah Superadmin di app_settings 'mode_klasik'). */
export const KLASIK_ROLES_BAWAAN = ['superadmin', 'direktur', 'supervisor', 'admin_pusat', 'cs', 'helper', 'akunting']
export const bolehKlasik = (user, data) => {
  const s = (data?.app_settings || []).find((r) => r.key === 'mode_klasik')
  const roles = s?.roles || KLASIK_ROLES_BAWAAN
  return !!user && roles.includes(user.base_role || user.role)
}

// ---- status klasik per pengguna (localStorage) + lebar layar ----
const kunci = (uid) => `atlas-mode-klasik:${uid}`
const subs = new Set()
const beritahu = () => subs.forEach((f) => f())
export function setKlasik(uid, on) { try { localStorage.setItem(kunci(uid), on ? '1' : '0') } catch { /* abaikan */ } beritahu() }
function bacaKlasik(uid) { try { return localStorage.getItem(kunci(uid)) === '1' } catch { return false } }
const subscribe = (f) => { subs.add(f); window.addEventListener('resize', f); return () => { subs.delete(f); window.removeEventListener('resize', f) } }
/** true bila pengguna memilih Mode Klasik (komputer & HP). */
// Tampilan paksa (ikon HP/PC di bar atas): 'hp' | 'pc' | null (= ikut lebar layar)
const KUNCI_TAMPILAN = 'atlas-klasik-tampilan'
export function bacaTampilan() { try { const v = localStorage.getItem(KUNCI_TAMPILAN); return v === 'hp' || v === 'pc' ? v : null } catch { return null } }
export function setTampilan(v) { try { if (v) localStorage.setItem(KUNCI_TAMPILAN, v); else localStorage.removeItem(KUNCI_TAMPILAN) } catch { /* abaikan */ } beritahu() }
// lebar layar asli (screen.width ikut dihitung, karena tampilan PC di HP memperlebar viewport)
const lebar = () => Math.min(window.innerWidth, window.screen?.width || window.innerWidth)
const hpAsli = () => lebar() < 768
export const useHp = () => useSyncExternalStore(subscribe, () => { const t = bacaTampilan(); return t ? t === 'hp' : hpAsli() })
/** HP & tablet (iPad): menu Mode Klasik pindah ke bawah layar. */
export const useLayarSentuh = () => useSyncExternalStore(subscribe, () => { const t = bacaTampilan(); return t ? t === 'hp' : lebar() < 1280 })
/** Ikon tukar tampilan HP ⇄ PC. Pilihan yang sama dengan bawaan layar menghapus paksaan. */
export const usePaksaHp = () => useSyncExternalStore(subscribe, () => bacaTampilan() === 'hp' && !hpAsli())
export const usePaksaPc = () => useSyncExternalStore(subscribe, () => bacaTampilan() === 'pc' && hpAsli())
export function tukarTampilan(sekarangHp) {
  const mau = sekarangHp ? 'pc' : 'hp'
  const bawaan = hpAsli() ? 'hp' : 'pc'
  setTampilan(mau === bawaan ? null : mau)
}
export function useKlasik(user, data) {
  const on = useSyncExternalStore(subscribe, () => !!user && bacaKlasik(user._actor || user.id))
  // Rilis bertahap: tim dikunci di Mode Klasik (Superadmin & Direktur tetap bebas)
  return (on || kunciKlasik(user)) && bolehKlasik(user, data)
}

export async function layarPenuh(on) {
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    if (!on && document.fullscreenElement) await document.exitFullscreen?.()
  } catch { /* browser menolak — abaikan */ }
}

/** Saklar Klasik / Baru. tema 'gelap' untuk header. */
export function SaklarMode({ klasik, className, selalu }) {
  const { user, data } = useApp()
  const [tanya, setTanya] = useState(false)
  const [full, setFull] = useState(true)
  if (!bolehKlasik(user, data) || kunciKlasik(user)) return null
  const pilih = (k) => {
    if (k === klasik) return
    if (k) setTanya(true)
    else { setKlasik(user._actor || user.id, false); layarPenuh(false) }
  }
  return (
    <>
      <span className={cx('shrink-0 items-center rounded-full bg-white/10 p-1 text-xs font-bold', selalu ? 'flex' : 'hidden lg:flex', className)} role="group" aria-label="Mode tampilan" data-saklar-mode>
        <button type="button" onClick={() => pilih(true)} aria-pressed={klasik} className={cx('min-h-[30px] rounded-full px-3', klasik ? 'bg-amber-400 text-ink' : 'opacity-70 hover:opacity-100')}>Klasik</button>
        <button type="button" onClick={() => pilih(false)} aria-pressed={!klasik} className={cx('min-h-[30px] rounded-full px-3', !klasik ? 'bg-white text-ink' : 'opacity-70 hover:opacity-100')}>Baru</button>
      </span>
      {tanya && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/50 p-4 text-ink" role="dialog" aria-modal="true" aria-label="Pindah ke Mode Klasik">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-bold">Pindah ke Mode Klasik?</p>
                        <label className="mt-3 hidden items-center gap-2 text-[13px] md:flex"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="h-4 w-4 rounded" />Buka langsung layar penuh</label>
            <div className="mt-4 flex gap-2">
              <button type="button" data-aksi="ya-klasik" onClick={() => { setKlasik(user._actor || user.id, true); setTanya(false); if (full && window.innerWidth >= 768) layarPenuh(true); go('projects') }} className="h-11 flex-1 rounded-lg bg-ink text-sm font-bold text-white">Ya, Mode Klasik</button>
              <button type="button" onClick={() => setTanya(false)} className="h-11 rounded-lg px-4 text-sm font-semibold ring-1 ring-slate-200">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

