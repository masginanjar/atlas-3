import { useRef, useState } from 'react'
import { FileStack, Check, AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Input, cx } from '../components/ui.jsx'
import {
  perluAffidavit, isAffidavit, arahKey, arahLabel, cabangCetak, sisaStok, sisaDikirim,
  hitungLembar, pratinjauCetak, buatKunciCetak, AMBANG_RENDAH,
} from '../lib/affidavit.js'

/**
 * Panel pemakaian lembar affidavit, tampil hanya untuk 4 arah yang memakainya.
 *
 * Browser hanya bisa MEMBUKA dialog printer — tidak ada cara tahu apakah
 * kertas benar-benar keluar. Jadi stok TIDAK dikurangi saat dialog dibuka;
 * CS menekan "Sudah Dicetak" setelah kertas keluar. Membuka lalu membatalkan
 * dialog tidak mengurangi apa pun.
 */
export default function AffidavitCetak({ project, sub }) {
  const { user, data, notify, pakaiAffidavit } = useApp()
  const [salinan, setSalinan] = useState('1')
  const [perSalinan, setPerSalinan] = useState('1')
  const [busy, setBusy] = useState(false)
  const [tercatat, setTercatat] = useState(null) // { lembar, sisa }
  // Kunci idempoten: dibuat sekali per percobaan. Klik dua kali atau koneksi
  // putus lalu dicoba lagi memakai kunci yang sama → hanya mengurangi sekali.
  const kunci = useRef(buatKunciCetak())

  if (!isAffidavit(sub)) return null
  // Lokasi print "Vendor": vendor memakai lembarnya sendiri, stok cabang tidak berubah.
  if (!perluAffidavit(project, sub)) return (
    <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-ink-soft ring-1 ring-slate-200">
      Dokumen ini memakai lembar affidavit, tetapi dicetak <b>vendor</b> — stok lembar cabang tidak berkurang.
    </div>
  )

  const arah = arahKey(sub.lang_from, sub.lang_to)
  const cabang = cabangCetak(project)
  const sisa = sisaStok(data.affidavit_stok, cabang, arah)
  const dikirim = sisaDikirim(data.affidavit_kirim, cabang, arah)
  const lembar = hitungLembar(salinan, perSalinan)
  const pra = pratinjauCetak(sisa, lembar)

  const catat = async () => {
    setBusy(true)
    try {
      const out = await pakaiAffidavit({ cabang, arah, lembar, kunci: kunci.current, project, sub })
      if (out?.sudah) { notify('Pemakaian ini sudah tercatat sebelumnya — stok tidak dikurangi dua kali'); return }
      setTercatat({ lembar, sisa: out?.sisa })
      kunci.current = buatKunciCetak() // cetak ulang = pemakaian baru
      notify(`${lembar} lembar affidavit tercatat terpakai · sisa ${out?.sisa ?? '—'}`)
    } catch (e) { notify(e.message || 'Gagal mencatat pemakaian', 'err') } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-200" data-affidavit>
      <div className="flex flex-wrap items-center gap-2">
        <FileStack className="h-4 w-4 shrink-0 text-indigo-600" />
        <p className="min-w-0 flex-1 text-xs font-bold text-indigo-900">
          Lembar Affidavit · {arahLabel(arah)} · cabang {cabang}
        </p>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1',
          sisa == null ? 'bg-slate-100 text-slate-600 ring-slate-200'
            : sisa <= 0 ? 'bg-rose-100 text-rose-800 ring-rose-200'
              : sisa < AMBANG_RENDAH ? 'bg-amber-100 text-amber-800 ring-amber-200'
                : 'bg-emerald-100 text-emerald-800 ring-emerald-200')}>
          {sisa == null ? 'Stok belum diisi' : `Sisa ${sisa} lembar`}
        </span>
      </div>

      {dikirim > 0 && (
        <p className="mt-1.5 text-[11px] text-sky-800">{dikirim} lembar sedang dalam pengiriman — belum masuk stok tersedia.</p>
      )}

      {tercatat ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <b>{tercatat.lembar} lembar</b> tercatat terpakai{tercatat.sisa != null ? ` · sisa ${tercatat.sisa} lembar` : ''}.
          </span>
          <button type="button" onClick={() => setTercatat(null)} className="font-semibold text-emerald-800 hover:underline">
            Catat cetakan lagi
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-2" data-affidavit-isi>
            <label className="min-w-0 basis-28">
              <span className="block text-[11px] font-semibold text-indigo-900">Jumlah salinan</span>
              <Input type="number" min="1" value={salinan} onChange={(e) => setSalinan(e.target.value)}
                aria-label="Jumlah salinan yang dicetak" className="mt-0.5" />
            </label>
            <label className="min-w-0 basis-36">
              <span className="block text-[11px] font-semibold text-indigo-900">Lembar / salinan</span>
              <Input type="number" min="1" value={perSalinan} onChange={(e) => setPerSalinan(e.target.value)}
                aria-label="Lembar affidavit per salinan" className="mt-0.5" />
            </label>
            <Button size="sm" variant="dark" loading={busy} disabled={!pra.bisa} onClick={catat} className="mb-0.5">
              <Check className="h-3.5 w-3.5" />Catat Pemakaian Lembar
            </Button>
          </div>
          <p className={cx('mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold',
            pra.bisa ? 'text-indigo-900' : 'text-rose-800')}>
            {!pra.bisa && <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}{pra.teks}
          </p>
        </>
      )}

      <p className="mt-1.5 text-[11px] text-indigo-700" data-affidavit-ket>
        Stok berkurang hanya saat tombol di atas ditekan, setelah kertas benar-benar keluar.
        Preview, unduh PDF, dan membuka lalu membatalkan dialog printer tidak mengurangi stok.
      </p>
      {sisa == null && (
        <p className="mt-1 text-[11px] font-semibold text-amber-800">
          Stok cabang ini belum pernah ditetapkan Admin Pusat — minta pusat mengisinya dulu di menu Affidavit.
        </p>
      )}
      {user?.role === 'cs' && sisa != null && sisa < AMBANG_RENDAH && (
        <p className="mt-1 text-[11px] font-semibold text-amber-800">Admin Pusat sudah otomatis diberi tahu stok rendah.</p>
      )}
    </div>
  )
}
