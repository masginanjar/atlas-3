// Print & pratinjau file (PDF / gambar) langsung dari browser.
export const kindOf = (f) => {
  const n = (f?.name || '').toLowerCase(); const u = f?.url || ''
  if (n.endsWith('.pdf') || u.startsWith('data:application/pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n) || u.startsWith('data:image')) return 'image'
  if (/\.(txt|csv|md)$/.test(n)) return 'text'
  return 'other'
}
export const canPreview = (f) => kindOf(f) !== 'other'

/** Cetak blob lewat iframe tersembunyi; bila diblokir, buka di tab baru. */
export async function printBlob(blob, kind) {
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  if (kind === 'image') {
    frame.srcdoc = `<html><body style="margin:0;display:grid;place-items:center"><img src="${url}" style="max-width:100%;max-height:100vh" onload="setTimeout(()=>print(),200)"></body></html>`
  } else frame.src = url
  document.body.appendChild(frame)
  const cleanup = () => setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 60000)
  try {
    if (kind !== 'image') {
      await new Promise((res) => { frame.onload = res; setTimeout(res, 1500) })
      frame.contentWindow.focus(); frame.contentWindow.print()
    }
    cleanup(); return true
  } catch {
    frame.remove()
    const w = window.open(url, '_blank')
    if (!w) throw new Error('Print diblokir browser — gunakan Download lalu cetak dari file')
    return true
  }
}
