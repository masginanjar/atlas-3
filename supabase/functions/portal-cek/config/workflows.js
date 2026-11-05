// DIBUAT OTOMATIS oleh scripts/gen-portal-flows.mjs — jangan diedit.
// Sumber: src/config/workflows.js. Perbarui dengan: npm run sync:portal
export const STAGE_KEYS = {
  "tr_int": [
    "cs_input",
    "pilih_penerjemah",
    "penerjemahan",
    "proofread",
    "otorisasi",
    "registrasi",
    "siap_print",
    "upload_scan",
    "siap_kirim"
  ],
  "tr_ext": [
    "pengajuan",
    "persetujuan",
    "pembayaran",
    "dibayar",
    "kirim",
    "dikirim"
  ],
  "tr_bill": [
    "order",
    "proses_vendor"
  ],
  "ap_int": [
    "cs_upload",
    "antrian",
    "diproses"
  ],
  "ap_ext": [
    "pengajuan",
    "persetujuan",
    "pembayaran",
    "dibayar",
    "kirim",
    "dikirim"
  ],
  "lg_int": [
    "cs_upload",
    "antrian",
    "diproses"
  ],
  "lg_ext": [
    "pengajuan",
    "persetujuan",
    "pembayaran",
    "dibayar",
    "kirim",
    "dikirim"
  ],
  "tr_nt": [
    "cs_input",
    "penerjemahan",
    "cs_final"
  ],
  "jl": [
    "proses",
    "cs_final"
  ]
}
export const PAYMENT_TERMS = {"immediate":{"label":"Langsung bayar per order","short":"Bayar per order"},"invoice":{"label":"Bayar sesuai tagihan vendor","short":"Sesuai tagihan"},"monthly":{"label":"Tagihan bulanan (via koordinator)","short":"Bulanan"}}
export const DONE = "selesai"
export const stagesOf = (cat) => (STAGE_KEYS[cat] ?? []).map((key) => ({ key }))
export function stageIndex(cat, key) {
  if (key === DONE) return (STAGE_KEYS[cat] ?? []).length
  return (STAGE_KEYS[cat] ?? []).indexOf(key)
}
export const termOf = (vendor) => (PAYMENT_TERMS[vendor?.payment_term] ? vendor.payment_term : 'immediate')
export const isBilled = (vendor) => termOf(vendor) !== 'immediate'
export const deriveFlow = function deriveFlow(sub, vendorRec) {
  const vendor = sub.executor_kind === 'vendor' || sub.translator_kind === 'vendor'
  switch (sub.type) {
    case 'terjemahan': return vendor ? (isBilled(vendorRec) ? 'tr_bill' : 'tr_ext') : 'tr_int'
    case 'terjemahan_nt': return 'tr_nt'
    case 'apostille': return vendor ? 'ap_ext' : 'ap_int'
    case 'legalisasi': return vendor ? 'lg_ext' : 'lg_int'
    default: return 'jl'
  }
}
export const flowOf = (sub, project) => sub?.flow || project?.category || deriveFlow(sub || {})
export const docListOf = (sub) => {
  const d = (sub?.docs || []).filter((x) => (x.desc || '').trim())
  if (d.length) return d.map((x) => x.desc.trim())
  const pts = String(sub?.description || '').split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
  return pts.length ? pts : [sub?.title || 'Dokumen']
}
export const totalPengajuan = (d = {}) => Number(d.total_pengajuan) || (Number(d.vendor_cost) || 0) + (Number(d.ongkir_cost) || 0)
