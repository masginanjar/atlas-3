// ============================================================
//  DATA CONTOH JADWAL (mode demo saja): November 2026 untuk semua
//  cabang + pengajuan libur Desember. Pola meniru lembar jadwal Pak:
//  Bali memakai shift Admin Pagi/Siang + Pagi/Tengah/Siang/Malam,
//  cabang kecil cukup Pagi/Siang, libur bergilir di akhir pekan.
// ============================================================
import { BRANCHES } from '../config/access.js'
import { stafCabang, pakaiShift } from './jadwal.js'
import { rolesOf } from '../config/access.js'

const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
const hariKe = (s) => (new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7 // Senin = 0

export function isiJadwalDemo(m) {
  if (m.jadwal_demo_v2) return false
  const users = m.users || []
  const jadwal = []
  let n = 0
  const id = () => `jd-${(n++).toString(36)}`
  for (const cabang of BRANCHES) {
    const staf = stafCabang(users, cabang).filter((u) => (!(u.branches || []).length || u.branch === cabang) && !rolesOf(u).includes('supervisor'))
    if (!staf.length) continue
    const admin = staf.filter((u) => rolesOf(u).includes('admin_pusat'))
    const cs = staf.filter((u) => !rolesOf(u).includes('admin_pusat'))
    for (let d = 1; d <= 30; d++) {
      const t = iso(2026, 11, d); const h = hariKe(t); const mg = Math.floor((d + 5) / 7)
      // libur: tiap orang 1 hari di akhir pekan, bergantian Sabtu/Minggu
      const liburHari = (k) => ((k + mg) % 2 === 0 ? 5 : 6)
      admin.forEach((u, k) => {
        const libur = h === liburHari(k)
        jadwal.push({ id: id(), tanggal: t, cabang, user_id: u.id, shift: libur ? 'libur' : !pakaiShift(cabang) ? 'pagi' : ((k + d) % 2 ? 'admin_siang' : 'admin_pagi') })
      })
      const polaCs = !pakaiShift(cabang) ? ['pagi'] : cs.length >= 4 ? ['pagi', 'tengah', 'siang', 'malam'] : ['pagi', 'siang']
      cs.forEach((u, k) => {
        const libur = h === liburHari(k)
        const shift = libur ? 'libur' : polaCs[(k + mg) % polaCs.length]
        jadwal.push({ id: id(), tanggal: t, cabang, user_id: u.id, shift, ...(h >= 5 && !libur && ['tengah', 'malam'].includes(shift) ? { jam_mulai: shift === 'tengah' ? '09.00' : '16.00' } : {}) })
      })
    }
  }
  m.jadwal = [...(m.jadwal || []).filter((r) => !String(r.tanggal).startsWith('2026-11')), ...jadwal]
  // pengajuan libur Desember (contoh): sebagian menunggu, sebagian sudah disetujui
  const P = (nama, tanggal, status = 'diajukan', alasan = '') => {
    const u = users.find((x) => String(x.name).toLowerCase().startsWith(nama.toLowerCase()))
    if (!u) return null
    const periode = tanggal.map((d) => ({ mulai: iso(2026, 12, d), selesai: iso(2026, 12, d) }))
    return { id: `ct-${nama.toLowerCase()}`, user_id: u.id, nama: u.name, cabang: u.branch, jenis: 'libur', periode,
      mulai: periode[0].mulai, selesai: periode[periode.length - 1].selesai, alasan, status, at: '2026-11-08T03:00:00.000Z',
      ...(status === 'disetujui' ? { diputus_oleh: 'Laila Fina', diputus_at: '2026-11-09T02:00:00.000Z' } : {}) }
  }
  const cuti = [
    P('Nikita', [5, 19, 26], 'diajukan', 'Acara keluarga 19 Des'),
    P('Indah', [6, 13, 24, 25]),
    P('Destri', [24, 25, 26]),
    P('Rosyada', [7, 24, 31]),
    P('Nihaya', [12, 13], 'disetujui'),
    P('Sabrina', [19, 20, 25]),
    P('Ninda', [24, 25], 'diajukan', 'Natal bersama keluarga'),
    P('Rika', [24, 31]),
  ].filter(Boolean)
  m.cuti = [...(m.cuti || []).filter((c) => !String(c.id).startsWith('ct-')), ...cuti]
  m.jadwal_demo_v2 = true
  return true
}
