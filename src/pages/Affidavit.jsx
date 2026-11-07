import { useMemo, useState } from 'react'
import { FileStack, Truck, Check, Pencil, AlertTriangle, History, PackageCheck, Filter, X } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Input, Select, Field, Sheet, Empty, Pill, cx } from '../components/ui.jsx'
import { BRANCHES } from '../config/access.js'
import { tanggalJam } from '../lib/waktu.js'
import {
  ARAH_AFFIDAVIT, arahLabel, AMBANG_RENDAH, statusStok, canKelolaAffidavit, canPantauSemua,
  cabangTerlihat, barisStok, riwayatPakai, riwayatKirim,
} from '../lib/affidavit.js'

const TONE = {
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const Status = ({ s }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', TONE[s.tone])}>
    {s.key === 'habis' && <AlertTriangle className="h-3 w-3" />}{s.label}
  </span>
)

/** Angka sisa — "—" dibedakan dari 0 supaya "belum diisi" tidak terbaca "habis". */
const Sisa = ({ n }) => (
  n == null
    ? <span className="text-sm text-ink-mute">—</span>
    : <span className={cx('text-base font-bold tabular-nums', n <= 0 ? 'text-rose-700' : n < AMBANG_RENDAH ? 'text-amber-700' : 'text-ink')}>{n}</span>
)

export default function Affidavit() {
  const { user, data, notify, setStokAffidavit, catatPengiriman, terimaPengiriman } = useApp()
  const boleh = canKelolaAffidavit(user)
  const pantau = canPantauSemua(user)

  const cabangSaya = useMemo(() => cabangTerlihat(user, BRANCHES), [user])
  const [fCabang, setFCabang] = useState('Semua')
  const [fArah, setFArah] = useState('Semua')
  const [isiStok, setIsiStok] = useState(null)   // { cabang, arah, sisa }
  const [kirim, setKirim] = useState(null)       // { cabang, arah }
  const [riwayat, setRiwayat] = useState(null)   // { cabang, arah }

  const semua = useMemo(
    () => barisStok(cabangSaya, data.affidavit_stok, data.affidavit_kirim),
    [cabangSaya, data.affidavit_stok, data.affidavit_kirim],
  )
  const rows = useMemo(() => semua.filter(
    (r) => (fCabang === 'Semua' || r.cabang === fCabang) && (fArah === 'Semua' || r.arah === fArah),
  ), [semua, fCabang, fArah])

  const perlu = semua.filter((r) => r.status.key !== 'cukup').length
  const adaFilter = fCabang !== 'Semua' || fArah !== 'Semua'

  // pengiriman yang menunggu konfirmasi cabang ini
  const menunggu = useMemo(() => (data.affidavit_kirim || [])
    .filter((k) => k.status === 'dalam_pengiriman' && cabangSaya.includes(k.cabang))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))), [data.affidavit_kirim, cabangSaya])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><FileStack className="h-5 w-5 text-brand" />Affidavit</h1>
          <p className="text-xs text-ink-soft">
            {pantau ? 'Stok lembar affidavit semua cabang.' : `Stok lembar affidavit cabang ${cabangSaya.join(', ') || '—'}.`}
            {' '}Hanya 4 arah bahasa yang memakai lembar.
          </p>
        </div>
        {boleh && (
          <Button size="sm" variant="outline" onClick={() => setKirim({ cabang: fCabang === 'Semua' ? cabangSaya[0] : fCabang, arah: fArah === 'Semua' ? ARAH_AFFIDAVIT[0].key : fArah })}>
            <Truck className="h-3.5 w-3.5" />Catat Pengiriman
          </Button>
        )}
      </div>

      {perlu > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-xs text-amber-900">
            <b>{perlu} baris</b> perlu perhatian — habis, stok rendah, atau belum pernah diisi pusat.
            Baris paling perlu diisi berada di urutan atas.
          </p>
        </div>
      )}

      {menunggu.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><PackageCheck className="h-4 w-4 text-sky-600" />Dalam Pengiriman — menunggu konfirmasi terima</p>
          <div className="space-y-2">
            {menunggu.map((k) => (
              <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
                <p className="min-w-0 flex-1 text-xs text-sky-900">
                  <b>{k.lembar} lembar</b> {arahLabel(k.arah)} → cabang <b>{k.cabang}</b>
                  <span className="text-sky-700"> · dikirim {tanggalJam(k.at)} oleh {k.oleh}</span>
                </p>
                <TerimaBtn kirim={k} onTerima={terimaPengiriman} notify={notify} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-mute">Lembar ini belum masuk stok tersedia. Stok bertambah setelah cabang mengonfirmasi jumlah yang benar-benar diterima.</p>
        </Card>
      )}

      {/* filter */}
      <div className="flex flex-wrap items-end gap-2">
        {pantau && (
          <Field label="Cabang" className="min-w-0 flex-1 basis-40">
            <Select value={fCabang} onChange={(e) => setFCabang(e.target.value)} aria-label="Filter cabang">
              <option>Semua</option>{cabangSaya.map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Arah bahasa" className="min-w-0 flex-1 basis-48">
          <Select value={fArah} onChange={(e) => setFArah(e.target.value)} aria-label="Filter arah bahasa">
            <option value="Semua">Semua</option>{ARAH_AFFIDAVIT.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </Select>
        </Field>
        {adaFilter && (
          <Button size="sm" variant="ghost" onClick={() => { setFCabang('Semua'); setFArah('Semua') }}>
            <X className="h-3.5 w-3.5" />Reset
          </Button>
        )}
      </div>

      {!rows.length ? (
        <Empty icon={Filter} title="Tidak ada baris" text="Ubah filter cabang atau arah bahasa." />
      ) : (
        <Card className="overflow-hidden">
          <div className="md:overflow-x-auto">
            <table className="card-table w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-mute">
                <tr>
                  <th className="w-[22%] px-3 py-2 text-left font-bold">Cabang</th>
                  <th className="w-[28%] px-3 py-2 text-left font-bold">Arah</th>
                  <th className="w-[12%] px-3 py-2 text-right font-bold">Sisa</th>
                  <th className="w-[14%] px-3 py-2 text-right font-bold">Dikirim</th>
                  <th className="w-[14%] px-3 py-2 text-left font-bold">Status</th>
                  <th className="w-[10%] px-3 py-2 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="align-middle">
                    <td data-label="Cabang" className="px-3 py-2 font-semibold text-ink">{r.cabang}</td>
                    <td data-label="Arah" className="px-3 py-2 text-ink-soft">{r.arahLabel}</td>
                    <td data-label="Sisa" className="px-3 py-2 text-right md:text-right"><Sisa n={r.sisa} /></td>
                    <td data-label="Dikirim" className="px-3 py-2 text-right text-xs text-ink-soft">
                      {r.dikirim ? <Pill className="bg-sky-100 text-sky-800">{r.dikirim} lembar</Pill> : <span className="text-ink-mute">—</span>}
                    </td>
                    <td data-label="Status" className="px-3 py-2"><Status s={r.status} /></td>
                    <td data-label="Aksi" className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button type="button" onClick={() => setRiwayat({ cabang: r.cabang, arah: r.arah })}
                          aria-label={`Riwayat ${r.cabang} ${r.arahLabel}`} title="Riwayat pemakaian & pengiriman"
                          className="inline-grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 hover:text-ink">
                          <History className="h-4 w-4" />
                        </button>
                        {boleh && (
                          <button type="button" onClick={() => setIsiStok({ cabang: r.cabang, arah: r.arah, sisa: r.sisa })}
                            aria-label={`Ubah stok ${r.cabang} ${r.arahLabel}`} title="Tetapkan / koreksi stok"
                            className="inline-grid h-11 w-11 place-items-center rounded-lg text-brand hover:bg-brand-soft">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-[11px] text-ink-mute">
        Status: <b>Cukup</b> {AMBANG_RENDAH} lembar atau lebih · <b>Stok Rendah</b> 1–{AMBANG_RENDAH - 1} ·
        {' '}<b>Habis</b> 0 · <b>Belum diisi</b> pusat belum pernah menetapkan stok awal.
        Stok berkurang hanya saat CS menandai dokumen affidavit <b>sudah dicetak</b> — preview, unduh, dan cetak biasa tidak mengurangi.
      </p>

      {isiStok && <IsiStok s={isiStok} onClose={() => setIsiStok(null)} onSimpan={setStokAffidavit} notify={notify} />}
      {kirim && <KirimSheet s={kirim} cabangList={cabangSaya} onClose={() => setKirim(null)} onKirim={catatPengiriman} notify={notify} />}
      {riwayat && <RiwayatSheet s={riwayat} data={data} onClose={() => setRiwayat(null)} />}
    </div>
  )
}

/** Konfirmasi terima — jumlah bisa dikoreksi bila yang sampai tidak sebanyak yang dikirim. */
function TerimaBtn({ kirim, onTerima, notify }) {
  const [buka, setBuka] = useState(false)
  const [n, setN] = useState(String(kirim.lembar))
  const [busy, setBusy] = useState(false)
  const jalan = async () => {
    setBusy(true)
    try { await onTerima(kirim, Number(n)); notify(`${n} lembar masuk stok cabang ${kirim.cabang}`); setBuka(false) }
    catch (e) { notify(e.message || 'Gagal mencatat', 'err') } finally { setBusy(false) }
  }
  if (!buka) return <Button size="sm" onClick={() => setBuka(true)}><Check className="h-3.5 w-3.5" />Konfirmasi Terima</Button>
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" min="1" max={kirim.lembar} value={n} onChange={(e) => setN(e.target.value)}
        aria-label="Jumlah lembar yang diterima" className="w-24" />
      <Button size="sm" loading={busy} onClick={jalan}><Check className="h-3.5 w-3.5" />Simpan</Button>
      <Button size="sm" variant="ghost" onClick={() => setBuka(false)}>Batal</Button>
    </div>
  )
}

function IsiStok({ s, onClose, onSimpan, notify }) {
  const [v, setV] = useState(s.sisa == null ? '' : String(s.sisa))
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const simpan = async () => {
    setBusy(true)
    try {
      await onSimpan(s.cabang, s.arah, v === '' ? null : Number(v), catatan)
      notify(v === '' ? 'Stok dikembalikan ke "belum diisi"' : `Stok ${s.cabang} ${arahLabel(s.arah)} disetel ${v} lembar`)
      onClose()
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title="Tetapkan Stok Affidavit" subtitle={`${s.cabang} · ${arahLabel(s.arah)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={busy} onClick={simpan}><Check className="h-4 w-4" />Simpan</Button></>}>
      <div className="space-y-3">
        <Field label="Sisa lembar" hint="Kosongkan untuk mengembalikan ke status “belum diisi”.">
          <Input type="number" min="0" value={v} onChange={(e) => setV(e.target.value)} placeholder="mis. 200" aria-label="Sisa lembar" />
        </Field>
        <Field label="Catatan" hint="Opsional — mis. alasan koreksi stok.">
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. koreksi setelah hitung fisik" aria-label="Catatan" />
        </Field>
        <p className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 ring-1 ring-amber-200">
          Angka ini menimpa stok tersedia. Untuk <b>menambah</b> lembar yang dikirim ke cabang, pakai
          <b> Catat Pengiriman</b> supaya tercatat sebagai perjalanan dan cabang bisa mengonfirmasi.
        </p>
      </div>
    </Sheet>
  )
}

function KirimSheet({ s, cabangList, onClose, onKirim, notify }) {
  const [cabang, setCabang] = useState(s.cabang || cabangList[0] || '')
  const [arah, setArah] = useState(s.arah || ARAH_AFFIDAVIT[0].key)
  const [lembar, setLembar] = useState('100')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const jalan = async () => {
    setBusy(true)
    try { await onKirim({ cabang, arah, lembar: Number(lembar), catatan }); notify(`${lembar} lembar tercatat dalam pengiriman ke ${cabang}`); onClose() }
    catch (e) { notify(e.message || 'Gagal mencatat', 'err') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title="Catat Pengiriman Lembar" subtitle="Lembar masuk stok setelah cabang mengonfirmasi terima"
      footer={<><Button variant="ghost" onClick={onClose}>Batal</Button><Button loading={busy} onClick={jalan}><Truck className="h-4 w-4" />Catat</Button></>}>
      <div className="space-y-3">
        <Field label="Cabang tujuan" required>
          <Select value={cabang} onChange={(e) => setCabang(e.target.value)} aria-label="Cabang tujuan">
            {cabangList.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Arah bahasa" required>
          <Select value={arah} onChange={(e) => setArah(e.target.value)} aria-label="Arah bahasa">
            {ARAH_AFFIDAVIT.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Jumlah lembar" required>
          <Input type="number" min="1" value={lembar} onChange={(e) => setLembar(e.target.value)} aria-label="Jumlah lembar" />
        </Field>
        <Field label="Catatan" hint="Opsional — mis. nomor resi kurir.">
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. JNE 1234567890" aria-label="Catatan pengiriman" />
        </Field>
      </div>
    </Sheet>
  )
}

function RiwayatSheet({ s, data, onClose }) {
  const pakai = useMemo(() => riwayatPakai(data.affidavit_pakai, s).slice(0, 60), [data.affidavit_pakai, s])
  const kirim = useMemo(() => riwayatKirim(data.affidavit_kirim, s).slice(0, 30), [data.affidavit_kirim, s])
  return (
    <Sheet open onClose={onClose} title="Riwayat Affidavit" subtitle={`${s.cabang} · ${arahLabel(s.arah)}`} wide
      footer={<Button variant="ghost" onClick={onClose}>Tutup</Button>}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Pemakaian ({pakai.length})</p>
          {!pakai.length ? <p className="text-xs text-ink-mute">Belum ada pemakaian tercatat.</p> : (
            <ul className="space-y-1.5">
              {pakai.map((x) => (
                <li key={x.id} className="rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
                  <p className="font-semibold text-ink">−{x.lembar} lembar{x.invoice_no ? ` · ${String(x.invoice_no).replace(/^INV-/i, '')}` : ''}</p>
                  <p className="text-ink-soft">{tanggalJam(x.at)} · {x.cs}{x.sub_title ? ` · ${x.sub_title}` : ''}{x.catatan ? ` · ${x.catatan}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Pengiriman ({kirim.length})</p>
          {!kirim.length ? <p className="text-xs text-ink-mute">Belum ada pengiriman tercatat.</p> : (
            <ul className="space-y-1.5">
              {kirim.map((x) => (
                <li key={x.id} className="rounded-xl bg-sky-50 p-3 text-xs ring-1 ring-sky-200">
                  <p className="font-semibold text-sky-900">
                    +{x.lembar_diterima ?? x.lembar} lembar · {x.status === 'diterima' ? 'Diterima' : 'Dalam pengiriman'}
                  </p>
                  <p className="text-sky-800">
                    dikirim {tanggalJam(x.at)} oleh {x.oleh}
                    {x.status === 'diterima' && x.diterima_at ? ` · diterima ${tanggalJam(x.diterima_at)} oleh ${x.diterima_oleh}` : ''}
                    {x.catatan ? ` · ${x.catatan}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  )
}
