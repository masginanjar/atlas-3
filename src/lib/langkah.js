// ============================================================
//  LANGKAH BERIKUTNYA (fitur F1)
//  Dari tahap sub project + role pengguna, tentukan SATU tindakan utama yang
//  paling masuk akal untuk orang ini sekarang, beserta siapa penanggung
//  jawab tahapnya. Tidak ada aturan baru — semua diambil dari workflows.js
//  (stage.roles / assignee / action) dan can.processStage yang sudah ada.
// ============================================================
import { DONE, stagesOf, flowOf, stageShort } from '../config/workflows.js'
import { can, activeClaim } from '../config/access.js'
import { isApprover } from '../config/menuAccess.js'

/** Label pendek untuk tombol — dari `action` tahap yang biasanya panjang. */
const PENDEK = {
  'Kirim ke Direktur': 'Kirim ke Direktur',
  'Tetapkan Penerjemah': 'Tetapkan',
  'Kirim ke Staf Apostille': 'Kirim ke Staf',
  'Mulai Proses': 'Mulai',
  'Tandai Sudah Dicetak': 'Tandai sudah dicetak',
  'Upload Scan': 'Upload scan',
  'Dokumen Sudah Dikirim': 'Sudah dikirim',
  'Tandai Sudah Dibayar': 'Transfer',
  'Order ke Vendor': 'Order vendor',
  'Hasil Diterima': 'Hasil diterima',
  'Lanjut Serah Terima': 'Serah terima',
  'Otorisasi → Nomor Registrasi': 'Otorisasi',
  'Lanjut ke Admin Pusat (nomor register)': 'Otorisasi',
  'Selesai → Kembali ke CS': 'Selesai',
  'Simpan → Siap Print': 'Simpan no. reg',
  'Upload → Siap Kirim': 'Upload scan',
  'Kirim ke Penerjemah': 'Kirim ke penerjemah',
  'Kirim ke Proofreader': 'Ke proofreader',
  'Lanjut ke Otorisator': 'Ke otorisator',
  'Serahkan ke Pelanggan': 'Serahkan',
}
export const labelPendek = (a) => {
  if (!a) return 'Buka'
  const s = String(a).trim()
  if (PENDEK[s]) return PENDEK[s]
  const tanpaPanah = s.split('→')[0].trim()
  return tanpaPanah.length > 16 ? tanpaPanah.split(' ').slice(0, 2).join(' ') : tanpaPanah
}

/** Tahap yang dikerjakan orang tertentu (ada penanggung jawab pribadi). */
const TAHAP_ORANG = ['penerjemahan', 'proofread', 'otorisasi', 'antrian', 'proses']

/** Sub project yang belum selesai, urut paling mendesak (tahap paling awal dulu). */
export const subTerbuka = (p) => (p.sub_projects || []).filter((x) => x.stage !== DONE)

/**
 * Penanggung jawab tahap saat ini — nama orang / vendor / peran.
 * ctx: { users, people } dari store.
 */
export function penanggungJawab(x, p, ctx = {}) {
  const users = ctx.users || []; const people = ctx.people || []
  const nama = (id) => users.find((u) => u.id === id)?.name
  const d = x.data || {}
  switch (x.stage) {
    case 'penerjemahan': return nama(d.translator) || 'Penerjemah'
    case 'proofread': return nama(d.proofreader) || 'Proofreader'
    case 'otorisasi': return nama(activeClaim(x)?.by) || 'Otorisator'
    case 'antrian': case 'proses': return nama(d.staff_apostille) || 'Staf Apostille'
    case 'pilih_penerjemah': return 'Direktur'
    case 'registrasi': return 'Admin Pusat'
    case 'persetujuan': return 'Direktur'
    case 'pembayaran': return 'Akunting'
    case 'proses_vendor': case 'order': case 'dibayar':
      return people.find((v) => v.id === d.vendor)?.name || 'Vendor'
    case 'siap_print': case 'upload_scan': return `Print ${p.about?.print_location || p.branch}`
    default: {
      const cs = (p.about?.cs_name || '').replace(/\s*\(.*\)\s*$/, '')
      return cs ? `CS ${cs}` : `CS ${p.branch}`
    }
  }
}

/**
 * Langkah berikutnya untuk pengguna ini pada project ini.
 * Mengembalikan { label, sub, stage, pic, jenis } — jenis: 'kerja' (bisa
 * langsung diproses), 'ping' (menunggu orang lain), 'acc', 'transfer', 'buka'.
 */
export function langkahBerikutnya(p, user, ctx = {}) {
  const terbuka = subTerbuka(p)
  if (!terbuka.length) return { label: 'Buka', jenis: 'buka', pic: '', tahap: 'Selesai', berikut: '' }
  const info = (x) => {
    const flow = flowOf(x, p); const stages = stagesOf(flow)
    const i = stages.findIndex((s) => s.key === x.stage)
    const st = stages[i]; const nx = stages[i + 1]
    return { flow, st, nx, tahap: stageShort(flow, x.stage) || x.stage, berikut: nx ? (stageShort(flow, nx.key) || nx.label) : 'Selesai' }
  }
  // 1) tahap yang bisa saya proses sendiri
  for (const x of terbuka) {
    const { st, tahap, berikut } = info(x)
    // Tahap milik orang lain (penerjemah dsb.) tidak ditawarkan ke Superadmin/Direktur
    // sebagai "Upload hasil" walau mereka boleh override — tindakan wajarnya adalah Ping.
    const milikOrangLain = st?.assignee && x.data?.[st.assignee] && x.data[st.assignee] !== user?.id
    const diklaimOrang = st?.claimable && activeClaim(x) && activeClaim(x).by !== user?.id
    if (st && !milikOrangLain && !diklaimOrang && can.processStage(user, st, x, p)) {
      const jenis = x.stage === 'persetujuan' ? 'acc' : x.stage === 'pembayaran' ? 'transfer' : 'kerja'
      return { label: x.stage === 'persetujuan' ? 'ACC' : labelPendek(st.action), sub: x, stage: x.stage, pic: penanggungJawab(x, p, ctx), jenis, tahap, berikut }
    }
  }
  // 2) menunggu orang lain → ping (bila saya bukan pelaksana lepas)
  const x = terbuka[0]
  const { tahap, berikut } = info(x)
  const pic = penanggungJawab(x, p, ctx)
  if (TAHAP_ORANG.includes(x.stage) && !can.processStage(user, null, x, p) && ['cs', 'helper', 'admin_pusat', 'supervisor', 'superadmin', 'direktur'].includes(user?.role)) {
    return { label: 'Ping', sub: x, stage: x.stage, pic, jenis: 'ping', tahap, berikut }
  }
  if (x.stage === 'persetujuan' && isApprover(user)) return { label: 'ACC', sub: x, stage: x.stage, pic, jenis: 'acc', tahap, berikut }
  return { label: 'Buka', sub: x, stage: x.stage, pic, jenis: 'buka', tahap, berikut }
}
