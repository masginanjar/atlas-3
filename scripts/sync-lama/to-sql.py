"""new-projects.json + new-master.json -> berkas SQL batch (on conflict do nothing) + enrich dari zoho_invoices.
Pakai: python3 -I to-sql.py <new-projects.json> <new-master.json> <outdir>"""
import json, sys, os
P = json.load(open(sys.argv[1])); M = json.load(open(sys.argv[2])); OUT = sys.argv[3]; os.makedirs(OUT, exist_ok=True)
esc = lambda s: s.replace("'", "''")
rows = []
for p in P:
    p = dict(p); pid = p.pop('id'); created = p.pop('created_at')
    rows.append(f"('{pid}','{created}','{created}','{esc(json.dumps(p, ensure_ascii=False, separators=(',', ':')))}'::jsonb)")
B = 30; n = 0
for i in range(0, len(rows), B):
    open(f'{OUT}/projects-{i // B}.sql', 'w').write("insert into projects (id, created_at, updated_at, doc) values\n" + ",\n".join(rows[i:i + B]) + "\non conflict (id) do nothing;"); n += 1
mrows = []
for t, items in (('people', M.get('people', [])), ('couriers', M.get('couriers', []))):
    for x in items:
        x = dict(x); xid = x.pop('id'); created = x.pop('created_at', None) or '2026-11-09T00:00:00+08:00'
        mrows.append(f"insert into {t} (id, created_at, updated_at, doc) values ('{xid}','{created}','{created}','{esc(json.dumps(x, ensure_ascii=False))}'::jsonb) on conflict (id) do nothing;")
open(f'{OUT}/master.sql', 'w').write("\n".join(mrows) or 'select 1;')
open(f'{OUT}/enrich.sql', 'w').write("""update projects p set doc = jsonb_set(
  jsonb_set(p.doc, '{customer}', (p.doc->'customer') || jsonb_strip_nulls(jsonb_build_object(
      'zoho_id', z.customer_id, 'phone', nullif(coalesce(z.contact->>'mobile', z.contact->>'phone',''),''),
      'email', nullif(coalesce(z.contact->>'email',''),''), 'name_zoho', z.customer_name))),
  '{about,invoice}', jsonb_build_object('zoho_id', z.zoho_id, 'date', z.date, 'total', z.total, 'balance', z.balance, 'status', z.status, 'org', z.org_name))
from zoho_invoices z where z.invoice_no = p.invoice_no and p.id like 'legacy-%' and p.doc->'about'->'invoice' is null;""")
print('projects', len(rows), 'batch', n, 'master', len(mrows))
