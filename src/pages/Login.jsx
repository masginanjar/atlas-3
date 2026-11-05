import { useEffect, useMemo, useState } from 'react'
import { Search, Clock, ArrowRight } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { db, MODE } from '../lib/db.js'
import { ROLES, branchLabel, roleLabel } from '../config/access.js'
import { takeIdleReason, IDLE_MS } from '../lib/session.js'
import { Button, Field, Input, cx } from '../components/ui.jsx'

const salam = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam' }

export default function Login() {
  const { signIn, signUp, notify } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoUsers, setDemoUsers] = useState([])
  const [q, setQ] = useState('')
  const [view, setView] = useState('masuk') // masuk | daftar | lupa | sandi-baru
  const [info, setInfo] = useState('')
  // keluar otomatis karena idle → tampilkan alasannya sekali
  const [idleOut] = useState(() => takeIdleReason())
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

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const match = (u) => !term || u.name.toLowerCase().includes(term) || (ROLES[u.role]?.label || '').toLowerCase().includes(term) || (u.branch || '').toLowerCase().includes(term)
    return Object.keys(ROLES).map((r) => [r, demoUsers.filter((u) => u.role === r && match(u))]).filter(([, list]) => list.length)
  }, [demoUsers, q])

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--page)] px-4 py-8">
      {/* latar lembut — ceria tapi tetap bersih */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--brand)] opacity-[0.06] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-amber-300 opacity-[0.12] blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand)] text-lg font-black text-white shadow-sm">A</div>
          <div className="leading-tight">
            <p className="font-display text-base font-extrabold tracking-wide text-ink">ATLAS <span className="text-ink-mute">Alfa</span></p>
            <p className="text-[11px] text-ink-mute">247 Sworn Translator · 9 cabang, satu alur kerja</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_-18px_rgba(15,23,42,.35)] ring-1 ring-slate-200/80">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{salam()} 👋</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{MODE === 'demo' ? 'Pilih akun untuk mencoba tiap peran & cabang.' : 'Masuk untuk melanjutkan pekerjaan Anda.'}</p>

          {idleOut && (
            <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Anda keluar otomatis setelah {IDLE_MS / 3600000} jam tidak aktif. Silakan masuk kembali.</span>
            </p>
          )}
          {info && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{info}</p>}

          {MODE === 'demo' ? (
            <div className="mt-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, peran, atau cabang…" aria-label="Cari akun demo"
                  className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
              </label>
              <div className="mt-3 max-h-[46vh] space-y-3 overflow-auto pr-1">
                {groups.length === 0 && <p className="py-8 text-center text-xs text-ink-mute">Tidak ada akun yang cocok.</p>}
                {groups.map(([r, list]) => (
                  <div key={r}>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-mute">{ROLES[r].label}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {list.map((u) => (
                        <button key={u.id} onClick={() => submit(null, u.email)} disabled={busy}
                          className="group flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60">
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-ink">{u.name}</span>
                            <span className="block truncate text-[11px] text-ink-mute">{u.role === 'otorisator' || u.extra_roles?.length ? `${[roleLabel(u), ...(u.extra_roles || []).map((x) => roleLabel(u, x))].join(' + ')} · ` : ''}{branchLabel(u)}</span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-mute opacity-0 transition group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {view === 'masuk' && (
                <form onSubmit={submit} className="space-y-4">
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
                  <h2 className="text-sm font-bold">Buat kata sandi</h2>
                  <p className="text-xs text-ink-mute">Untuk email yang sudah didaftarkan Superadmin di ATLAS. Setelah ini Anda langsung bisa masuk.</p>
                  <Field label="Email kantor"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Field label="Kata sandi baru (min. 8 karakter)"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Buat & Masuk</Button>
                  <button type="button" onClick={() => setView('masuk')} className="w-full text-center text-xs text-ink-mute hover:underline">Kembali ke Masuk</button>
                </form>
              )}
              {view === 'lupa' && (
                <form onSubmit={lupa} className="space-y-4">
                  <h2 className="text-sm font-bold">Lupa kata sandi</h2>
                  <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Kirim tautan</Button>
                  <button type="button" onClick={() => setView('masuk')} className="w-full text-center text-xs text-ink-mute hover:underline">Kembali ke Masuk</button>
                </form>
              )}
              {view === 'sandi-baru' && (
                <form onSubmit={sandiBaru} className="space-y-4">
                  <h2 className="text-sm font-bold">Kata sandi baru</h2>
                  <Field label="Kata sandi baru (min. 8 karakter)"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
                  <Button className="w-full" size="lg" loading={busy}>Simpan</Button>
                </form>
              )}
            </div>
          )}
        </div>
        <p className={cx('mt-4 text-center text-[11px] text-ink-mute')}>Demi keamanan, sesi berakhir otomatis setelah {IDLE_MS / 3600000} jam tanpa aktivitas.</p>
      </div>
    </div>
  )
}
