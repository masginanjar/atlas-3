import { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { db, MODE } from '../lib/db.js'
import { ROLES, branchLabel, roleLabel } from '../config/access.js'
import { Button, Field, Input } from '../components/ui.jsx'

export default function Login() {
  const { signIn, signUp, notify } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoUsers, setDemoUsers] = useState([])
  const [view, setView] = useState('masuk') // masuk | daftar | lupa | sandi-baru
  const [info, setInfo] = useState('')
  // tautan pemulihan kata sandi dari email → Supabase mengarahkan kembali dengan type=recovery
  useEffect(() => { if (/type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search)) setView('sandi-baru') }, [])
  const daftar = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter')
      const r = await signUp(email, password)
      if (r?.pending) { setInfo('Cek email Anda dan klik tautan konfirmasi, lalu masuk.'); setView('masuk') }
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  const lupa = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await db.resetPassword(email); setInfo('Tautan pengaturan ulang kata sandi sudah dikirim ke email Anda.'); setView('masuk') } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  const sandiBaru = async (e) => {
    e.preventDefault(); setBusy(true)
    try { if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter'); await db.updatePassword(password); notify('Kata sandi diperbarui'); window.location.hash = '#/dashboard'; window.location.reload() } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }

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
        <p className="mt-2 max-w-sm text-sm text-white/60">Manajemen project terjemahan, apostille & legalisasi 247 Sworn Translator — 9 cabang, satu alur kerja.</p>
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
            <div className="space-y-4">
              {info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{info}</p>}
              {view === 'masuk' && (
                <form onSubmit={submit} className="space-y-4">
                  <h2 className="text-lg font-bold">Masuk</h2>
                  <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Field label="Kata sandi"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Masuk</Button>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" onClick={() => { setInfo(''); setView('daftar') }} className="font-semibold text-brand hover:underline">Pertama kali? Buat kata sandi</button>
                    <button type="button" onClick={() => { setInfo(''); setView('lupa') }} className="text-ink-mute hover:underline">Lupa kata sandi</button>
                  </div>
                </form>
              )}
              {view === 'daftar' && (
                <form onSubmit={daftar} className="space-y-4">
                  <h2 className="text-lg font-bold">Buat kata sandi</h2>
                  <p className="text-xs text-ink-mute">Untuk email yang sudah didaftarkan Superadmin di ATLAS. Setelah ini Anda langsung bisa masuk.</p>
                  <Field label="Email kantor"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Field label="Kata sandi baru (min. 8 karakter)"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Buat & Masuk</Button>
                  <button type="button" onClick={() => setView('masuk')} className="w-full text-center text-xs text-ink-mute hover:underline">Kembali ke Masuk</button>
                </form>
              )}
              {view === 'lupa' && (
                <form onSubmit={lupa} className="space-y-4">
                  <h2 className="text-lg font-bold">Lupa kata sandi</h2>
                  <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Kirim tautan</Button>
                  <button type="button" onClick={() => setView('masuk')} className="w-full text-center text-xs text-ink-mute hover:underline">Kembali ke Masuk</button>
                </form>
              )}
              {view === 'sandi-baru' && (
                <form onSubmit={sandiBaru} className="space-y-4">
                  <h2 className="text-lg font-bold">Kata sandi baru</h2>
                  <Field label="Kata sandi baru (min. 8 karakter)"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Simpan</Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
