"""Transformasi ekspor sistem lama (projects-YYYY-MM-DD.xlsx) -> payload impor ATLAS Alfa.
Tidak mengarang data: nilai kosong tetap kosong; nilai mentah disimpan di `legacy` per subproyek."""
import openpyxl, re, json, csv, sys, html, hashlib, collections
from datetime import datetime

SRC, OUT_JSON, OUT_MAP = sys.argv[1], sys.argv[2], sys.argv[3]
wb = openpyxl.load_workbook(SRC, data_only=True); ws = wb.active
rows = list(ws.iter_rows(values_only=True)); H = [str(h).strip() for h in rows[0]]
R = [dict(zip(H, r)) for r in rows[1:] if any(v not in (None, '') for v in r)]

def clean(v):
    if v is None: return ''
    s = html.unescape(str(v)).replace(' ', ' ').replace('​', '').replace('&nbsp;', ' ')
    return '\n'.join(l.rstrip() for l in s.replace('\r', '').split('\n')).strip()
def dmy(v):
    v = clean(v)
    if not v: return None
    for f in ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try: return datetime.strptime(v[:10], f).strftime('%Y-%m-%d')
        except ValueError: pass
    return None

BRANCH = {'Jogja': 'Yogyakarta', 'Yogyakarta': 'Yogyakarta'}
KNOWN_BRANCH = {'Bali', 'Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Makassar', 'Medan', 'Batam', 'Semarang'}
def branch(v):
    v = clean(v); return BRANCH.get(v, v)
PRIORITY = {'Reguler/Normal': 'Normal', 'Sameday': 'Sameday'}   # Speed 50% / Speed 100% / Express: dibiarkan apa adanya (perlu keputusan)
LANG = {'Perancis': 'Prancis', 'Russian': 'Rusia', 'Rusia': 'Rusia'}
COURIER = {'J&T (JNT)': 'J&T', 'J&T Express': 'J&T', 'JNE REG (JNE Reguler)': 'JNE', 'JNE YES (Yakin Esok Sampai)': 'JNE',
           'Self Pickup (Ambil Sendiri)': 'Diambil di Kantor', 'Not Sent (Softcopy Only)': 'Softcopy Saja', 'GoSend / Gojek': 'Gojek',
           'TIKI Reguler (TIKI REG)': 'TIKI', 'POS Indonesia': 'POS Indonesia', 'Paxel': 'Paxel', 'DHL (Khusus Pengiriman Internasional)': 'DHL'}
LEMBAGA = {'Legalisasi Kemenlu': 'Kementerian Luar Negeri', 'Legalisasi Kemenkumham': 'Kementerian Hukum (AHU)',
           'Legalisasi Notaris': 'Notaris', 'Legalisasi Kemenag': 'Kementerian Agama'}   # 'Legalisasi Malaysia' -> tidak pasti
COUNTRY = {'italy': 'Italia', 'italia': 'Italia', 'jerman': 'Jerman', 'germany': 'Jerman', 'singapura': 'Singapura', 'singapore': 'Singapura', 'tajikistan': 'Tajikistan'}
INTERNAL_TR = {'Devana', 'Elyonai', 'Zahra', 'Wita'}            # pengguna role penerjemah di sistem baru
HONOR = re.compile(r'^(pak|bapak|bu|ibu)\s+', re.I)

def split_lang(s):
    s = re.sub(r'(?i)^non\s*sworn\s*', '', clean(s))
    parts = [p.strip() for p in re.split(r'\s*-\s*', s) if p.strip()]
    if len(parts) != 2: return None, None
    return tuple(LANG.get(p.title() if p.islower() else p, p) for p in parts)

def translator_ref(v):
    v = clean(v)
    if not v: return {'kind': 'none', 'raw': ''}
    if v == 'NONACTIVE': return {'kind': 'none', 'raw': v}
    if v == 'Jakarta | 247': return {'kind': 'office', 'raw': v, 'branch': 'Jakarta'}
    if '|' in v:
        lang, name = [x.strip() for x in v.split('|', 1)]
        return {'kind': 'vendor', 'raw': v, 'name': name, 'key': HONOR.sub('', name).strip(), 'lang': LANG.get(lang, lang)}
    if v == 'Indotrans': return {'kind': 'vendor', 'raw': v, 'name': 'Indotrans', 'key': 'Indotrans', 'lang': ''}
    if v in INTERNAL_TR: return {'kind': 'user', 'raw': v, 'name': v}
    return {'kind': 'unknown_user', 'raw': v, 'name': v}   # Dyah (proofreader), Fuadah, Kaysha, Dwi, Nita

def ship_parse(t):
    t = clean(t)
    if not t: return None
    lines = [l.strip() for l in t.split('\n')]
    if all(re.match(r'(?i)^(nama|no\.?\s*hp|alamat)\s*:?\s*$', l) for l in lines if l): return None
    att = phone = ''; rest = []
    for l in lines:
        if not l: continue
        m = re.match(r'(?i)^(nama|name)\s*[:.]\s*(.*)$', l)
        if m and not att: att = m.group(2).strip(); continue
        m = re.match(r'(?i)^(nomor\s*hp|no\.?\s*hp|no\.?\s*wa|nomer|mobile number)\s*[:.]\s*(.*)$', l)
        if m and not phone: phone = m.group(2).strip(); continue
        if re.match(r'(?i)^jenis ekspedisi', l): continue
        rest.append(re.sub(r'(?i)^(alamat( pengiriman| penerima| kirim hardcopy| pengiriman hardcopy)?[^:]*)\s*[:.]\s*', '', l))
    street = ', '.join(x for x in rest if x)
    return {'attention': att, 'phone': phone, 'street1': street, 'street2': '', 'city': '', 'state': '', 'zip': '', 'country': '', 'raw': t}

def docs_from(detail):
    nums = [re.sub(r'^\s*\d+\s*[.)]?\s*', '', l).strip() for l in detail.split('\n') if re.match(r'^\s*\d+\s*[.)]?\s+\S', l)]
    return [n for n in nums if n]

def stage_for(cat, flow, status, proses, ship_courier, tr_assigned):
    st = clean(status).replace('–', '-')
    p = clean(proses)
    if st.startswith('Delivered') or st.startswith('Completed'): return 'selesai', 'Status lama: selesai/terkirim'
    if flow == 'tr_ext': return 'pengajuan', 'Alur vendor = pembayaran; status pembayaran tidak ada di sumber'
    if flow in ('ap_int', 'lg_int'):
        if st.startswith('Softcopy Sent') or st.startswith('Draft Sent'): return 'diproses', None
        if st.startswith('Ordered') or p == 'A : Sudah Dipesan': return 'antrian', None
        return 'cs_upload', None
    if flow == 'jl': return 'proses', None
    # tr_int
    if p.startswith('O :'):
        if st.startswith('Softcopy Sent') and ship_courier == 'Softcopy Saja': return 'siap_kirim', None
        return 'siap_print', 'Final/diotorisasi; status cetak tidak tercatat'
    if p == 'P : Siap Diproofreader': return 'proofread', None
    if p == 'P : Sedang Dikerjakan': return ('penerjemahan' if tr_assigned else 'pilih_penerjemah'), None
    if p in ('A : Belum Dikerjakan', 'A : Sudah Dipesan'): return ('penerjemahan' if tr_assigned else 'pilih_penerjemah'), None
    return 'cs_input', 'Proses Terjemahan kosong di sumber'

groups = collections.OrderedDict(); review = []; mapping = []; seen_rows = set(); dup_rows = []
for idx, r in enumerate(R, start=2):
    raw_inv = clean(r.get('No. Invoice'))
    fp = hashlib.sha1(json.dumps({k: clean(v) for k, v in r.items()}, sort_keys=True).encode()).hexdigest()
    if fp in seen_rows: dup_rows.append({'row': idx, 'invoice': raw_inv}); continue
    seen_rows.add(fp)
    if not raw_inv:
        review.append({'row': idx, 'invoice': '', 'issue': 'Nomor invoice kosong — tidak digabung, dibuat proyek tersendiri berbasis baris'}); base, suffix = f'ROW-{idx}', ''
    else:
        m = re.match(r'^(\d{6,})\s*(.*)$', raw_inv)
        base, suffix = (m.group(1), m.group(2).strip()) if m else (raw_inv, '')
    cat = clean(r.get('Kategori')).lower() or 'jasa_lain'
    tr = translator_ref(r.get('Penerjemah'))
    if cat == 'terjemahan':
        flow = 'tr_ext' if tr['kind'] == 'vendor' else 'tr_int'
    elif cat in ('apostille', 'legalisasi'):
        flow = ('ap' if cat == 'apostille' else 'lg') + ('_ext' if tr['kind'] == 'vendor' else '_int')
    else: flow = 'jl'
    detail = clean(r.get('Detail Layanan'))
    docs = docs_from(detail)
    courier_raw = clean(r.get('Pengiriman Via')); courier = COURIER.get(courier_raw, '')
    if courier_raw and not courier: review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Kurir "{courier_raw}" tidak ada padanan — dikosongkan'})
    ship_c = courier
    stage, note = stage_for(cat, flow, r.get('Status'), r.get('Proses Terjemahan'), ship_c, tr['kind'] == 'user')
    lf = lt = None; country = ''; inst_name = ''
    prod = clean(r.get('Bahasa/Produk'))
    if cat == 'terjemahan':
        lf, lt = split_lang(prod)
        if not lf: review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Bahasa "{prod}" tidak bisa dipisah'})
    if cat == 'apostille':
        m = re.search(r'(?i)tujuan\s*(?:negara)?\s*:?\s*([A-Za-z]+)', detail)
        if m: country = COUNTRY.get(m.group(1).lower(), m.group(1).title())
    if cat == 'legalisasi':
        inst_name = LEMBAGA.get(prod, '')
        if not inst_name: review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Lembaga "{prod}" tidak ada padanan pasti di master — dikosongkan'})
    n_docs = r.get('Jumlah Dokumen'); n_pages = r.get('Jumlah Halaman')
    title = docs[0] if docs else (prod or cat.title())
    if len(docs) > 1: title = f'{docs[0]} (+{len(docs) - 1})'
    sub = {
        'legacy_key': raw_inv or f'ROW-{idx}', 'type': cat, 'flow': flow, 'stage': stage, 'title': title[:120],
        'description': '\n'.join(f'{i + 1}. {d}' for i, d in enumerate(docs)) if docs else detail,
        'file_count': int(n_docs) if isinstance(n_docs, (int, float)) else None,
        'pages': int(n_pages) if isinstance(n_pages, (int, float)) else None,
        'docs': [{'desc': docs[0], 'pages': int(n_pages)}] if (cat == 'terjemahan' and len(docs) == 1 and isinstance(n_pages, (int, float))) else None,
        'lang_from': lf or '', 'lang_to': lt or '', 'country': country, 'institution_name': inst_name,
        'translator_ref': tr, 'deadline': dmy(r.get('Deadline Penerjemah')), 'priority_raw': clean(r.get('Tipe Proses')),
        'legacy': {k: clean(v) for k, v in r.items() if k not in ('Alamat Pengiriman',)},
        'legacy_note': note, 'legacy_row': idx,
    }
    if tr['kind'] == 'unknown_user': review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Penerjemah "{tr["raw"]}" tidak terdaftar sebagai pengguna penerjemah — dikosongkan'})
    if tr['kind'] == 'office' and cat == 'terjemahan': review.append({'row': idx, 'invoice': raw_inv, 'issue': 'Penerjemah "Jakarta | 247" pada terjemahan'})
    if tr['kind'] == 'office' and clean(r.get('Print-out')) == 'Mitra | Penerjemah': review.append({'row': idx, 'invoice': raw_inv, 'issue': 'Eksekutor "Jakarta | 247" tapi Print-out "Mitra | Penerjemah" — dicatat internal, mohon cek'})
    if cat == 'apostille' and clean(r.get('Tujuan Negara Apostille')): review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Kode negara apostille "{clean(r.get("Tujuan Negara Apostille"))}" tidak punya tabel padanan' + (f' (teks detail: {country})' if country else ' — negara dikosongkan')})
    if note and flow == 'tr_ext': review.append({'row': idx, 'invoice': raw_inv, 'issue': 'Subproyek vendor: biaya/layanan/pembayaran tidak ada di sumber — tahap "Pengajuan Vendor", nominal kosong'})
    if sub['docs'] is None and cat == 'terjemahan' and len(docs) > 1: pass
    pr = clean(r.get('Print-out')); pr_b = BRANCH.get(pr, pr)
    proj = groups.get(base)
    head = {
        'invoice_no': base, 'branch': branch(r.get('Cabang')), 'customer_name': clean(r.get('Nama Pelanggan')),
        'print_location': pr_b if pr_b in KNOWN_BRANCH else '', 'print_raw': pr, 'cs_raw': clean(r.get('Nama CS')),
        'priority': PRIORITY.get(clean(r.get('Tipe Proses')), clean(r.get('Tipe Proses'))), 'received_at': dmy(r.get('Timestamp')),
        'courier_name': courier, 'courier_raw': courier_raw, 'ship': ship_parse(r.get('Alamat Pengiriman')), 'notes': clean(r.get('Catatan')),
        'deadline_softcopy': dmy(r.get('Deadline Softcopy')),
    }
    if pr and not head['print_location']: review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Print-out "{pr}" bukan cabang — lokasi print dikosongkan'})
    if head['priority'] not in ('Normal', 'Speed', 'Super Speed', 'Sameday') and head['priority']:
        review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Tipe proses "{head["priority"]}" belum dipetakan ke Normal/Speed/Super Speed/Sameday — disimpan apa adanya'})
    if proj is None:
        proj = groups[base] = {**head, 'subs': [], 'notes_all': [head['notes']] if head['notes'] else [], 'conflicts': []}
    else:
        for k in ('branch', 'customer_name', 'print_location', 'cs_raw', 'priority', 'courier_name'):
            if head[k] and proj[k] and head[k] != proj[k]:
                # Nama pelanggan tidak disalin ke catatan konflik (bisa ikut ke berkas tinjauan).
                if k == 'customer_name': proj['conflicts'].append({'field': k, 'row': idx})
                else: proj['conflicts'].append({'field': k, 'kept': proj[k], 'other': head[k], 'row': idx})
            if head[k] and not proj[k]: proj[k] = head[k]
        if head['ship'] and not proj['ship']: proj['ship'] = head['ship']
        elif head['ship'] and proj['ship'] and head['ship']['raw'] != proj['ship']['raw']: proj['conflicts'].append({'field': 'alamat', 'row': idx})
        if head['notes'] and head['notes'] not in proj['notes_all']: proj['notes_all'].append(head['notes'])
        if head['received_at'] and (not proj['received_at'] or head['received_at'] < proj['received_at']): proj['received_at'] = head['received_at']
    # subproyek sama persis (kategori+detail+bahasa) di invoice yang sama -> catat, tetap simpan sebagai pekerjaan terpisah
    sig = (cat, sub['description'], sub['lang_from'], sub['lang_to'], prod)
    for s0 in proj['subs']:
        if (s0['type'], s0['description'], s0['lang_from'], s0['lang_to'], s0['legacy'].get('Bahasa/Produk')) == sig:
            review.append({'row': idx, 'invoice': raw_inv, 'issue': f'Detail sama dengan baris {s0["legacy_row"]} pada invoice {base} — disimpan terpisah, mohon cek duplikasi'})
    proj['subs'].append(sub)
    mapping.append({'baris_sumber': idx, 'invoice_lama': raw_inv, 'proyek_baru': base, 'subproyek_key': sub['legacy_key'], 'kategori': cat, 'alur': flow, 'tahap': stage})

projects = []
for base, p in groups.items():
    dls = [s['deadline'] for s in p['subs'] if s['deadline']]
    p['deadline'] = min(dls) if dls else None
    p['notes'] = '\n'.join(p.pop('notes_all'))
    for c in p['conflicts']:
        if c['field'] in ('alamat', 'customer_name'):
            review.append({'row': c['row'], 'invoice': base, 'issue': f'Beda {c["field"]} antar baris — nilai pribadi tidak disalin ke catatan'})
        else:
            review.append({'row': c['row'], 'invoice': base, 'issue': f'Beda {c["field"]} antar baris: dipakai "{c["kept"]}", baris lain "{c["other"]}"'})
    if len({s['deadline'] for s in p['subs']}) > 1: review.append({'row': p['subs'][0]['legacy_row'], 'invoice': base, 'issue': 'Deadline subproyek berbeda — deadline proyek = paling awal; deadline tiap sub disimpan di sub'})
    projects.append(p)

json.dump({'source': SRC.split('/')[-1], 'generated_at': datetime.now().isoformat(timespec='seconds'), 'rows': len(R), 'duplicate_rows': dup_rows,
           'projects': projects, 'review': review}, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
with open(OUT_MAP, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(mapping[0].keys())); w.writeheader(); w.writerows(mapping)
multi = [p for p in projects if len(p['subs']) > 1]
print('rows', len(R), 'projects', len(projects), 'subs', sum(len(p['subs']) for p in projects), 'multi', len(multi), 'dups', len(dup_rows), 'review', len(review))
for p in multi: print(' ', p['invoice_no'], [ (s['legacy_key'], s['type'], s['stage']) for s in p['subs']])
print(collections.Counter(x['issue'].split('"')[0][:45] for x in review).most_common())
