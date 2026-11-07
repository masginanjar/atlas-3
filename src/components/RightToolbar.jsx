import { useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx } from './ui.jsx'
import { usePanel, PANELS, PANEL_ORDER } from './WorkspacePanel.jsx'
import { CHAT_ENABLED } from '../lib/flags.js'
import { go } from '../lib/router.js'

// ============================================================
//  TOOLBAR TEGAK DI TEPI KANAN — pola Zoho.
//  Ikon aksi cepat dipindahkan ke sini dari header. Panel fitur
//  terbuka di SEBELAH KIRI toolbar (lihat --railw di index.css),
//  jadi toolbar tetap terlihat dan bisa diganti isinya.
// ============================================================

/** Ikon tunggal: area klik nyaman, tooltip, badge, dan penanda sedang aktif. */
function Ikon({ icon: Icon, label, active, badge, onClick, innerRef }) {
  return (
    <button type="button" ref={innerRef} onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={cx('relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active
          ? 'bg-brand text-white shadow-sm'
          : 'text-ink-mute hover:bg-white hover:text-brand')}>
      <Icon className="h-[18px] w-[18px]" />
      {badge > 0 && (
        <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

export default function RightToolbar() {
  const { user, chatTotals } = useApp()
  const { panel, open, close } = usePanel()
  const [busy, setBusy] = useState('')
  // Fokus dikembalikan ke ikon yang membuka panel, supaya pengguna keyboard
  // tidak tersesat setelah panel ditutup. Halaman di belakang tidak dimuat
  // ulang, jadi filter dan posisi gulir tetap seperti semula.
  const tombol = useRef({})
  const terakhir = useRef(null)
  const adaPanel = !!panel
  useEffect(() => {
    if (adaPanel) return
    const el = terakhir.current && tombol.current[terakhir.current]
    if (el && document.activeElement === document.body) el.focus()
  }, [adaPanel])

  const items = PANEL_ORDER.map((k) => [k, PANELS[k]]).filter(([, p]) => p.allow(user))

  // Klik ikon yang sedang aktif = tutup panel; klik ikon lain = ganti isi panel
  // (PanelProvider yang menjaga isian yang belum disimpan).
  // Project Baru dibuka sebagai HALAMAN PENUH, bukan panel geser —
  // formnya panjang dan lebih enak dibaca selebar layar.
  const HALAMAN = { project: 'projects/new' }

  const pilih = async (k) => {
    setBusy(k); terakhir.current = k
    try {
      if (HALAMAN[k]) { if (panel) await close(); go(HALAMAN[k]); return }
      if (panel?.kind === k) await close(); else await open(k)
    } finally { setBusy('') }
  }

  return (
    <aside aria-label="Aksi cepat"
      style={{ width: 'var(--railw)' }}
      className="fixed right-0 top-[var(--appbar)] z-[90] hidden h-[calc(100dvh-var(--appbar))] flex-col items-center gap-1 border-l border-slate-200 bg-slate-50/95 py-2 backdrop-blur-sm md:flex">
      {items.map(([k, p]) => (
        <Ikon key={k} icon={p.icon} label={p.tip} active={HALAMAN[k] ? false : panel?.kind === k}
          innerRef={(el) => { tombol.current[k] = el }} onClick={() => !busy && pilih(k)} />
      ))}
      {CHAT_ENABLED && (
        <>
          <span className="my-1 h-px w-6 bg-slate-200" />
          <Ikon icon={MessageCircle} label="Pesan Masuk" badge={chatTotals?.msg || 0}
            onClick={() => go('pesan')} />
        </>
      )}
    </aside>
  )
}
