import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { usePanel, PANELS, PANEL_ORDER } from './WorkspacePanel.jsx'
import { Popover, cx } from './ui.jsx'

/**
 * Lima aksi cepat di kiri avatar. Semua membuka SATU panel kanan yang sama.
 * Layar kecil: digabung jadi tombol "+ Buat".
 * Aksi dari header bersifat umum — tidak otomatis menempel ke project yang sedang dibuka.
 */
export default function QuickActions() {
  const { user } = useApp()
  const { open } = usePanel()
  const [busy, setBusy] = useState('')
  const items = PANEL_ORDER.map((k) => [k, PANELS[k]]).filter(([, p]) => p.allow(user))
  const go = async (k) => { setBusy(k); await open(k); setBusy('') }

  return (
    <>
      <div className="hidden items-center gap-0.5 md:flex">
        {items.map(([k, p]) => (
          <button key={k} type="button" onClick={() => go(k)} title={p.tip} aria-label={p.tip} disabled={busy === k}
            className="grid h-11 w-11 place-items-center rounded-xl text-ink-mute transition hover:bg-white hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <p.icon className="h-[17px] w-[17px]" />
          </button>
        ))}
      </div>
      <div className="md:hidden">
        <Popover label="Buat baru" width="w-[min(240px,92vw)]" panelClass="max-sm:fixed max-sm:inset-x-2 max-sm:top-[calc(var(--appbar)+4px)] max-sm:w-auto"
          button={({ open: o, toggle }) => (
            <button type="button" onClick={toggle} aria-expanded={o} aria-label="Buat baru"
              className={cx('flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold ring-1 transition', o ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200')}>
              <Plus className="h-4 w-4" />Buat
            </button>
          )}>
          {({ close }) => (
            <ul className="space-y-0.5">
              {items.map(([k, p]) => (
                <li key={k}>
                  <button type="button" onClick={() => { close(); go(k) }} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold text-ink hover:bg-slate-50">
                    <p.icon className="h-4 w-4 text-ink-mute" />{p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>
      </div>
    </>
  )
}
