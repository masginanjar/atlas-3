// ============================================================
//  DATA DUMMY untuk uji coba (khusus Superadmin).
//  Semua dummy ditandai: doc.dummy = true, pelanggan "[DUMMY] …", invoice "DUMMY-…",
//  nomor register dari deret khusus 9xxxxx (registrations.source = 'dummy') —
//  tidak mengganggu nomor register asli. Hapus sekaligus lewat db.hapusDummy().
// ============================================================
import { stagesOf, DONE } from '../config/workflows.js'
import { db } from './db.js'

const NAMA = ['Budi Santoso', 'Siti Aminah', 'Agus Wijaya', 'Dewi Lestari', 'Rudi Hartono', 'Maya Sari', 'Andi Pratama', 'Rina Kartika', 'Joko Susilo', 'Lina Marlina', 'Hendra Gunawan', 'Fitri Handayani', 'Bayu Saputra', 'Nadia Putri', 'Eko Prasetyo', 'Wulan Sari', 'Taufik Hidayat', 'Intan Permata', 'Rizky Ramadhan', 'Ayu Lestari']
const DOK = ['Akta Kelahiran', 'Kartu Keluarga', 'KTP', 'Ijazah S1', 'Transkrip Nilai', 'Buku Nikah', 'SKCK', 'Surat Keterangan Domisili', 'Paspor', 'Akta Perkawinan']
const SUMPAH = [['Indonesia', 'Inggris'], ['Indonesia', 'Inggris'], ['Indonesia', 'Inggris'], ['Inggris', 'Indonesia'], ['Indonesia', 'Belanda'], ['Belanda', 'Indonesia']]
const KODE = { 'Indonesia-Inggris': '41', 'Inggris-Indonesia': '42', 'Indonesia-Belanda': '43', 'Belanda-Indonesia': '44' }
const CABANG = ['Bali', 'Jakarta', 'Bandung', 'Semarang', 'Surabaya', 'Medan']
const pilih = (a) => a[Math.floor(Math.random() * a.length)]
const jam = (hariLalu, j = 9) => { const d = new Date(Date.now() - hariLalu * 864e5); d.setHours(j, Math.floor(Math.random() * 60), 0, 0); return d.toISOString() }
const tgl = (geserHari) => { const d = new Date(Date.now() + geserHari * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d) }

/** Kode unik dummy tertinggi yang sudah ada (deret 9xxxxx). */
const dummyTertinggi = (projects) => {
  let m = 900000
  for (const p of projects || []) for (const s of p.sub_projects || []) for (const n of s.data?.reg_numbers || []) { const u = Number(String(n).slice(6, 12)); if (u >= 900000) m = Math.max(m, u) }
  return m
}

/**
 * Buat `jumlah` project dummy dengan campuran jenis & tahap supaya semua fitur bisa dicoba:
 * terjemahan tersumpah (semua tahap, termasuk otorisasi & nomor register), non-tersumpah,
 * apostille, legalisasi, titip print, prioritas Sameday/Super Ekspres, deadline telat/hari ini/besok.
 */
export async function buatDummy({ jumlah = 20, data, user, save, onProgres }) {
  const orang = (role) => (data.users || []).filter((u) => u.active !== false && (u.role === role || (u.extra_roles || []).includes(role)))
  const csList = orang('cs'), trList = orang('penerjemah'), prList = orang('proofreader'), otList = orang('otorisator'), stafAp = orang('staf_apostille')
  const adm = orang('admin_pusat')[0]
  let seq = dummyTertinggi(data.projects)
  const kode = Date.now().toString(36).slice(-4).toUpperCase()
  let dibuat = 0, nomorDibuat = 0
  for (let i = 0; i < jumlah; i++) {
    const r = Math.random()
    const jenis = r < 0.6 ? 'sumpah' : r < 0.72 ? 'nt' : r < 0.86 ? 'apostille' : 'legalisasi'
    const cabang = pilih(CABANG)
    const cs = csList.find((u) => u.branch === cabang) || pilih(csList) || user
    const titip = Math.random() < 0.12
    const printDi = titip ? pilih(CABANG.filter((c) => c !== cabang)) : cabang
    const nama = pilih(NAMA), belakang = nama.split(' ')[1]
    const prioritas = Math.random() < 0.15 ? pilih(['Sameday', 'Super Ekspres', 'Ekspres']) : 'Normal'
    const umur = Math.floor(Math.random() * 6) // hari sejak masuk
    const deadline = tgl(pilih([-1, 0, 1, 2, 3, 3, 4]))
    const ndok = pilih([1, 1, 1, 2, 2, 3])
    const docs = Array.from({ length: ndok }, () => ({ desc: `${pilih(DOK)} ${belakang}`, pages: 1 + Math.floor(Math.random() * 3), kind: 'reguler' }))
    const pages = docs.reduce((a, d) => a + d.pages, 0)
    let sub
    if (jenis === 'sumpah' || jenis === 'nt') {
      const [lf, lt] = jenis === 'sumpah' ? pilih(SUMPAH) : pilih([['Indonesia', 'Jepang'], ['Arab', 'Indonesia'], ['Indonesia', 'Mandarin']])
      const flow = jenis === 'sumpah' ? 'tr_int' : 'tr_nt'
      const tahap = [...stagesOf(flow).map((s) => s.key), DONE]
      const st = pilih(tahap)
      const idx = tahap.indexOf(st)
      const has = (k) => idx > tahap.indexOf(k)
      const tr = pilih(trList), pr = pilih(prList), ot = pilih(otList)
      const d = { dummy: true }
      if (has('pilih_penerjemah') || flow === 'tr_nt' && has('cs_input')) Object.assign(d, { translator: tr?.id })
      if (has('penerjemahan')) Object.assign(d, { proofreader: pr?.id, translated_at: jam(umur - 0.2, 13) })
      if (has('proofread')) Object.assign(d, { proofread_at: jam(umur - 0.3, 15) })
      if (flow === 'tr_int' && has('otorisasi') && ot) {
        const at = jam(Math.max(0, umur - 1), 10 + Math.floor(Math.random() * 6))
        const kd = KODE[`${lf}-${lt}`], dd = tgl(-Math.max(0, umur - 1)).slice(8, 10), ym = tgl(0).slice(2, 4) + tgl(0).slice(5, 7)
        const nomor = docs.map(() => `${kd}${ym}${String(++seq).padStart(6, '0')}${dd}`)
        Object.assign(d, { authorized_by: ot.id, authorized_name: ot.name.replace(/\s*\(.*\)$/, ''), authorized_at: at, reg_reserved_at: at, reg_numbers: nomor, reg_names: nomor.map(() => belakang) })
        if (has('registrasi')) Object.assign(d, { registered_by: adm?.id, registered_name: adm?.name || 'Admin Pusat', registered_at: at })
        try {
          await db.regInsert(nomor.map((no, k) => ({ reg_no: no, invoice_no: null, lang_pair: { 41: 'ID-EN', 42: 'EN-ID', 43: 'ID-NL', 44: 'NL-ID' }[kd], reg_date: `20${no.slice(2, 4)}-${no.slice(4, 6)}-${no.slice(12, 14)}`, doc_type: docs[k].desc, doc_name: belakang, pages: docs[k].pages, source: 'dummy', created_by: user.id, created_name: user.name })))
          nomorDibuat += nomor.length
        } catch { /* nomor dummy gagal dicatat — project tetap dibuat */ }
      }
      sub = { id: `dummy-s-${kode}-${i}`, type: jenis === 'sumpah' ? 'terjemahan' : 'terjemahan_nt', flow, title: docs[0].desc, description: docs.map((x, k) => `${k + 1}. ${x.desc}`).join('\n'),
        docs, pages, file_count: ndok, lang_from: lf, lang_to: lt, stage: st, stage_at: jam(Math.max(0, umur - 1), 16), translator: d.translator || '', translator_kind: 'translator', data: d,
        history: [{ at: jam(umur, 8), by: cs?.name || 'CS', action: 'Dibuat (data dummy)' }] }
    } else {
      const flow = jenis === 'apostille' ? 'ap_int' : 'lg_int'
      const tahap = [...stagesOf(flow).map((s) => s.key), DONE]
      const st = pilih(tahap)
      const staf = pilih(stafAp)
      sub = { id: `dummy-s-${kode}-${i}`, type: jenis, flow, title: `${jenis === 'apostille' ? 'Apostille' : 'Legalisasi'} ${docs[0].desc}`, description: docs.map((x, k) => `${k + 1}. ${x.desc}`).join('\n'),
        docs, pages, file_count: ndok, country: pilih(['Belanda', 'Jerman', 'Jepang', 'Australia', 'Korea Selatan']), stage: st, stage_at: jam(Math.max(0, umur - 1), 16),
        data: { dummy: true, ...(staf && tahap.indexOf(st) > 1 ? { staff_apostille: staf.id } : {}) }, history: [{ at: jam(umur, 8), by: cs?.name || 'CS', action: 'Dibuat (data dummy)' }] }
    }
    const no = `DUMMY-${kode}${String(i + 1).padStart(3, '0')}`
    await save('projects', {
      invoice_no: no, branch: cabang, created_by: cs?.id || user.id, dummy: true,
      customer: { name: `[DUMMY] ${nama}`, phone: '0800000000' },
      about: { priority: prioritas, deadline: `${deadline}T00:00:00.000Z`, deadline_time: '17:00', print_location: printDi, cs_name: cs?.name || '', received_at: tgl(-umur) },
      sub_projects: [sub],
    })
    dibuat++; onProgres?.(dibuat, jumlah)
  }
  return { dibuat, nomorDibuat }
}

/** Jumlah project dummy yang ada sekarang. */
export const hitungDummy = (projects) => (projects || []).filter((p) => p.dummy).length
