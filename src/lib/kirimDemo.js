// Data contoh modul Pengiriman — HANYA untuk demo. Semua nama/nomor rekaan (bukan pelanggan nyata).
const iso = (hariLalu, jam = 10) => { const d = new Date(Date.now() - hariLalu * 864e5); d.setHours(jam, 0, 0, 0); return d.toISOString() }

export function isiKirimDemo(m) {
  if (m.kirim_demo_v1) return false
  for (const t of ['kirim', 'kirim_alamat', 'kirim_templat', 'kirim_kendala', 'kirim_mutasi', 'kirim_event']) m[t] = m[t] || []
  const p = (m.projects || []).find((x) => x.customer?.name) || null
  const pengirim = { nama: '247 Translator Bali (contoh)', telp: '6281200000001', alamat: 'Jl. Contoh Raya No. 1, Seminyak, Kuta, Badung', kodepos: '80361', kelurahan: 'Seminyak', cabang: 'Bali' }
  const tujuan = [
    { nama: 'Pelanggan Contoh A', telp: '6281300000002', alamat: 'Jl. Contoh No. 2, Kuningan Timur, Setia Budi, Jakarta Selatan', kodepos: '12950', kelurahan: 'Kuningan Timur' },
    { nama: 'Pelanggan Contoh B', telp: '6281300000003', alamat: 'Jl. Contoh No. 3, Pleburan, Semarang Selatan, Kota Semarang', kodepos: '50241', kelurahan: 'Pleburan' },
    { nama: 'Pelanggan Contoh C', telp: '6281300000004', alamat: 'Jl. Contoh No. 4, Paledang, Lengkong, Kota Bandung', kodepos: '40261', kelurahan: 'Paledang' },
  ]
  const kur = (kurir, layanan, total, maks) => ({ kurir, layanan, rate_code: `DEMO-${layanan}`, jenis: 'PICKUP', ongkir: total, total, cashback: Math.round(total * 0.05), min_hari: 1, max_hari: maks })
  const baris = (i, tahap, hari, extra = {}) => ({
    id: `krm-demo-${i}`, created_at: iso(hari), kode: `KRM-DEMO-${String(i).padStart(3, '0')}`, sumber: 'ATLAS', cabang: 'Bali', tahap,
    jenis_kirim: 'keluar', project_id: i === 1 && p ? p.id : '', invoice_no: i === 1 && p ? p.invoice_no || '' : '', pelanggan: tujuan[i % 3].nama, pic: 'Super Admin',
    dokumen: { jenis: 'Terjemahan tersumpah', jumlah: 2, catatan: '' }, ongkir_ditanggung: 'kantor', checklist: { dokumen: true, periksa: true, alamat: true, kemasan: true },
    pengirim, penerima: tujuan[i % 3], paket: { isi: 'Dokumen terjemahan', jumlah: 1, berat_gram: 300, p: 33, l: 23, t: 2, nilai: 50000 },
    kurir: kur(['J&T Express', 'JNE', 'SiCepat'][i % 3], ['EZ', 'REG', 'REG'][i % 3], [14000, 22000, 18000][i % 3], 3),
    biaya: { ongkir: [14000, 22000, 18000][i % 3], asuransi: 0, biaya_tambahan: 0, total: [14000, 22000, 18000][i % 3], cashback_estimasi: 900 },
    everpro: tahap === 'draft' ? {} : { client_order_no: `ATLAS-DEMO-${i}`, awb: ['draft', 'diproses', 'dibuat'].includes(tahap) ? '' : `DEMO${String(1000000 + i)}` },
    dipesan_at: tahap === 'draft' ? null : iso(hari), diperbarui_at: iso(Math.max(0, hari - 1)), sumber_status: tahap === 'draft' ? 'Input manual' : 'Everpro (contoh)',
    timeline: tahap === 'draft' ? [] : [{ waktu: iso(Math.max(0, hari - 1)), status: tahap.toUpperCase(), keterangan: 'Contoh peristiwa lacak', sumber: 'Contoh demo', diterima_at: iso(Math.max(0, hari - 1)) }],
    riwayat: [{ at: iso(hari), by: 'Super Admin', aksi: 'Data contoh demo' }], ...extra,
  })
  m.kirim.push(
    baris(1, 'menunggu_jemput', 0, { kurir: { ...kur('JNE', 'REG', 22000, 3), pickup_time: Math.floor(Date.now() / 1000) - 30 * 3600 } }),
    baris(2, 'dikirim', 2), baris(3, 'terkirim', 5, { biaya_aktual: { ongkir: 18000, total: 19000, cashback: 900 } }), baris(4, 'draft', 0),
    baris(5, 'gagal_kirim', 6), baris(6, 'retur_proses', 8), baris(7, 'dikirim', 11), baris(8, 'dibatalkan', 3),
  )
  m.kirim_alamat.push(
    { id: 'alm-demo-1', created_at: iso(10), jenis: 'pelanggan', label: 'Pelanggan Contoh A — kantor', cabang: '', ...tujuan[0], terverifikasi: true },
    { id: 'alm-demo-2', created_at: iso(9), jenis: 'pelanggan', label: 'Pelanggan Contoh B — rumah', cabang: 'Bali', ...tujuan[1], terverifikasi: false },
  )
  m.kirim_templat.push(
    { id: 'tpl-demo-1', created_at: iso(20), nama: 'Amplop A4 · 1–5 lembar', isi: 'Dokumen terjemahan', berat_gram: 200, p: 33, l: 23, t: 1, nilai: 0, catatan: 'Timbang ulang sebelum kirim' },
    { id: 'tpl-demo-2', created_at: iso(20), nama: 'Map dokumen · apostille/legalisasi', isi: 'Dokumen legalisasi', berat_gram: 500, p: 35, l: 25, t: 3, nilai: 0, catatan: 'Dokumen asli: cek syarat asuransi kurir' },
  )
  m.kirim_kendala.push({ id: 'kdl-demo-1', created_at: iso(5), kirim_id: 'krm-demo-5', cabang: 'Bali', jenis: 'gagal_kirim', status: 'terbuka', judul: 'Penerima tidak di tempat', pic: 'Super Admin', tenggat: iso(-1), catatan: 'Hubungi pelanggan, jadwalkan kirim ulang', tiket: '', riwayat: [] })
  m.kirim_mutasi.push(
    { id: 'mts-demo-1', created_at: iso(5), tanggal: iso(5), arah: 'debit', jenis: 'ongkir', order: 'ATLAS-DEMO-3', resi: 'DEMO1000003', referensi: 'REF-DEMO-1', jumlah: 19000, status: 'berhasil', sumber: 'Impor laporan', kunci: 'demo|1' },
    { id: 'mts-demo-2', created_at: iso(4), tanggal: iso(4), arah: 'kredit', jenis: 'cashback', order: 'ATLAS-DEMO-3', resi: 'DEMO1000003', referensi: 'REF-DEMO-2', jumlah: 900, status: 'tertunda', sumber: 'Impor laporan', kunci: 'demo|2' },
  )
  m.app_settings = m.app_settings || []
  if (!m.app_settings.some((x) => x.key === 'alamat_kirim')) m.app_settings.push({ id: 'set-alamat-kirim-demo', created_at: iso(30), key: 'alamat_kirim', cabang: { Bali: { nama: '247 Translator Bali (contoh)', alamat: 'Jl. Contoh Raya No. 1, Seminyak, Kuta, Badung', kodepos: '80361', telp: '6281200000001' }, Jakarta: { nama: '247 Translator Jakarta (contoh)', alamat: 'Gedung Contoh Lt. 15, Kuningan Timur, Setia Budi', kodepos: '12950', telp: '6281200000002' } } })
  m.kirim_demo_v1 = true
  return true
}
