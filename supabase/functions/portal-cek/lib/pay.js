// ---- Status invoice Zoho → status pembayaran ringkas ----
// Dipakai aplikasi (badge Pembayaran) dan portal pelanggan (Edge Function),
// karena itu berkas ini sengaja berdiri sendiri tanpa impor apa pun.
// draft & void TIDAK disamakan dengan "belum dibayar".
export const PAY_STATES = {
  paid: { key: 'paid', label: 'Lunas', tone: 'ok' },
  partial: { key: 'partial', label: 'Bayar Sebagian', tone: 'warn' },
  unpaid: { key: 'unpaid', label: 'Belum Dibayar', tone: 'due' },
  draft: { key: 'draft', label: 'Draft', tone: 'mute' },
  void: { key: 'void', label: 'Dibatalkan', tone: 'mute' },
  unknown: { key: 'unknown', label: 'Belum Tersedia', tone: 'mute' },
}
/** Status pembayaran dari status invoice Zoho. Tidak dikenal/kosong → "Belum Tersedia". */
export function payStateOf(status) {
  const s = String(status || '').toLowerCase().replace(/[\s-]+/g, '_')
  if (!s) return PAY_STATES.unknown
  if (s === 'paid') return PAY_STATES.paid
  if (s === 'partially_paid' || s === 'partial' || s === 'partially') return PAY_STATES.partial
  if (['sent', 'unpaid', 'overdue', 'viewed'].includes(s)) return PAY_STATES.unpaid
  if (s === 'draft') return PAY_STATES.draft
  if (['void', 'voided', 'cancelled', 'canceled'].includes(s)) return PAY_STATES.void
  return PAY_STATES.unknown
}
