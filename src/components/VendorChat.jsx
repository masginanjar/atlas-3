import { Copy, PhoneOff } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { copyText } from './CopyText.jsx'
import { SUB_TYPES } from '../config/subtypes.js'
import { docListOf } from '../config/workflows.js'
import { cx } from './ui.jsx'
import { invoiceLabel } from '../config/access.js'

// Kode bahasa untuk template chat vendor
const LANG_CODE = { Indonesia: 'IND', Inggris: 'ENG', Mandarin: 'CHN', Jepang: 'JPN', Korea: 'KOR', Arab: 'ARB', Belanda: 'NLD', Jerman: 'DEU', Prancis: 'FRA', Spanyol: 'SPA', Rusia: 'RUS' }
const code = (l) => LANG_CODE[l] || String(l || '').slice(0, 3).toUpperCase()

/** Normalisasi nomor WA ke format internasional tanpa +, spasi, strip. Awalan 0 (Indonesia) → 62. */
export function waNumber(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('0')) d = `62${d.slice(1)}`
  else if (d.startsWith('8')) d = `62${d}`
  return d.length >= 9 ? d : ''
}

const hariTgl = (iso) => { if (!iso) return '-'; const d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

/** Pesan FIX ORDER untuk vendor — data mengikuti order. */
export function fixOrderMessage(project, sub) {
  const docs = docListOf(sub)
  const pages = (sub.docs || []).filter((d) => (d.desc || '').trim()).reduce((a, d) => a + (Number(d.pages) || 0), 0) || Number(sub.pages) || docs.length
  const isTr = ['terjemahan', 'terjemahan_nt'].includes(sub.type)
  const lines = [
    'FIX ORDER ✅',
    `No. Order: ${invoiceLabel(project.invoice_no)}`,
    `Nama: ${project.customer?.name || '-'}`,
    '',
    isTr ? `Bahasa: ${sub.lang_from || '-'} → ${sub.lang_to || '-'} (${code(sub.lang_from)}-${code(sub.lang_to)})`
      : `Layanan: ${(SUB_TYPES[sub.type] ?? SUB_TYPES.jasa_lain).label}${sub.country ? ` — tujuan ${sub.country}` : ''}`,
    '',
    'Dokumen:',
    ...docs.map((d, i) => `${i + 1}. ${d}`),
    '',
    `Estimasi jumlah: ${pages} halaman`,
    `Estimasi selesai: ${hariTgl(project.about?.deadline)}`,
  ]
  return lines.join('\n')
}

const WaIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
)

/** Dua tombol: Chat Vendor (buka WhatsApp dengan pesan FIX ORDER) & Salin Chat. */
export default function VendorChat({ project, sub, className }) {
  const { data, notify } = useApp()
  const vendorId = sub.data?.vendor || (sub.translator_kind === 'vendor' ? sub.translator : sub.executor_kind === 'vendor' ? sub.executor_id : '')
  const vendor = data.people.find((p) => p.id === vendorId)
  if (!vendor) return null
  const msg = fixOrderMessage(project, sub)
  const num = waNumber(vendor.phone || vendor.contact_phone)
  const href = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : undefined
  const salin = async () => { const ok = await copyText(msg); notify(ok ? 'Pesan berhasil disalin' : 'Gagal menyalin — salin manual', ok ? 'ok' : 'err') }
  const btn = 'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold ring-1 transition active:translate-y-px sm:flex-none sm:px-4'
  return (
    <div className={cx('space-y-1.5', className)} data-testid="vendor-chat">
      <div className="flex flex-wrap items-center gap-2">
        {href
          ? <a href={href} target="_blank" rel="noreferrer noopener" className={cx(btn, 'bg-[#25D366] text-white ring-[#25D366] hover:bg-[#1ebe5d]')} aria-label={`Chat vendor ${vendor.name} via WhatsApp`}><WaIcon className="h-4 w-4" />Chat Vendor</a>
          : <button type="button" disabled className={cx(btn, 'cursor-not-allowed bg-slate-100 text-ink-mute ring-slate-200')} aria-label="Chat vendor (nomor WhatsApp belum diisi)" title="Nomor WhatsApp vendor belum diisi"><WaIcon className="h-4 w-4" />Chat Vendor</button>}
        <button type="button" onClick={salin} className={cx(btn, 'bg-white text-ink ring-slate-300 hover:bg-slate-50 hover:ring-brand')} aria-label="Salin chat FIX ORDER"><Copy className="h-4 w-4" />Salin Chat</button>
        <span className="text-[11px] text-ink-mute">→ {vendor.name}{num ? ` · +${num}` : ''}</span>
      </div>
      {!num && <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-700"><PhoneOff className="h-3 w-3" />Nomor WhatsApp vendor belum diisi — lengkapi di Setting → Vendor. Tombol Salin Chat tetap bisa dipakai.</p>}
    </div>
  )
}
