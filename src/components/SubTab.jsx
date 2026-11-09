import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './ui.jsx'

// ============================================================
//  SUB-TAB "MAP BERTINGKAT"
//  Halaman induk (mis. Keuangan) menyediakan baris tab + panel di bawahnya.
//  Isi tab yang aktif menaruh saringannya ke panel lewat <SubTabs>, sehingga
//  jelas saringan itu milik tab yang aktif. Tab aktif berubah jadi "telinga
//  map" yang menyatu dengan panel (warna sama, sedikit lebih gelap dari tab
//  yang tidak aktif). Kalau isi tab tidak memasang <SubTabs>, panelnya tidak
//  muncul dan tabnya tampil seperti tab biasa.
// ============================================================

const Ctx = createContext(null)

/** Warna map: tab aktif + panel. */
export const MAP_BG = 'bg-[#dbe4ee]'

export function useSubTabHost() {
  const [el, setEl] = useState(null)
  const [n, setN] = useState(0)
  const register = useCallback((on) => setN((v) => Math.max(0, v + (on ? 1 : -1))), [])
  return { el, setEl, ada: n > 0, ctx: { el, register } }
}

export function SubTabProvider({ value, children }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Baris tab "map": tabs = [{key,label,n}], aktif, onPilih, ada (panel terisi?), panelRef, kanan (alat di kanan). */
export function MapTabs({ tabs, aktif, onPilih, ada, setPanelEl, kanan, label = 'Tab', panel, panelClass, children }) {
  return (
    <div data-map-tab>
      <div className="flex items-end gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 items-end gap-1.5 overflow-x-auto px-1 pt-1 [scrollbar-width:none]" role="tablist" aria-label={label}>
          {tabs.map((t) => {
            const on = aktif === t.key
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onPilih(t.key)} data-tab={t.key}
                className={cx('relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold transition',
                  on && ada ? cx('h-11 rounded-t-xl pb-1 text-[#1e3a5f]', MAP_BG)
                    : on ? 'mb-1 h-9 rounded-xl bg-ink text-white ring-1 ring-ink'
                      : 'mb-1 h-9 rounded-xl bg-white text-ink-soft ring-1 ring-slate-200 hover:ring-brand')}>
                {t.icon && <t.icon className="h-3.5 w-3.5" />}{t.label}
                {t.n > 0 && <span className={cx('rounded-full px-1.5 text-[10px] font-bold', on && ada ? 'bg-[#1e3a5f] text-white' : on ? 'bg-white text-ink' : t.tone === 'mute' ? 'bg-slate-100 text-ink-mute' : 'bg-rose-500 text-white')}>{t.n}</span>}
              </button>
            )
          })}
        </div>
        {kanan && <div className="mb-1 flex shrink-0 items-center gap-1.5">{kanan}</div>}
      </div>
      {/* Panel map: diisi lewat portal oleh <SubTabs> di dalam isi tab */}
      <div ref={setPanelEl} data-panel-map
        className={cx('-mt-px flex flex-wrap items-center gap-1.5 rounded-b-2xl rounded-tr-2xl px-2 py-2 empty:hidden', MAP_BG, panelClass)}>{panel}</div>
      {children}
    </div>
  )
}

/** Dipanggil dari isi tab: menaruh saringan ke panel map (atau inline kalau tidak ada panel). */
export function SubTabs({ children, className }) {
  const ctx = useContext(Ctx)
  useEffect(() => { if (!ctx?.register) return; ctx.register(true); return () => ctx.register(false) }, [ctx])
  if (ctx?.el) return createPortal(children, ctx.el)
  return <div className={cx('flex flex-wrap items-center gap-1.5', className)}>{children}</div>
}

/** Tombol sub-tab seragam (≥36px tinggi di HP). */
export function SubTabBtn({ on, onClick, n, children, className, ...p }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} {...p}
      className={cx('inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-semibold ring-1 transition',
        on ? 'bg-[#1e3a5f] text-white ring-[#1e3a5f]' : 'bg-white text-[#1e3a5f] ring-[#c7d3e0] hover:ring-brand', className)}>
      {children}{n !== undefined && <span className={cx('text-[10px] font-semibold', on ? 'text-slate-300' : 'text-ink-mute')}>{n}</span>}
    </button>
  )
}
