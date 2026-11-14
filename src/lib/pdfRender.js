// Render PDF ke <canvas> dengan pdf.js — pratinjau konsisten di HP & desktop
// (browser HP umumnya tidak menampilkan PDF di dalam halaman).
// pdf.js (±400 KB) dimuat hanya saat ada PDF yang dipratinjau.
let pdfjs = null
async function init() {
  if (pdfjs) return pdfjs
  const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?raw')])
  const url = URL.createObjectURL(new Blob([worker.default], { type: 'text/javascript' }))
  lib.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' })
  pdfjs = lib
  return pdfjs
}

/** Render semua halaman (maks. maxPages) ke dalam container. */
export async function renderPdf(blob, container, { maxPages = 30, width } = {}) {
  const lib = await init()
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  container.innerHTML = ''
  const target = width || container.clientWidth || 600
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const vp = page.getViewport({ scale: (target / base.width) * dpr })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width; canvas.height = vp.height
    canvas.style.width = '100%'; canvas.style.height = 'auto'
    canvas.className = 'mb-3 rounded-lg bg-white shadow-sm'
    canvas.setAttribute('aria-label', `Halaman ${i}`)
    container.appendChild(canvas)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  }
  return pdf.numPages
}

/** Gambar mini halaman pertama PDF → data URL (JPEG) untuk pratinjau kecil di daftar berkas. */
export async function gambarMiniPdf(blob, width = 120) {
  const lib = await init()
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const vp = page.getViewport({ scale: (width / base.width) * dpr })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height)
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  const url = canvas.toDataURL('image/jpeg', 0.72)
  pdf.destroy?.()
  return url
}
