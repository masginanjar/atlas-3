import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send, X, Minus, ArrowLeft, Maximize2, Search } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { contactsFor, threadOf, peerOf, parseText } from '../lib/chat.js'
import { statusOf, STATUS } from '../lib/presence.js'
import { go } from '../lib/router.js'
import Avatar from '../components/Avatar.jsx'
import { cx } from './ui.jsx'

// ============================================================
//  CHAT MENEMPEL DI BAWAH (seperti Messenger)
//  Bisa chat tanpa meninggalkan halaman yang sedang dibuka.
//  Tiga keadaan: tertutup (hanya tombol bulat) → terbuka → diminimize
//  (judulnya saja). Keadaannya diingat per perangkat.
//  Data & aturannya sama persis dengan halaman Pesan Masuk — komponen ini
//  hanya tampilan ringkas, bukan alur chat kedua.
// ============================================================
const TZ = 'Asia/Makassar'
const jam = (iso) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const KEY = 'atlas-chatdock'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }

export default function ChatDock({ hidden }) {
  const { user, data, chatMessages, chatUnread, chatTotals, sendMessage, markChatRead, sendTyping, typing } = useApp()
  const saved = useRef(read()).current
  const [open, setOpen] = useState(!!saved.open)
  const [mini, setMini] = useState(!!saved.mini)
  const [thread, setThread] = useState(saved.thread || null)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const endRef = useRef(null)
  const lastTyping = useRef(0)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ open, mini, thread })) } catch { /* abaikan */ } }, [open, mini, thread])

  const contacts = useMemo(() => contactsFor(user, data.users), [user, data.users])
  const peer = thread ? peerOf(thread, user.id) : null
  const peerInfo = contacts.find((c) => c.id === peer)
  const msgs = useMemo(() => chatMessages.filter((m) => m.thread === thread), [chatMessages, thread])
  const unread = chatTotals?.msg || 0

  // daftar percakapan: yang ada pesannya di atas, urut pesan terakhir
  const list = useMemo(() => {
    const last = {}
    for (const m of chatMessages) last[m.thread] = m
    const term = q.trim().toLowerCase()
    return contacts
      .map((c) => { const th = threadOf(user.id, c.id); return { ...c, th, last: last[th], un: chatUnread[th] || { msg: 0, ping: 0 } } })
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => {
        if (!!a.last !== !!b.last) return a.last ? -1 : 1
        if (a.last && b.last) return String(b.last.created_at).localeCompare(String(a.last.created_at))
        return a.name.localeCompare(b.name)
      })
  }, [contacts, chatMessages, chatUnread, q, user.id])

  useEffect(() => { if (thread && open && !mini) markChatRead(thread) }, [thread, msgs.length, open, mini]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && !mini) endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, thread, open, mini])
  // pesan baru saat diminimize → otomatis "berkedip" lewat angka di judul, tidak memaksa terbuka

  if (hidden || !user) return null

  const onType = (v) => {
    setText(v)
    if (thread && peer && Date.now() - lastTyping.current > 1500) { lastTyping.current = Date.now(); sendTyping(thread, peer) }
  }
  const doSend = async (e) => {
    e?.preventDefault()
    const t = text.trim()
    if (!t || !peer) return
    setText('')
    try { await sendMessage({ to: peer, text: t, mentions: [...t.matchAll(/#([A-Za-z0-9-]{3,})/g)].map((m) => m[1]) }) } catch { /* ditangani halaman Pesan */ }
  }
  const openFull = () => { go(peer ? `pesan/${peer}` : 'pesan'); setOpen(false) }

  // ---------- tertutup: tombol bulat ----------
  if (!open) return (
    <button type="button" onClick={() => { setOpen(true); setMini(false) }} aria-label={`Buka chat${unread ? ` (${unread} belum dibaca)` : ''}`}
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      className="fixed left-4 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white shadow-lg ring-1 ring-white/10 transition hover:scale-105 md:bottom-5 md:left-auto md:right-5">
      <MessageCircle className="h-6 w-6" />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
  )

  const title = thread ? (peerInfo?.name || 'Percakapan') : 'Pesan'
  const st = peerInfo?.user ? STATUS[statusOf(peerInfo.user)] : null

  // ---------- diminimize: judulnya saja ----------
  if (mini) return (
    <button type="button" onClick={() => setMini(false)} aria-label={`Buka kembali chat${unread ? ` (${unread} belum dibaca)` : ''}`}
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      className="fixed left-4 right-[5.25rem] z-40 flex items-center gap-2 rounded-2xl bg-ink px-3 py-3 text-left text-white shadow-lg md:bottom-0 md:left-auto md:right-5 md:w-[320px] md:rounded-b-none">
      <MessageCircle className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{title}</span>
      {unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold">{unread > 99 ? '99+' : unread}</span>}
      <Maximize2 className="h-4 w-4 shrink-0 opacity-70" />
    </button>
  )

  // ---------- terbuka ----------
  return (
    <section aria-label="Chat cepat"
      className="fixed inset-x-0 bottom-0 top-[var(--appbar)] z-50 flex flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-slate-200 md:inset-auto md:bottom-0 md:right-5 md:top-auto md:z-40 md:h-[460px] md:w-[336px] md:rounded-t-2xl">
      {/* judul */}
      <header className="flex items-center gap-2 bg-ink px-2.5 py-2 text-white">
        {thread && <button type="button" onClick={() => setThread(null)} aria-label="Kembali ke daftar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"><ArrowLeft className="h-4 w-4" /></button>}
        {thread && peerInfo?.user && <Avatar user={peerInfo.user} size={28} ring={false} className="shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{title}</span>
          {st && <span className="block truncate text-[11px] text-white/60">{st.label}</span>}
        </span>
        <button type="button" onClick={openFull} aria-label="Buka halaman Pesan Masuk" title="Buka halaman penuh" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => setMini(true)} aria-label="Minimize chat" title="Minimize" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Tutup chat" title="Tutup" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"><X className="h-4 w-4" /></button>
      </header>

      {!thread ? (
        // daftar percakapan
        <>
          <div className="relative border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" aria-label="Cari percakapan"
              className="h-10 w-full rounded-xl border-0 bg-slate-50 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {list.length === 0 && <li className="p-4 text-center text-sm text-ink-mute">Tidak ada nama yang cocok.</li>}
            {list.map((c) => {
              const cs = c.user ? STATUS[statusOf(c.user)] : null
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setThread(c.th)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50">
                    <span className="relative shrink-0">
                      {c.user ? <Avatar user={c.user} size={34} ring={false} className="ring-1 ring-slate-200" /> : <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-slate-100 text-xs font-bold text-ink-soft ring-1 ring-slate-200">{c.name.slice(0, 2)}</span>}
                      {cs && <span className={cx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', cs.dot)} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.name}</span>
                        {c.last && <span className="shrink-0 text-[10px] text-ink-mute">{jam(c.last.created_at)}</span>}
                      </span>
                      <span className="block truncate text-xs text-ink-mute">{c.last ? `${c.last.from_user === user.id ? 'Anda: ' : ''}${c.last.text}` : (c.roleText || 'Belum ada pesan')}</span>
                    </span>
                    {c.un.msg > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">{c.un.msg}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        // isi percakapan
        <>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain bg-paper p-2.5">
            {msgs.length === 0 && <li className="p-6 text-center text-sm text-ink-mute">Belum ada pesan. Sapa duluan 👋</li>}
            {msgs.map((m) => {
              const mine = m.from_user === user.id
              return (
                <li key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[82%] rounded-2xl px-3 py-1.5 text-sm ring-1', m.kind === 'ping' ? 'bg-amber-50 text-amber-900 ring-amber-200' : mine ? 'bg-ink text-white ring-ink' : 'bg-white text-ink ring-slate-200')}>
                    {!mine && m.thread.startsWith('team:') && <p className="text-[10px] font-bold opacity-70">{m.from_name}</p>}
                    <p className="whitespace-pre-wrap break-words">
                      {parseText(m.text).map((part, k) => (part.inv
                        ? <button key={k} type="button" onClick={() => go(`projects?inv=${part.inv}`)} className={cx('font-bold underline', mine ? 'text-white' : 'text-brand')}>#{part.inv}</button>
                        : <span key={k}>{part.t}</span>))}
                    </p>
                    <p className={cx('mt-0.5 text-right text-[10px]', mine && m.kind !== 'ping' ? 'text-white/60' : 'text-ink-mute')}>{jam(m.created_at)}</p>
                  </div>
                </li>
              )
            })}
            {thread && typing[thread] && (
              <li className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink-mute" aria-live="polite">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute [animation-delay:-0.25s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute [animation-delay:-0.12s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" />
                </span>
                {typing[thread].name} sedang mengetik…
              </li>
            )}
            <li ref={endRef} />
          </ul>
          <form onSubmit={doSend} className="flex items-end gap-1.5 border-t border-slate-100 p-2">
            <textarea value={text} onChange={(e) => onType(e.target.value)} rows={1} placeholder="Tulis pesan…" aria-label="Tulis pesan"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() } }}
              className="max-h-24 min-h-[44px] flex-1 resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
            <button type="submit" disabled={!text.trim()} aria-label="Kirim pesan"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
        </>
      )}
    </section>
  )
}
