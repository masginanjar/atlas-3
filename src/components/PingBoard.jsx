import { BellRing, Check, ArrowRight } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx } from './ui.jsx'
import { go } from '../lib/router.js'
import { tanggalJam } from '../lib/waktu.js'

/**
 * PING di layar utama — merah, menonjol seperti pengingat, supaya tidak
 * tenggelam di dalam lonceng. Ping dikirim rekan untuk menagih pekerjaan,
 * jadi memang harus terlihat.
 *
 * Batasnya ada di store: maksimal 3 kali sehari ke pekerjaan & penerima
 * yang sama, dengan jeda 1 jam.
 */
export default function PingBoard() {
  const { user, data, myPings, markPingRead } = useApp()
  const belum = myPings.filter((p) => !(p.read_by || []).includes(user.id))
  if (!belum.length) return null

  const namaPengirim = (p) => data.users.find((u) => u.id === p.from_user)?.name || p.by || 'Rekan'

  return (
    <section aria-label="Ping masuk"
      className="min-w-0 overflow-hidden rounded-2xl bg-rose-50 shadow-card ring-1 ring-rose-300">
      <div className="flex min-w-0 items-center gap-2 border-b border-rose-200 px-4 py-2.5">
        <BellRing className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-sm font-bold text-rose-900">Ping untuk Anda ({belum.length})</h2>
        <button type="button" onClick={() => markPingRead(belum)}
          className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100">
          Tandai semua dibaca
        </button>
      </div>
      <ul className="divide-y divide-rose-100">
        {belum.slice(0, 6).map((p) => (
          <li key={p.id}>
            <div className="flex min-w-0 items-start gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-rose-900">{p.message || 'Mohon dicek'}</span>
                <span className="mt-0.5 block text-[11px] text-rose-700/80">
                  {namaPengirim(p)} · {tanggalJam(p.created_at)}
                </span>
              </span>
              {p.project_id && (
                <button type="button" onClick={() => { markPingRead([p]); go(`projects/${p.project_id}`) }}
                  aria-label="Buka project" title="Buka project"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-100 md:h-8 md:w-8">
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => markPingRead([p])} aria-label="Tandai dibaca" title="Tandai dibaca"
                className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-100 md:h-8 md:w-8')}>
                <Check className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
