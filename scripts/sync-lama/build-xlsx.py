"""JSON hasil scrape tabel ATLAS lama -> xlsx dengan judul kolom yang dipahami legacy/transform.py.
Pakai: python3 -I build-xlsx.py <scrape.json> <out.xlsx>"""
import json, re, sys, openpyxl
SRC, OUT = sys.argv[1], sys.argv[2]
rows = json.load(open(SRC))
MAP = {'Timestamp':'Timestamp','No invoice1':'No. Invoice','Nama Pelanggan':'Nama Pelanggan','DEADLINE':'Deadline Penerjemah','Status':'Status',
       'Proses':'Proses Terjemahan','Cabang':'Cabang','Print-out':'Print-out','Nama CS':'Nama CS','Catatan':'Catatan','Kategori':'Kategori',
       'Bahasa/Produk':'Bahasa/Produk','Proses_2':'Tipe Proses','Otorisasi':'Otorisasi','Penerjemah/Vendor':'Penerjemah','Follow Up':'Follow Up',
       'Jumlah Dokumen':'Jumlah Dokumen','Jumlah Halaman':'Jumlah Halaman','Detail Layanan':'Detail Layanan','File':'File','Pengiriman Via':'Pengiriman Via',
       'Alamat Pengiriman':'Alamat Pengiriman','Apostille':'Apostille','Proses_3':'Proses Apostille','Tujuan Negara Apostille':'Tujuan Negara Apostille',
       'Catatan Apostille':'Catatan Apostille','__id':'ID Lama'}
emoji = re.compile(r'^[\U0001F300-\U0001FAFF☀-➿⚪⚫⏰⬛⬜️]+\s*')
wb = openpyxl.Workbook(); ws = wb.active; heads = list(MAP.values()); ws.append(heads)
for r in rows:
    o = {}
    for k, h in MAP.items():
        v = r.get(k, '')
        if isinstance(v, str): v = emoji.sub('', v).strip()
        if h == 'Status' and v: v = re.sub(r'\s*-\s*.*$', '', v).strip()
        if h in ('Jumlah Dokumen', 'Jumlah Halaman'): v = int(v) if str(v).strip().isdigit() else None
        if h == 'Alamat Pengiriman' and v in ('Nama...', ''): v = ''
        if h == 'Detail Layanan' and v: v = v.replace('&nbsp;', ' ')
        o[h] = v
    ws.append([o[h] for h in heads])
wb.save(OUT); print('xlsx', OUT, len(rows), 'baris')
