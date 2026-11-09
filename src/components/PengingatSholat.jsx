import { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { KOTA, hitungSholat, menitSekarang, jamMenit, kotaUser } from '../lib/sholat.js'

// ============================================================
//  PENGINGAT SHOLAT — Dzuhur, Ashar, Maghrib.
//  Saat waktunya tiba: notifikasi singkat di layar + masuk lonceng.
//  Kota mengikuti pilihan di Beranda (atau cabang pengguna).
//  Disimpan di perangkat saja — bukan data kantor.
// ============================================================

const DIINGAT = [['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib']]
const kunciDaftar = (uid) => `atlas-sholat-notif:${uid}`
const tglWita = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)
const baca = (uid) => { try { return JSON.parse(localStorage.getItem(kunciDaftar(uid)) || '[]') } catch { return [] } }
const tulis = (uid, v) => { try { localStorage.setItem(kunciDaftar(uid), JSON.stringify(v.slice(0, 12))) } catch { /* abaikan */ } window.dispatchEvent(new Event('atlas-sholat-notif')) }

/** Daftar pengingat sholat untuk lonceng (+ tandai dibaca). */
export function useNotifSholat(uid) {
  const [list, setList] = useState(() => baca(uid))
  useEffect(() => {
    const f = () => setList(baca(uid)); f()
    window.addEventListener('atlas-sholat-notif', f); window.addEventListener('storage', f)
    return () => { window.removeEventListener('atlas-sholat-notif', f); window.removeEventListener('storage', f) }
  }, [uid])
  const tandai = (ids) => tulis(uid, baca(uid).map((x) => (ids.includes(x.id) ? { ...x, read: true } : x)))
  return { list, tandai }
}

/** Dipasang sekali di App: memeriksa jadwal tiap 20 detik. */
export default function PengingatSholat() {
  const { user, notify } = useApp()
  useEffect(() => {
    if (!user || user._hantu) return
    const cek = () => {
      let kota = kotaUser(user)
      try { kota = localStorage.getItem(`atlas-beranda-kota:${user.id}`) || kota } catch { /* abaikan */ }
      const j = hitungSholat(kota)
      const skr = menitSekarang(kota)
      const hari = tglWita()
      for (const [k, label] of DIINGAT) {
        if (skr < j[k] || skr > j[k] + 10) continue
        const id = `sholat-${hari}-${k}`
        if (baca(user.id).some((x) => x.id === id)) continue
        const teks = `🕌 Waktu ${label} · ${jamMenit(j[k])} ${KOTA[kota]?.zona || ''} (${KOTA[kota]?.nama || kota})`
        tulis(user.id, [{ id, text: teks, created_at: new Date().toISOString(), read: false }, ...baca(user.id)])
        notify(teks)
        try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(`Waktu ${label}`, { body: `${jamMenit(j[k])} · ${KOTA[kota]?.nama || kota}`, tag: id }) } catch { /* abaikan */ }
      }
    }
    cek()
    const t = setInterval(cek, 20000)
    return () => clearInterval(t)
  }, [user?.id, user?._hantu]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
