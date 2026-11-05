import { UserRound, Truck, Copy, Hash, CopyCheck } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx } from './ui.jsx'

const digits = (p) => String(p || '').replace(/\D/g, '')

/** No. HP tanpa kode negara, hanya angka: "+62 878-6612-0090" → "87866120090". */
export function phoneLocal(p) {
  const s = String(p || '').trim()
  if (!s) return ''
  if (s.startsWith('+')) return s.replace(/^\+\d{1,3}[\s-]*/, '').replace(/\D/g, '')
  return digits(s).replace(/^0/, '')
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fallback di bawah */ }
  try {
    const ta = Object.assign(document.createElement('textarea'), { value: text })
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

function CopyIcon({ text, title, onCopy, icon: Icon = Copy }) {
  if (!text) return null
  return (
    <button type="button" onClick={() => onCopy(text)} title={title} aria-label={title}
      className="ml-1 inline-flex translate-y-[1px] rounded p-0.5 align-middle text-slate-400 transition hover:bg-brand-soft hover:text-brand active:scale-90">
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function Row({ label, value, wide, note, copy }) {
  return (
    <div className={cx('min-w-0', wide && 'col-span-2')}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</dt>
      <dd className={cx('mt-0.5 break-words text-sm', value ? 'text-ink' : 'italic text-ink-mute')}>
        {value || '—'}{note && value && <span className="ml-1 text-[10px] text-ink-mute">{note}</span>}{value && copy && <span className="whitespace-nowrap">{copy}</span>}
      </dd>
    </div>
  )
}

/** Data pelanggan & alamat pengiriman dari Zoho Books, dengan tombol copy untuk form ekspedisi. */
export default function CustomerInfo({ c = {}, className, children, compact, part, plain }) {
  const { notify } = useApp()
  // Data lama (sebelum struktur alamat dipisah) tetap tampil
  const s = c.ship || { attention: c.ship_to, street1: c.ship_address }
  const street = [s.street1, s.street2].filter(Boolean).join(', ')
  const hasShip = [s.attention, street, s.city, s.state, s.zip, s.country, s.phone].some(Boolean)
  // No. HP penerima: pakai telepon alamat pengiriman bila ada & berbeda; selain itu No. HP pelanggan
  const recipientPhone = s.phone || c.phone
  const samePhone = !s.phone || digits(s.phone) === digits(c.phone)

  const all = [
    s.attention && `Nama: ${s.attention}`, recipientPhone && `No. HP: ${recipientPhone}`, street && `Alamat: ${street}`,
    s.city && `Kota: ${s.city}`, s.state && `Provinsi: ${s.state}`, s.zip && `Kode Pos: ${s.zip}`, s.country && `Negara: ${s.country}`,
  ].filter(Boolean).join('\n')

  const doCopy = async (text) => { const ok = await copyText(text); notify(ok ? 'Berhasil disalin' : 'Gagal menyalin — salin manual', ok ? 'ok' : 'err') }

  if (compact) {
    const addr = [street, s.city, s.state, s.zip, s.country].filter(Boolean).join(', ')
    return (
      <div className={cx('space-y-1 rounded-lg px-3 py-2 text-xs ring-1 ring-slate-100', className)}>
        <p className="flex items-start gap-1.5 text-ink-soft"><UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-mute" />
          <span className="min-w-0">{[c.phone, c.email, c.city].filter(Boolean).join(' · ') || '—'}</span></p>
        <p className="flex items-start gap-1.5 text-ink-soft"><Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-mute" />
          <span className="min-w-0">{hasShip ? <>{s.attention && <b className="font-semibold text-ink">{s.attention}</b>}{s.attention && ' · '}{recipientPhone}{addr && <><br />{addr}</>}</> : <i className="text-ink-mute">Alamat pengiriman belum diisi di Zoho</i>}</span>
          {hasShip && <CopyIcon text={all} title="Copy semua detail pengiriman" onCopy={doCopy} icon={CopyCheck} />}</p>
        {children}
      </div>
    )
  }

  const customerPart = (
      <section className={cx(plain ? '' : 'rounded-xl bg-white p-4 ring-1 ring-slate-200', part && className)}>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-mute"><UserRound className="h-3.5 w-3.5" />Detail Pelanggan</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Row label="Nama Tampilan" value={c.name} wide />
          <Row label="Email" value={c.email} wide />
          <Row label="No. HP" value={c.phone} />
          <Row label="Kota" value={c.city} />
        </dl>
      </section>
  )
  const shippingPart = (
      <section className={cx(plain ? '' : 'rounded-xl bg-white p-4 ring-1 ring-slate-200', part && className)}>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-ink-mute"><Truck className="h-3.5 w-3.5" />Alamat Pengiriman
          {hasShip && <CopyIcon text={all} title="Copy semua detail pengiriman" onCopy={doCopy} icon={CopyCheck} />}</p>
        {!hasShip ? <p className="text-xs italic text-ink-mute">Belum diisi di Zoho</p> : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Row label="Nama Penerima" value={s.attention} wide copy={<CopyIcon text={s.attention} title="Copy nama" onCopy={doCopy} />} />
            <Row label="No. HP Penerima" value={recipientPhone} wide note={samePhone ? '(sama dgn pelanggan)' : null}
              copy={<><CopyIcon text={recipientPhone} title="Copy No. HP" onCopy={doCopy} /><CopyIcon text={phoneLocal(recipientPhone)} title="Copy No. HP tanpa kode negara" onCopy={doCopy} icon={Hash} /></>} />
            <Row label="Negara/Wilayah" value={s.country} wide copy={<CopyIcon text={s.country} title="Copy negara" onCopy={doCopy} />} />
            <Row label="Alamat" value={street} wide copy={<CopyIcon text={street} title="Copy alamat" onCopy={doCopy} />} />
            <Row label="Kota" value={s.city} copy={<CopyIcon text={s.city} title="Copy kota" onCopy={doCopy} />} />
            <Row label="Provinsi" value={s.state} copy={<CopyIcon text={s.state} title="Copy provinsi" onCopy={doCopy} />} />
            <Row label="Kode Pos" value={s.zip} copy={<CopyIcon text={s.zip} title="Copy kode pos" onCopy={doCopy} />} />
          </dl>
        )}
        {children}
      </section>
  )
  if (part === 'customer') return customerPart
  if (part === 'shipping') return shippingPart
  return (
    <div className={cx('grid gap-3 sm:grid-cols-2', className)}>
      {customerPart}
      {shippingPart}
    </div>
  )
}
