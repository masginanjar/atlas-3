import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Check, Loader2, ZoomIn } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Sheet, cx } from './ui.jsx'
import Avatar from './Avatar.jsx'

// ============================================================
//  FOTO PROFIL — unggah JPG/PNG/WebP ≤ 5 MB, potong persegi (zoom + geser), simpan 256×256.
// ============================================================
const MAX = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const OUT = 256

export default function AvatarEditor() {
  const { user, setAvatar, notify } = useApp()
  const inputRef = useRef(null)
  const [src, setSrc] = useState(null) // objectURL gambar yang dipilih
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 }) // pusat potongan (0..1)
  const [busy, setBusy] = useState(false)
  const box = 240
  const drag = useRef(null)

  const pickFile = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!TYPES.includes(f.type)) return notify('Format harus JPG, PNG, atau WebP', 'err')
    if (f.size > MAX) return notify('Ukuran foto maksimal 5 MB', 'err')
    const url = URL.createObjectURL(f); const im = new Image()
    im.onload = () => { setImg(im); setSrc(url); setZoom(1); setPos({ x: 0.5, y: 0.5 }) }
    im.onerror = () => { URL.revokeObjectURL(url); notify('Gambar tidak bisa dibaca', 'err') }
    im.src = url
  }
  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])

  // geometri potongan: sisi persegi sumber = min(w,h)/zoom, berpusat di pos
  const crop = () => {
    const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom
    const x = Math.min(Math.max(pos.x * img.naturalWidth - side / 2, 0), img.naturalWidth - side)
    const y = Math.min(Math.max(pos.y * img.naturalHeight - side / 2, 0), img.naturalHeight - side)
    return { x, y, side }
  }
  const previewStyle = () => {
    if (!img) return {}
    const { x, y, side } = crop(); const k = box / side
    return { width: img.naturalWidth * k, height: img.naturalHeight * k, transform: `translate(${-x * k}px, ${-y * k}px)` }
  }
  const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, pos }; e.currentTarget.setPointerCapture(e.pointerId) }
  const onMove = (e) => {
    if (!drag.current || !img) return
    const { side } = crop(); const k = box / side
    setPos({ x: Math.min(1, Math.max(0, drag.current.pos.x - (e.clientX - drag.current.x) / k / img.naturalWidth)), y: Math.min(1, Math.max(0, drag.current.pos.y - (e.clientY - drag.current.y) / k / img.naturalHeight)) })
  }
  const onUp = () => { drag.current = null }

  const saveCrop = async () => {
    try {
      setBusy(true)
      const { x, y, side } = crop()
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT
      const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, x, y, side, side, 0, 0, OUT, OUT)
      await setAvatar(c.toDataURL('image/jpeg', 0.86))
      notify('Foto profil diperbarui'); setSrc(null); setImg(null)
    } catch (e) { notify(e.message || 'Gagal menyimpan foto', 'err') } finally { setBusy(false) }
  }
  const removePhoto = async () => { try { setBusy(true); await setAvatar(null); notify('Foto dihapus — kembali ke avatar bawaan') } catch (e) { notify(e.message, 'err') } finally { setBusy(false) } }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar user={user} size={72} />
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Foto Profil</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}><Camera className="h-4 w-4" />Ganti Foto</Button>
          {user.avatar && <Button size="sm" variant="danger" onClick={removePhoto} disabled={busy}><Trash2 className="h-4 w-4" />Hapus Foto</Button>}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickFile} />
        </div>
        <p className="text-[11px] text-ink-mute">JPG, PNG, atau WebP · maks. 5 MB · dipotong persegi, tampil sebagai lingkaran di seluruh aplikasi.</p>
      </div>

      <Sheet open={!!src} onClose={() => { setSrc(null); setImg(null) }} title="Potong foto profil"
        footer={<><Button variant="outline" className="flex-1" onClick={() => { setSrc(null); setImg(null) }}>Batal</Button>
          <Button className="flex-[2]" onClick={saveCrop} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Simpan Foto</Button></>}>
        <div className="space-y-3">
          <p className="text-xs text-ink-mute">Geser foto untuk mengatur posisi, gunakan slider untuk memperbesar. Area dalam lingkaran yang akan ditampilkan.</p>
          <div className="mx-auto select-none overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-300" style={{ width: box, height: box, touchAction: 'none' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <div className="relative" style={{ width: box, height: box }}>
              {src && <img src={src} alt="" draggable={false} className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left" style={previewStyle()} />}
              <div className="pointer-events-none absolute inset-0 rounded-full ring-[999px] ring-black/55" />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-soft"><ZoomIn className="h-4 w-4" /><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand" aria-label="Perbesar" /><span className={cx('w-10 text-right tabular-nums')}>{zoom.toFixed(1)}×</span></label>
        </div>
      </Sheet>
    </div>
  )
}
