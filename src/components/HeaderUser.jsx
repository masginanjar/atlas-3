import PindahBooks from './PindahBooks.jsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { UserRound, MessageSquareDot, BellOff, SlidersHorizontal, Palette, HelpCircle, LogOut, Check, ChevronRight, Sun, Moon } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { roleLabel, placeOf, isMultiBranch, branchesOf, isFreelance } from '../config/access.js'
import { statusOf, STATUS } from '../lib/presence.js'
import { readTheme, applyTheme } from './ThemePicker.jsx'
import Avatar from './Avatar.jsx'
import { cx } from './ui.jsx'

const STATUS_PRESETS = ['Sedang fokus', 'Sedang meeting', 'Di luar kantor', 'Siap dihubungi']
const MUTES = [['30', '30 menit'], ['60', '1 jam'], ['240', '4 jam'], ['today', 'Sampai besok pagi'], ['off', 'Nyalakan lagi']]

/** Menu profil di pojok kanan atas: status, senyap, preferensi, tema, bantuan, keluar. */
export default function HeaderUser({ atas, rel, lebar } = {}) {
  const { user, data, updateProfile, signOut, notify } = useApp()
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState('') // '', 'status', 'mute', 'theme'
  const [draft, setDraft] = useState('')
  const box = useRef(null)
  const btn = useRef(null)
  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)

  const row = data.users.find((u) => u.id === user.id) || user
  const st = STATUS[statusOf(row)] || STATUS.offline
  const muted = row.mute_until && new Date(row.mute_until).getTime() > Date.now()

  useEffect(() => {
    if (!open) return
    const away = (e) => { if (box.current && !box.current.contains(e.target) && !(menuRef.current && menuRef.current.contains(e.target))) { setOpen(false); setSub('') } }
    const key = (e) => {
      if (e.key === 'Escape') { if (sub) setSub(''); else { setOpen(false); btn.current?.focus() } }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...((menuRef.current || box.current)?.querySelectorAll('[data-menu-item]:not(:disabled)') || [])]
        if (!items.length) return
        e.preventDefault()
        const i = items.indexOf(document.activeElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }
    document.addEventListener('mousedown', away); window.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', key) }
  }, [open, sub])

  const setStatus = async (text) => {
    try { await updateProfile({ status_text: text }); notify(text ? `Status: ${text}` : 'Status dihapus') } catch (e) { notify(e.message, 'err') }
    setSub(''); setOpen(false)
  }
  const setMute = async (v) => {
    let until = null
    if (v === 'today') { const d = new Date(); d.setHours(24, 0, 0, 0); until = d.toISOString() }
    else if (v !== 'off') until = new Date(Date.now() + Number(v) * 60000).toISOString()
    try { await updateProfile({ mute_until: until }); notify(until ? 'Notifikasi disenyapkan' : 'Notifikasi aktif lagi', 'ok', 'security') } catch (e) { notify(e.message, 'err') }
    setSub(''); setOpen(false)
  }
  const setTheme = (mode) => {
    const next = { ...readTheme(), mode }
    applyTheme(next); try { localStorage.setItem('atlas-theme', JSON.stringify(next)) } catch { /* abaikan */ }
    setSub('')
  }

  const Item = ({ icon: Icon, children, onClick, href, danger, right }) => {
    const cls = cx('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      danger ? 'text-rose-600 hover:bg-rose-50' : 'text-ink hover:bg-slate-50')
    const inner = <><Icon className={cx('h-4 w-4 shrink-0', danger ? 'text-rose-500' : 'text-ink-mute')} /><span className="min-w-0 flex-1 truncate">{children}</span>{right}</>
    return href
      ? <a data-menu-item href={href} className={cls} onClick={() => setOpen(false)}>{inner}</a>
      : <button data-menu-item type="button" className={cls} onClick={onClick}>{inner}</button>
  }

  return (
    <div className="relative" ref={box}>
      <button ref={btn} type="button" onClick={() => {
          // Di menu samping: menu profil dibuka di lapisan teratas (tidak tertutup / bocor isi sidebar)
          if (atas && btn.current) { const r = btn.current.getBoundingClientRect(); setPos(rel ? { left: r.right + 10, bottom: Math.max(8, window.innerHeight - r.bottom) } : { left: r.left, bottom: window.innerHeight - r.top + 6, width: 272 }) }
          setOpen((v) => !v); setSub('')
        }} aria-expanded={open} aria-haspopup="menu"
        aria-label={`Profil ${user.display_name || user.name}`} title={user.display_name || user.name}
        className={cx('flex h-11 min-w-11 items-center gap-2 rounded-xl p-1 ring-1 transition', lebar ? 'w-full pr-2' : rel ? '' : 'pr-2', open ? 'bg-ink/5 ring-ink/20' : 'ring-transparent hover:bg-white hover:ring-slate-200 dark:hover:bg-white/10')} data-tombol-profil>
        <span className="relative">
          <Avatar user={row} size={30} ring={false} className="ring-1 ring-slate-200" />
          <span className={cx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', st.dot)} />
        </span>
        <span className={cx('min-w-0 text-left', rel ? 'hidden' : lebar ? 'block flex-1' : 'hidden lg:block')}>
          <span className="block max-w-[150px] truncate text-[12px] font-bold leading-tight text-ink">{(user.display_name || user.name).replace(/\s*\([^)]*\)/g, '')}</span>
          <span className="block max-w-[150px] truncate text-[10px] leading-tight text-ink-mute">{roleLabel(user)}</span>
        </span>
      </button>

      {open && (atas && pos ? (m) => createPortal(m, document.body) : (m) => m)(
        <div ref={menuRef} role="menu" aria-label="Menu profil" style={atas && pos ? { position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width || 272, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto' } : undefined}
          className={cx(atas && pos ? 'z-[300]' : 'absolute right-0 top-[calc(100%+6px)] z-50 w-[min(272px,92vw)]', 'rounded-2xl bg-white p-2 shadow-[0_18px_48px_-12px_rgba(14,21,64,0.35)] ring-1 ring-slate-200 dark:bg-[#1A2033] dark:ring-white/10')}>
          <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5">
            <Avatar user={row} size={36} ring={false} className="ring-1 ring-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{user.display_name || user.name}</p>
              <p className="truncate text-[11px] text-ink-mute">{roleLabel(user)} · {isFreelance(user) ? 'Freelance' : isMultiBranch(user) ? `${branchesOf(user).length} cabang` : placeOf(user)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px]">
                <span className={cx('h-1.5 w-1.5 rounded-full', st.dot)} /><span className={st.text}>{st.label}</span>
                {row.status_text && <span className="truncate text-ink-mute">· {row.status_text}</span>}
              </p>
            </div>
          </div>

          {sub === '' && (
            <div className="mt-1 space-y-0.5">
              <Item icon={UserRound} href="#/settings">Profil &amp; Akun</Item>
              <Item icon={MessageSquareDot} onClick={() => { setDraft(row.status_text || ''); setSub('status') }} right={<ChevronRight className="h-3.5 w-3.5 text-ink-mute" />}>Set Status</Item>
              <Item icon={BellOff} onClick={() => setSub('mute')} right={muted ? <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">Senyap</span> : <ChevronRight className="h-3.5 w-3.5 text-ink-mute" />}>Mute Notifications</Item>
              <Item icon={SlidersHorizontal} href="#/settings">Preferences</Item>
              <Item icon={Palette} onClick={() => setSub('theme')} right={<ChevronRight className="h-3.5 w-3.5 text-ink-mute" />}>Themes</Item>
              <Item icon={HelpCircle} href="#/settings">Help</Item>
              <div className="my-1 border-t border-slate-100" />
              <PindahBooks />
              <div className="my-1 border-t border-slate-100" />
              <Item icon={LogOut} danger onClick={() => signOut()}>Logout</Item>
            </div>
          )}

          {sub === 'status' && (
            <div className="mt-1 space-y-1.5 p-1">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Set status</p>
              <input data-menu-item value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setStatus(draft.trim())}
                placeholder="Pesan singkat…" aria-label="Pesan status" maxLength={40}
                className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
              <div className="flex flex-wrap gap-1">
                {STATUS_PRESETS.map((s) => (
                  <button data-menu-item key={s} type="button" onClick={() => setStatus(s)}
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">{s}</button>
                ))}
              </div>
              <div className="flex gap-1.5 pt-1">
                <button data-menu-item type="button" onClick={() => setStatus(draft.trim())} className="flex-1 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white">Simpan</button>
                {row.status_text && <button data-menu-item type="button" onClick={() => setStatus('')} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-200">Hapus</button>}
              </div>
              <p className="px-1 text-[10px] text-ink-mute">Status ini hanya pesan ketersediaan — tidak mengubah Online/Idle/Offline Anda.</p>
            </div>
          )}

          {sub === 'mute' && (
            <div className="mt-1 space-y-0.5">
              <p className="px-2.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Senyapkan notifikasi</p>
              {MUTES.filter(([v]) => v !== 'off' || muted).map(([v, l]) => <Item key={v} icon={BellOff} onClick={() => setMute(v)}>{l}</Item>)}
              <p className="px-2.5 pb-1 text-[10px] text-ink-mute">Peringatan keamanan dan sesi yang akan berakhir tetap muncul.</p>
            </div>
          )}

          {sub === 'theme' && (
            <div className="mt-1 space-y-0.5">
              <p className="px-2.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Tema</p>
              <Item icon={Sun} onClick={() => setTheme('light')} right={readTheme().mode === 'light' ? <Check className="h-3.5 w-3.5 text-brand" /> : null}>Light</Item>
              <Item icon={Moon} onClick={() => setTheme('dark')} right={readTheme().mode === 'dark' ? <Check className="h-3.5 w-3.5 text-brand" /> : null}>Dark</Item>
              <Item icon={Palette} href="#/settings">Custom (warna aksen &amp; panel)</Item>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
