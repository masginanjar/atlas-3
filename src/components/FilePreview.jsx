import { useEffect, useRef, useState } from 'react'
import { renderPdf } from '../lib/pdfRender.js'
import { Loader2, Download, Printer, FileX } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { saveBlob } from '../lib/download.js'
import { kindOf, printBlob } from '../lib/printing.js'
import { Button, Sheet } from './ui.jsx'

/** Pratinjau file (PDF / gambar / teks) dalam aplikasi + tombol Print & Download. */
export default function FilePreview({ file, onClose, loader }) {
  const { notify } = useApp()
  const [state, setState] = useState({ loading: true, url: null, text: null, blob: null, error: null })
  const kind = kindOf(file)
  const pdfBox = useRef(null)
  const [pages, setPages] = useState(null)

  useEffect(() => {
    let url
    ;(loader ? loader(file) : drive.blob(file)).then(async (blob) => {
      url = URL.createObjectURL(blob)
      setState({ loading: false, url, blob, text: kind === 'text' ? await blob.text() : null, error: null })
    }).catch((e) => setState({ loading: false, url: null, blob: null, text: null, error: e.message }))
    return () => url && URL.revokeObjectURL(url)
  }, [file, kind])

  // PDF dirender dengan pdf.js agar tampil di semua perangkat
  useEffect(() => {
    if (kind !== 'pdf' || !state.blob || !pdfBox.current) return
    Promise.race([renderPdf(state.blob, pdfBox.current), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]).then(setPages).catch(() => setState((s) => ({ ...s, error: 'PDF tidak bisa ditampilkan — gunakan Download' })))
  }, [kind, state.blob])

  const doPrint = async () => { try { await printBlob(state.blob, kind) } catch (e) { notify(e.message, 'err') } }
  const doDownload = async () => { try { await saveBlob(file.name, state.blob) } catch (e) { notify(e.message, 'err') } }

  return (
    <Sheet open xwide onClose={onClose} title={file.name}
      footer={<>
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={onClose}>Tutup</Button>
        <span className="flex-1" />
        <Button variant="outline" disabled={!state.blob} onClick={doDownload}><Download className="h-4 w-4" />Download</Button>
        {kind !== 'other' && <Button disabled={!state.blob} onClick={doPrint}><Printer className="h-4 w-4" />Print</Button>}
      </>}>
      <div className="grid min-h-[50vh] place-items-center rounded-xl bg-slate-200/70">
        {state.loading && <Loader2 className="h-6 w-6 animate-spin text-brand" />}
        {state.error && <p className="flex items-center gap-2 p-6 text-sm text-rose-600"><FileX className="h-5 w-5" />{state.error}</p>}
        {kind === 'pdf' && state.blob && !state.error && (
          <div className="w-full">
            <div ref={pdfBox} className="mx-auto max-h-[68vh] w-full max-w-3xl overflow-y-auto p-3" aria-label={`Pratinjau ${file.name}`} />
            {pages !== null && <p className="pb-2 text-center text-xs text-ink-mute">{pages} halaman{pages > 30 ? ' (30 halaman pertama ditampilkan)' : ''}</p>}
          </div>
        )}
        {state.url && kind === 'image' && <img src={state.url} alt={file.name} className="max-h-[65vh] max-w-full rounded-lg object-contain" />}
        {state.text !== null && kind === 'text' && <pre className="max-h-[65vh] w-full overflow-auto whitespace-pre-wrap p-4 text-xs">{state.text}</pre>}
        {!state.loading && !state.error && kind === 'other' && <p className="p-6 text-center text-sm text-ink-mute">Pratinjau tidak tersedia untuk jenis file ini. Silakan Download.</p>}
      </div>
    </Sheet>
  )
}
