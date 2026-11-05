// Render PDF ke <canvas> dengan pdf.js — pratinjau konsisten di HP & desktop
// (browser HP umumnya tidak menampilkan PDF di dalam halaman).
import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?raw'

let ready = false
function init() {
  if (ready) return
  const url = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }))
  pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' })
  ready = true
}

/** Render semua halaman (maks. maxPages) ke dalam container. */
export async function renderPdf(blob, container, { maxPages = 30, width } = {}) {
  init()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
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
