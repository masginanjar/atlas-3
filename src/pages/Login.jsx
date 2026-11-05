import { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { db, MODE } from '../lib/db.js'
import { ROLES, branchLabel, roleLabel } from '../config/access.js'
import { Button, Field, Input } from '../components/ui.jsx'

export default function Login() {
  const { signIn, notify } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoUsers, setDemoUsers] = useState([])

  useEffect(() => { if (MODE === 'demo') db.list('users').then(setDemoUsers) }, [])

  const submit = async (e, em = email) => {
    e?.preventDefault(); setBusy(true)
    try { await signIn(em, password) } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#0e1540] via-[#1b1f66] to-[#3b1a7a] md:flex-row">
      <div className="relative flex flex-col justify-end overflow-hidden px-6 pb-8 pt-14 text-white md:w-1/2 md:justify-center md:px-16">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand/40 blur-3xl" /><div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-accent/25 blur-3xl" /><div aria-hidden className="pointer-events-none absolute right-1/4 top-1/3 h-56 w-56 rounded-full bg-pop/25 blur-3xl" />
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand via-accent to-pop text-xl font-black text-white shadow-glow">A</div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">ATLAS <span className="bg-gradient-to-r from-accent to-pop bg-clip-text text-transparent">Alfa</span></h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">Manajemen project terjemahan & apostille — terhubung ke Zoho Books, InsForge, dan Google Drive.</p>
      </div>
      <div className="flex-1 rounded-t-3xl bg-paper/95 px-6 py-8 backdrop-blur md:grid md:place-items-center md:rounded-none">
        <div className="w-full max-w-md">
          {MODE === 'demo' ? (
            <>
              <h2 className="text-lg font-bold">Masuk sebagai</h2>
              <p className="mb-4 text-xs text-ink-mute">Mode demo — pilih akun untuk mencoba tiap role & cabang.</p>
              <div className="space-y-4">
                {Object.keys(ROLES).filter((r) => demoUsers.some((u) => u.role === r)).map((r) => (
                  <div key={r}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{ROLES[r].label}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {demoUsers.filter((u) => u.role === r).map((u) => (
                        <button key={u.id} onClick={() => submit(null, u.email)}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-left shadow-card ring-1 ring-slate-200/70 transition hover:-translate-y-px hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{u.name}</span><span className="block truncate text-[11px] text-ink-mute">{u.role === 'otorisator' || u.extra_roles?.length ? `${[roleLabel(u), ...(u.extra_roles || []).map((x) => roleLabel(u, x))].join(' + ')} · ` : ''}{branchLabel(u)}</span></span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-lg font-bold">Masuk</h2>
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
              <Field label="Password"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
              <Button className="w-full" size="lg" loading={busy}>Masuk</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
