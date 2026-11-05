// Print & pratinjau file (PDF / gambar) langsung dari browser.
export const kindOf = (f) => {
  const n = (f?.name || '').toLowerCase(); const u = f?.url || ''
  if (n.endsWith('.pdf') || u.startsWith('data:application/pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n) || u.startsWith('data:image')) return 'image'
  if (/\.(txt|md)$/.test(n)) return 'text'
  if (/\.docx$/.test(n)) return 'docx'
  if (/\.(xlsx|xlsm|xls|csv|ods)$/.test(n)) return 'sheet'
  return 'other'
}
export const canPreview = (f) => kindOf(f) !== 'other'

/** Cetak potongan HTML (hasil render Word/Excel) lewat iframe tersembunyi. */
export async function printHtml(html, title = '') {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style>body{margin:0;font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000}
table{border-collapse:collapse;font-size:10pt}td,th{border:1px solid #999;padding:2px 6px;vertical-align:top;white-space:nowrap}
.sheet{page-break-after:always}.sheet:last-child{page-break-after:auto}.sheet h2{font-size:12pt;margin:0 0 6px}
.docx-wrapper{background:#fff!important;padding:0!important}.docx-wrapper>section.docx{box-shadow:none!important;margin:0!important}
@page{margin:12mm}</style></head><body>${html}</body></html>`
  document.body.appendChild(frame)
  await new Promise((res) => { frame.onload = res; setTimeout(res, 1500) })
  try { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000); return true } catch {
    frame.remove(); const w = window.open('', '_blank'); if (!w) throw new Error('Print diblokir browser — gunakan Download lalu cetak dari file')
    w.document.write(frame.srcdoc); w.document.close(); w.print(); return true
  }
}

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
