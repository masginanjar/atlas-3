// ============================================================
//  Jembatan modul Pengiriman ↔ server (fungsi everpro).
//  LIVE: semua panggilan Everpro lewat server; kunci tidak pernah di browser.
//  DEMO: simulasi lokal (tidak ada booking/biaya sungguhan) — ditandai "contoh".
// ============================================================
import { IS_DEMO } from './kirim.js'
import { db } from './db.js'
import { SUPABASE_URL } from './supabase.js'

/** Panggil fungsi server `kirim` (kunci Everpro hanya di server). Galat jaringan → pesan jelas, bukan crash. */
async function panggil(aksi, body) {
  try {
    const token = await db.token?.()
    if (!token) return { ok: false, alasan: 'Sesi berakhir — silakan masuk ulang' }
    const r = await fetch(`${SUPABASE_URL}/functions/v1/kirim`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ aksi, ...body }) })
    const x = await r.json().catch(() => ({ ok: false, alasan: `Server ${r.status}` }))
    if (r.status === 401) return { ok: false, alasan: 'Sesi berakhir — silakan masuk ulang' }
    return x
  } catch { return { ok: false, alasan: 'Koneksi gagal — periksa internet lalu coba lagi. Bila tadi sedang membuat pengiriman, cek Daftar dulu sebelum mengulang.' } }
}

const jeda = (ms = 450) => new Promise((r) => setTimeout(r, ms))

function tarifDemo(b) {
  const kg = Math.max(0.1, Number(b.berat_gram || 200) / 1000)
  const vol = b.length && b.width && b.height ? (b.length * b.width * b.height) / 6000 : 0
  const w = Math.max(1, Math.ceil(Math.max(kg, vol)))
  const L = [
    ['regular', 'J&T Express', 'EZ', 11000, 2, 4, 0.05], ['regular', 'JNE', 'REG', 13000, 2, 3, 0.03], ['regular', 'SiCepat', 'REG', 12000, 2, 3, 0.04],
    ['express', 'JNE', 'YES', 32000, 1, 1, 0], ['same_day', 'Gojek', 'Same Day', 25000, 0, 0, 0], ['cargo', 'Lion Parcel', 'JAGOPACK', 9000, 3, 6, 0.02],
  ]
  const tarif = L.map(([grup, kurir, layanan, per, min, max, cb]) => {
    const ongkir = per * w; const asuransi = b.asuransi ? Math.round(Math.max(1000, Number(b.nilai || 0) * 0.002)) : 0
    return { grup, kurir, layanan, rate_code: `DEMO-${kurir}-${layanan}`, logo: null, ongkir, asuransi, asuransi_tersedia: true, biaya_tambahan: 0, total: ongkir + asuransi, cashback: Math.round(ongkir * cb), min_hari: min, max_hari: max, satuan_durasi: 'hari', jemput_hari_ini: true, berat_volume: vol ? Math.round(vol * 100) / 100 : null, berat_dihitung: w, contoh: true }
  }).filter((t) => (b.jenis === 'DROP' ? t.grup !== 'same_day' : true))
  return { ok: true, tarif, diambil_at: new Date().toISOString(), contoh: true }
}

export async function cekTarif(b) {
  if (IS_DEMO) { await jeda(); return tarifDemo(b) }
  return panggil('tarif', b)
}
export async function cariLokasi(q) {
  if (IS_DEMO) {
    await jeda(250)
    const contoh = [{ sub_district_name: 'Seminyak', postal_code: '80361' }, { sub_district_name: 'Kuningan Timur', postal_code: '12950' }, { sub_district_name: 'Pleburan', postal_code: '50241' }, { sub_district_name: 'Paledang', postal_code: '40261' }, { sub_district_name: 'Paledang', postal_code: '16122' }]
    const s = String(q || '').toLowerCase()
    return { ok: true, data: contoh.filter((x) => x.sub_district_name.toLowerCase().includes(s) || x.postal_code === s), contoh: true }
  }
  return panggil('lokasi', /^\d{5}$/.test(String(q)) ? { kodepos: q } : { q })
}
export async function jadwalJemput(rate_code, cabang) {
  if (IS_DEMO) { await jeda(); const t = Math.floor(Date.now() / 1000) + 3600; return { ok: true, slot: [{ mulai: t, label: 'Hari ini · 16.00 - 20.00 (contoh)' }, { mulai: t + 86400, label: 'Besok · 09.00 - 12.00 (contoh)' }], zona: 'Asia/Makassar' } }
  return panggil('jemput_cabang', { rate_code, cabang })
}

/** Pesan (buat order Everpro) dari draft. `simpan` = fungsi save dari store (dipakai demo). */
export async function pesanKirim(k, totalDilihat, simpan) {
  if (IS_DEMO) {
    await jeda(900)
    const awb = `DEMO${String(Date.now()).slice(-8)}`, now = new Date().toISOString()
    const patch = { tahap: 'menunggu_jemput', everpro: { client_order_no: `ATLAS-DEMO-${String(k.id).slice(-6)}`, awb }, biaya: { ...k.kurir, total: k.kurir?.total, cashback_estimasi: k.kurir?.cashback, tarif_at: now }, dipesan_at: now, diperbarui_at: now, sumber_status: 'Simulasi demo', riwayat: [...(k.riwayat || []), { at: now, by: 'Demo', aksi: `Simulasi: order dibuat · resi contoh ${awb} (tidak ada booking sungguhan)` }] }
    await simpan('kirim', { id: k.id, ...patch })
    return { ok: true, ...patch }
  }
  return panggil('pesan_kirim', { kirim_id: k.id, total_dilihat: totalDilihat })
}
export async function sinkronKirim(k, simpan) {
  if (IS_DEMO) { await jeda(); const now = new Date().toISOString(); await simpan('kirim', { id: k.id, diperbarui_at: now }); return { ok: true, contoh: true } }
  return panggil('sinkron_kirim', { kirim_id: k.id })
}
export async function labelKirim(ids) {
  if (IS_DEMO) { await jeda(); return { ok: false, alasan: 'Di demo tidak ada label resmi kurir. Label hanya dari Everpro (live) supaya barcode & data wajib kurir tidak diubah.' } }
  return panggil('label_kirim', { kirim_ids: ids })
}
export async function batalKirim(k, alasan, simpan) {
  if (IS_DEMO) { await jeda(); const now = new Date().toISOString(); await simpan('kirim', { id: k.id, tahap: 'batal_diajukan', batal: { alasan, diajukan_at: now }, riwayat: [...(k.riwayat || []), { at: now, by: 'Demo', aksi: `Pembatalan diajukan (simulasi): ${alasan}` }] }); return { ok: true } }
  return panggil('batal_kirim', { kirim_id: k.id, alasan })
}
export async function sinkronSemua(dari, sampai) {
  if (IS_DEMO) { await jeda(); return { ok: true, baru: 0, ubah: 0, contoh: true } }
  return panggil('sinkron_semua', { dari, sampai })
}

/** Buka PDF label (jendela dibuka dulu agar tidak diblokir browser). */
export async function bukaLabelKirim(ids, notify) {
  const w = IS_DEMO ? null : window.open('', '_blank')
  const x = await labelKirim(ids)
  if (!x.ok || !x.url) { try { w?.close() } catch { /* abaikan */ } notify(x.alasan || 'Label belum tersedia', 'err'); return x }
  if (w) w.location.href = x.url; else window.open(x.url, '_blank', 'noopener')
  notify(`Label dibuka (${x.jumlah} resi${x.dilewati ? `, ${x.dilewati} dilewati karena belum ada resi` : ''}). Unduh ≠ tercetak — tandai setelah dicetak.`)
  return x
}
