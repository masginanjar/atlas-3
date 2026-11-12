import { useEffect, useMemo, useState } from 'react'
import { Search, Clock, ArrowRight, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { db, MODE } from '../lib/db.js'
import { ROLES, branchLabel, roleLabel } from '../config/access.js'
import { takeIdleReason, IDLE_MS } from '../lib/session.js'
import { cx } from '../components/ui.jsx'
import LoginVisual from '../components/LoginVisual.jsx'
import { bacaCache, pilihGambar, simpanCache, DEFAULT_LOGIN } from '../config/loginTheme.js'

/** Metode login tambahan — hanya tampil bila integrasinya benar-benar aktif.
 *  Saat ini ATLAS memakai email + kata sandi Supabase, jadi daftar ini kosong. */
const METODE_LAIN = []

export default function Login() {
  const { signIn, signUp, notify } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lihat, setLihat] = useState(false)
  const [busy, setBusy] = useState(false)
  const [salah, setSalah] = useState('')
  const [demoUsers, setDemoUsers] = useState([])
  const [q, setQ] = useState('')
  const [view, setView] = useState('masuk') // masuk | daftar | lupa | sandi-baru
  const [info, setInfo] = useState('')
  const [idleOut] = useState(() => takeIdleReason())

  // Tema dari Setting → Tampilan → Halaman Login (salinan terakhir yang tersimpan).
  const [tema, setTema] = useState(bacaCache)
  // Satu gambar acak dipilih sekali saat halaman dibuka, lalu dipertahankan selama mengisi form.
  const [gambar, setGambar] = useState(() => pilihGambar(bacaCache()))

  useEffect(() => { if (/type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search)) setView('sandi-baru') }, [])
  // Mode live: baca pengaturan tampilan langsung dari server (baris ini boleh dibaca tanpa login),
  // supaya perangkat yang belum pernah dipakai masuk pun memakai tampilan terbaru.
  useEffect(() => {
    if (MODE === 'demo') return
    let hidup = true
    db.list('app_settings')
      .then((rows) => {
        const row = (rows || []).find((r) => r.key === 'login')
        if (!hidup || !row) return
        const baru = { ...DEFAULT_LOGIN, ...row }
        simpanCache(baru)
        setTema(baru)
        setGambar(pilihGambar(baru))
      })
      .catch(() => { /* tidak bisa dibaca → pakai salinan terakhir / bawaan */ })
    return () => { hidup = false }
  }, [])
  useEffect(() => { if (MODE === 'demo') db.list('users').then((u) => setDemoUsers(u.filter((x) => x.active !== false))) }, [])

  const jalan = async (fn) => { setBusy(true); setSalah(''); try { await fn() } catch (err) { setSalah(err.message || 'Terjadi kesalahan'); notify(err.message, 'err') } finally { setBusy(false) } }

  const submit = (e, em = email) => { e?.preventDefault(); return jalan(() => signIn(em, password)) }
  const daftar = (e) => { e.preventDefault(); return jalan(async () => {
    if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter')
    const r = await signUp(email, password)
    if (r?.pending) { setInfo('Cek email Anda dan klik tautan konfirmasi, lalu masuk.'); setView('masuk') }
  }) }
  const lupa = (e) => { e.preventDefault(); return jalan(async () => {
    await db.resetPassword(email); setInfo('Tautan pengaturan ulang kata sandi sudah dikirim ke email Anda.'); setView('masuk')
  }) }
  const sandiBaru = (e) => { e.preventDefault(); return jalan(async () => {
    if (password.length < 8) throw new Error('Kata sandi minimal 8 karakter')
    await db.updatePassword(password); notify('Kata sandi diperbarui')
    window.location.hash = '#/projects'; window.location.reload()
  }) }

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const match = (u) => !term || u.name.toLowerCase().includes(term) || (ROLES[u.role]?.label || '').toLowerCase().includes(term) || (u.branch || '').toLowerCase().includes(term)
    return Object.keys(ROLES).map((r) => [r, demoUsers.filter((u) => u.role === r && match(u))]).filter(([, list]) => list.length)
  }, [demoUsers, q])

  const judul = view === 'daftar' ? 'Buat kata sandi' : view === 'lupa' ? 'Lupa kata sandi' : view === 'sandi-baru' ? 'Kata sandi baru' : tema.judul
  const sub = view === 'daftar' ? 'Untuk email yang sudah didaftarkan Superadmin di ATLAS.'
    : view === 'lupa' ? 'Kami kirimkan tautan pengaturan ulang ke email Anda.'
    : view === 'sandi-baru' ? 'Tentukan kata sandi baru untuk akun Anda.'
    : MODE === 'demo' ? 'Pilih akun untuk mencoba tiap peran & cabang.' : tema.sub

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F3F4F9] px-4 py-8 text-[#141B34]" data-login-canvas>
      <section className="w-[400px] max-w-full rounded-2xl border border-[#DADDE8] bg-white p-7">
          <div>
            <div className="w-full">
              <div className="mb-4 flex flex-col items-center gap-1 text-center">
                <h1 className="text-[28px] font-extrabold tracking-tight">ATLAS</h1>
                <p className="text-[13px] text-[#5E6380]">247 Translator</p>
                {(view !== 'masuk' || MODE === 'demo') && <p className="mt-2 text-[13px] text-[#5E6380]"><b className="text-[#141B34]">{judul}</b> · {sub}</p>}
              </div>

              {idleOut && (
                <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Sesi berakhir — Anda keluar otomatis setelah {IDLE_MS / 3600000} jam tidak aktif. Silakan masuk kembali.</span>
                </p>
              )}
              {info && <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{info}</p>}
              {salah && <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">{salah}</p>}

              {MODE === 'demo' ? (
                <div>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, peran, atau cabang…" aria-label="Cari akun demo"
                      className="h-11 w-full rounded-xl border-0 bg-slate-50 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                  </label>
                  <div className="mt-3 max-h-[46vh] space-y-3 overflow-auto pr-1">
                    {groups.length === 0 && <p className="py-8 text-center text-xs text-ink-mute">Tidak ada akun yang cocok.</p>}
                    {groups.map(([r, list]) => (
                      <div key={r}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-mute">{ROLES[r].label}</p>
                        <div className="grid gap-1.5">
                          {list.map((u) => (
                            <button key={u.id} onClick={() => submit(null, u.email)} disabled={busy}
                              className="group flex min-h-[44px] items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60">
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
                <form onSubmit={view === 'daftar' ? daftar : view === 'lupa' ? lupa : view === 'sandi-baru' ? sandiBaru : submit} className="space-y-3.5">
                  {view !== 'sandi-baru' && (
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-bold text-[#141B34]">{view === 'daftar' ? 'Email kantor' : 'Email'}</span>
                      <span className="relative block">
                        
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username email" autoFocus
                          name="email" placeholder="nama@247sworntranslator.com"
                          className="h-11 w-full rounded-xl border border-[#D9DBE7] bg-white px-3 text-sm text-[#141B34] placeholder:text-[#8A8FA8] focus:outline-none focus:ring-2 focus:ring-[#4169E1]" />
                      </span>
                    </label>
                  )}

                  {view !== 'lupa' && (
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-bold text-[#141B34]">{view === 'masuk' ? 'Kata sandi' : 'Kata sandi baru (min. 8 karakter)'}</span>
                      <span className="relative block">
                        
                        <input type={lihat ? 'text' : 'password'} required minLength={view === 'masuk' ? undefined : 8}
                          value={password} onChange={(e) => setPassword(e.target.value)} name="password"
                          autoComplete={view === 'masuk' ? 'current-password' : 'new-password'} placeholder="••••••••"
                          className="h-11 w-full rounded-xl border border-[#D9DBE7] bg-white pl-3 pr-11 text-sm text-[#141B34] placeholder:text-[#8A8FA8] focus:outline-none focus:ring-2 focus:ring-[#4169E1]" />
                        <button type="button" onClick={() => setLihat((v) => !v)} tabIndex={0}
                          aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'} title={lihat ? 'Sembunyikan password' : 'Tampilkan password'}
                          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-mute transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          {lihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </span>
                    </label>
                  )}

                  {view === 'masuk' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setInfo(''); setSalah(''); setView('lupa') }}
                        className="min-h-9 rounded-[10px] px-3 text-[13px] font-bold text-[#141B34] hover:bg-[#F3F4F9]">Lupa Password?</button>
                    </div>
                  )}

                  <button type="submit" disabled={busy}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#141B34] text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? 'Memproses…' : view === 'masuk' ? 'Masuk' : view === 'daftar' ? 'Buat & Masuk' : view === 'lupa' ? 'Kirim tautan' : 'Simpan'}
                  </button>

                  {view === 'masuk' && METODE_LAIN.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 py-0.5">
                        <span className="h-px flex-1 bg-slate-200" /><span className="text-[11px] text-ink-mute">atau</span><span className="h-px flex-1 bg-slate-200" />
                      </div>
                      {METODE_LAIN.map((m) => (
                        <button key={m.id} type="button" onClick={() => jalan(m.masuk)}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-ink ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          {m.label}
                        </button>
                      ))}
                    </>
                  )}

                  {view === 'masuk' ? (
                    <p className="pt-1 text-center text-[12px] text-ink-mute">
                      Pertama kali masuk?{' '}
                      <button type="button" onClick={() => { setInfo(''); setSalah(''); setView('daftar') }} className="font-semibold text-brand hover:underline">Buat kata sandi</button>
                    </p>
                  ) : view !== 'sandi-baru' && (
                    <button type="button" onClick={() => { setSalah(''); setView('masuk') }} className="w-full pt-1 text-center text-[12px] text-ink-mute hover:underline">Kembali ke Masuk</button>
                  )}
                </form>
              )}

              <p className={cx('mt-5 text-center text-[11px] leading-relaxed text-ink-mute')}>
                Demi keamanan, sesi berakhir otomatis setelah {IDLE_MS / 3600000} jam tanpa aktivitas.
              </p>
            </div>
          </div>

      </section>
    </div>
  )
}
