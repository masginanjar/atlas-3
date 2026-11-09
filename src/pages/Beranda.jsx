import { useEffect, useMemo, useState } from 'react'
import { Sun, Moon, Sunrise, Sunset, BookOpenText, Lightbulb, RefreshCw, Copy, Check, Flame, MapPin, ThumbsUp } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Select, cx } from '../components/ui.jsx'
import { KOTA, DAFTAR_KOTA, hitungSholat, sholatBerikut, URUT_SHOLAT, jamMenit, menitSekarang, sisaTeks, kotaUser } from '../lib/sholat.js'
import { AYAT, FAKTA, indeksHari } from '../config/berandaSeed.js'
import SlideBeranda from '../components/SlideBeranda.jsx'
import { StripTersemat } from '../components/Pengumuman.jsx'
import { KartuNgaji } from '../components/Ngaji.jsx'
import { pengaturanBeranda } from '../config/berandaSlide.js'

// ============================================================
//  BERANDA — halaman pembuka tanpa urusan kerja: sapaan, jadwal
//  sholat, ayat harian, fakta unik.
//  Tidak tampil untuk Penerjemah, Proofreader, Otorisator.
// ============================================================

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const TZ = { WIB: 'Asia/Jakarta', WITA: 'Asia/Makassar' }

const jamZona = (tz, d) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(':', '.')
const hijriah = (d) => {
  try { return new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/\s*H$/, '').replace(/,?\s*(\d{4})/, ' $1 H').replace('Jumadilawal', 'Jumadil Awal').replace('Jumadilakhir', 'Jumadil Akhir').replace('Rabiulawal', 'Rabiul Awal').replace('Rabiulakhir', 'Rabiul Akhir').replace('Zulkaidah', 'Zulkaidah') }
  catch { return '' }
}
const sapaan = (jam) => (jam < 11 ? ['Selamat pagi', Sunrise] : jam < 15 ? ['Selamat siang', Sun] : jam < 18 ? ['Selamat sore', Sunset] : ['Selamat malam', Moon])
const namaDepan = (u) => (u?.name || '').replace(/\s*\(.*\)\s*$/, '').split(' ')[0] || 'Anda'
const kunciHari = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Jam yang berganti tepat tiap menit. */
function useMenit() {
  const [kini, setKini] = useState(() => new Date())
  useEffect(() => {
    let iv
    const t = setTimeout(() => { setKini(new Date()); iv = setInterval(() => setKini(new Date()), 60000) }, 60000 - (Date.now() % 60000))
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [])
  return kini
}

/** Catatan "sudah saya baca" per user per hari (disimpan di perangkat). */
function useSudahBaca(userId) {
  const key = `atlas-beranda-baca:${userId}`
  const [hari, setHari] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } })
  const tandai = (k, jam) => { const v = { ...hari, [k]: jam }; setHari(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* abaikan */ } }
  const hapus = (k) => { const v = { ...hari }; delete v[k]; setHari(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* abaikan */ } }
  // hari berturut-turut sampai hari ini (atau kemarin bila hari ini belum)
  const beruntun = (() => {
    let n = 0; const d = new Date()
    if (!hari[kunciHari(d)]) d.setDate(d.getDate() - 1)
    while (hari[kunciHari(d)]) { n += 1; d.setDate(d.getDate() - 1) }
    return n
  })()
  return { hari, tandai, hapus, beruntun }
}

function JudulKartu({ icon: Icon, warna, children, kanan }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg', warna)}><Icon className="h-4 w-4" /></span>
      <b className="text-[13px] font-extrabold">{children}</b>
      {kanan && <span className="ml-auto min-w-0 truncate text-[11px] font-semibold text-ink-mute">{kanan}</span>}
    </div>
  )
}

function Aksi({ icon: Icon, children, onClick, aktif }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-bold transition',
        aktif ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-ink-soft hover:bg-slate-50')}>
      <Icon className="h-3.5 w-3.5" />{children}
    </button>
  )
}

export default function Beranda() {
  const { user, data, notify } = useApp()
  const slideHp = pengaturanBeranda(data).hp !== false
  const kini = useMenit()
  const [kota, setKota] = useState(() => { try { return localStorage.getItem(`atlas-beranda-kota:${user?.id}`) || kotaUser(user) } catch { return kotaUser(user) } })
  const gantiKota = (k) => { setKota(k); try { localStorage.setItem(`atlas-beranda-kota:${user?.id}`, k) } catch { /* abaikan */ } }
  const k = KOTA[kota] || KOTA.Bali
  const zonaUtama = k.zona, zonaLain = zonaUtama === 'WITA' ? 'WIB' : 'WITA'

  // Tanggal & jam mengikuti zona kota yang dipilih
  const jamUtama = jamZona(TZ[zonaUtama], kini)
  const jamKe = Number(jamUtama.split('.')[0])
  const [salam, IkonSalam] = sapaan(jamKe)
  const tglLokal = useMemo(() => new Date(kini.toLocaleString('en-US', { timeZone: TZ[zonaUtama] })), [kini, zonaUtama])
  const idx = indeksHari(tglLokal)

  // Sholat
  const jadwal = useMemo(() => hitungSholat(kota, tglLokal), [kota, tglLokal])
  const berikut = sholatBerikut(kota, kini)
  const skr = menitSekarang(kota, kini)

  // Isi harian + tombol "ganti" (geser ke berikutnya, hanya di perangkat ini)
  const [gesAyat, setGesAyat] = useState(0)
  const [gesFak, setGesFak] = useState(0)
  const [suka, setSuka] = useState(false)
  const ayat = AYAT[(idx + gesAyat) % AYAT.length]
  const fakta = FAKTA[(idx + gesFak) % FAKTA.length]

  const { hari, tandai, hapus, beruntun } = useSudahBaca(user?.id)
  const kHari = kunciHari(tglLokal)
  const sudah = hari[kHari]

  const salin = async (t) => { try { await navigator.clipboard.writeText(t); notify('Disalin') } catch { notify('Tidak bisa menyalin di perangkat ini', 'err') } }
  const teksAyat = `${ayat.arab.join(' ۝ ')}\n"${ayat.arti}" (QS. ${ayat.surah} [${ayat.no}]: ${ayat.ayat})`

  const KartuSholat = (
    <Card className="p-3.5">
      <JudulKartu icon={Moon} warna="bg-emerald-50 text-emerald-700" kanan={k.nama}>Jadwal Sholat</JudulKartu>
      <div className="mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700">{berikut.besok ? 'Besok' : 'Berikutnya'}</div>
          <div className="text-xl font-extrabold leading-tight text-emerald-900">{berikut.label}</div>
        </div>
        <div className="ml-auto text-right">
          <b className="block text-base font-extrabold tabular-nums text-emerald-900">{jamMenit(berikut.menit)}</b>
          <small className="text-[10.5px] font-semibold text-emerald-700">{sisaTeks(berikut.sisa)} lagi</small>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {URUT_SHOLAT.map(([key, label]) => {
          const lewat = jadwal[key] <= skr, aktif = !berikut.besok && berikut.key === key
          return (
            <div key={key} className={cx('rounded-xl border px-1 py-2 text-center', aktif ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-slate-50', lewat && !aktif && 'opacity-45')}>
              <small className={cx('block text-[10px] font-semibold', aktif ? 'text-white/80' : 'text-ink-mute')}>{label}</small>
              <b className="block text-[13px] font-extrabold tabular-nums">{jamMenit(jadwal[key])}</b>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-mute">
        <span>Imsak <b className="text-ink">{jamMenit(jadwal.imsak)}</b></span>
        <span>Terbit <b className="text-ink">{jamMenit(jadwal.terbit)}</b></span>
        <label className="ml-auto flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <Select value={kota} onChange={(e) => gantiKota(e.target.value)} aria-label="Kota jadwal sholat" className="!h-9 !w-auto !py-0 !text-[11px] font-bold">
            {DAFTAR_KOTA.map((c) => <option key={c} value={c}>{KOTA[c].nama}</option>)}
          </Select>
        </label>
      </div>
      <p className="mt-1.5 text-[10px] text-ink-mute">Hitungan kriteria Kemenag (Subuh 20°, Isya 18°, ihtiyat 2 menit); bisa berbeda ±2 menit dari jadwal resmi.</p>
    </Card>
  )

  const KartuAyat = (
    <Card className="p-3.5">
      <JudulKartu icon={BookOpenText} warna="bg-violet-50 text-violet-700" kanan={`QS. ${ayat.surah}: ${ayat.ayat}`}>Ayat Hari Ini</JudulKartu>
      <div dir="rtl" lang="ar" className="space-y-1 text-right text-[22px] leading-[1.9] text-ink lg:text-[26px]" style={{ fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", "Traditional Arabic", serif' }}>
        {ayat.arab.map((b, i) => <p key={i}>{b}</p>)}
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft lg:text-sm">"{ayat.arti}"</p>
      <p className="mt-1.5 text-[11px] font-semibold text-ink-mute">QS. {ayat.surah} ({ayat.no}): {ayat.ayat} · Terjemahan Kemenag</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => (sudah ? hapus(kHari) : tandai(kHari, jamUtama))} aria-pressed={!!sudah}
          className={cx('inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-extrabold transition',
            sudah ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-brand text-white shadow-sm hover:brightness-110')}>
          {sudah ? <><Check className="h-4 w-4" />Sudah dibaca · {sudah}</> : <><span className="grid h-4 w-4 place-items-center rounded border-2 border-white/80" />Sudah saya baca</>}
        </button>
        <Aksi icon={RefreshCw} onClick={() => setGesAyat((n) => n + 1)}>Ayat lain</Aksi>
        {beruntun > 0 && <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-amber-700"><Flame className="h-3.5 w-3.5" />{beruntun} hari berturut</span>}
      </div>
    </Card>
  )

  const KartuFakta = (
    <Card className="p-3.5">
      <JudulKartu icon={Lightbulb} warna="bg-sky-50 text-sky-700" kanan="Tahukah Anda?">Fakta Unik</JudulKartu>
      <span className="mb-1.5 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky-700">{fakta.kat}</span>
      <p className="text-[13px] leading-relaxed text-ink-soft lg:text-sm">{fakta.teks}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Aksi icon={RefreshCw} onClick={() => { setGesFak((n) => n + 1); setSuka(false) }}>Fakta lain</Aksi>
        <Aksi icon={ThumbsUp} aktif={suka} onClick={() => setSuka((v) => !v)}>{suka ? 'Menarik!' : 'Menarik'}</Aksi>
        <Aksi icon={Copy} onClick={() => salin(fakta.teks)}>Salin</Aksi>
      </div>
    </Card>
  )

  const Hero = (
    <div className="relative overflow-hidden rounded-2xl p-4 text-white lg:p-6" style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#2f5d8a 60%,#4b86b4 100%)' }}>
      <span className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-white/85"><IkonSalam className="h-3.5 w-3.5" />{salam}</div>
          <h1 className="mt-1 text-[22px] font-extrabold leading-tight lg:text-[30px]">{namaDepan(user)},<br />semoga harimu lancar</h1>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{HARI[tglLokal.getDay()]}, {tglLokal.getDate()} {BULAN[tglLokal.getMonth()]} {tglLokal.getFullYear()}</span>
            {hijriah(tglLokal) && <span className="rounded-full bg-white/15 px-2.5 py-1">{hijriah(tglLokal)}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right" aria-label={`Jam ${zonaUtama} dan ${zonaLain}`}>
          <b className="block text-[26px] font-extrabold leading-none tabular-nums lg:text-[34px]">{jamUtama}</b>
          <small className="text-[10px] font-bold uppercase tracking-wider text-white/85">{zonaUtama} · {k.nama}</small>
          <div className="mt-1.5 border-t border-white/25 pt-1.5">
            <b className="text-[15px] font-extrabold tabular-nums text-white/85 lg:text-[19px]">{jamZona(TZ[zonaLain], kini)}</b>
            <small className="ml-1 text-[10px] font-bold uppercase tracking-wider text-white/70">{zonaLain}</small>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-w-0 space-y-3 lg:space-y-4" data-beranda>
      <StripTersemat />
      <div className="space-y-3 lg:hidden">{Hero}{slideHp && <SlideBeranda />}<KartuNgaji />{KartuSholat}{KartuFakta}</div>
      <div className="hidden lg:grid lg:grid-cols-[1.25fr_1fr] lg:gap-4">
        <div className="space-y-4">{Hero}<SlideBeranda />{KartuFakta}</div>
        <div className="space-y-4">
          <KartuNgaji />
          {KartuSholat}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Imsak', jamMenit(jadwal.imsak), 'hari ini'],
              ['Terbit', jamMenit(jadwal.terbit), `terbenam ${jamMenit(jadwal.maghrib)}`],
              ['Hari ke-', String(idx), `dari ${tglLokal.getFullYear() % 4 === 0 ? 366 : 365}`],
              ['Akhir pekan', `${(6 - tglLokal.getDay() + 7) % 7 || 7} hari`, 'lagi'],
            ].map(([l, v, s]) => (
              <Card key={l} className="p-3"><small className="block text-[11px] font-semibold text-ink-mute">{l}</small><b className="block text-base font-extrabold tabular-nums">{v}</b><i className="text-[11px] not-italic text-ink-mute">{s}</i></Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
