-- ============================================================
--  ATLAS Alfa — skema database InsForge (PostgreSQL)
--  Jalankan di InsForge Dashboard → Database → SQL Editor
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists users (           -- profil & role (login di InsForge Auth, email sama)
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null check (role in ('superadmin','admin_pusat','supervisor','cs','direktur','akunting','penerjemah','proofreader','otorisator','staf_apostille')),
  branch text not null,
  branches text[] default '{}',          -- akses cabang tambahan (CS multi cabang / backup)
  active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz
);

create table if not exists people (          -- master data: penerjemah, proofreader, otorisator, vendor, staf in charge, lembaga legalisasi
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('vendor','lembaga')),  -- penerjemah/proofreader/otorisator/staf apostille = tabel users
  branch text not null default 'Semua',
  phone text,
  address text, contact text,                 -- vendor: alamat & PIC
  services jsonb default '[]',                -- vendor: [{name, price}]
  accounts jsonb default '[]',                -- vendor: [{bank, number, holder}]
  notes text,                                 -- vendor: catatan tambahan
  created_at timestamptz default now(), updated_at timestamptz
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,            -- nama project = no. invoice Zoho
  branch text not null,
  customer jsonb not null,                    -- {zoho_id, name, email, phone}
  about jsonb not null default '{}',          -- {description, deadline, priority, notes}
  sub_projects jsonb not null default '[]',   -- [{id,type,title,description,file_count,pages,pages_manual,translator,lang_from,lang_to,country,institution,executor_kind,executor_id,translator_kind,flow,stage,data,history}]  -- flow: tr_int|tr_ext|ap_int|ap_ext|lg_int|lg_ext|jl
  files jsonb not null default '[]',          -- manajemen file project: [{id,name,size,url,drive_id,sub_id,uploaded_at,by}]
  created_by text,
  created_at timestamptz default now(), updated_at timestamptz
);
create index if not exists projects_branch_idx on projects(branch);

create table if not exists petty_cash (      -- mutasi petty cash apostille per cabang
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  type text not null check (type in ('in','out')),
  amount numeric not null check (amount > 0),
  note text,
  project_id uuid references projects(id) on delete set null,
  by text,
  sub_id text,                                -- biaya apostille/legalisasi per sub project
  created_at timestamptz default now(), updated_at timestamptz
);

create table if not exists couriers (        -- pilihan kurir (dikelola di Setting → Kurir)
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'courier' check (type in ('softcopy','pickup','courier')),
  icon text default 'truck',
  color text default '#64748b',
  logo text,                                  -- gambar logo (data URL kecil), opsional
  "order" int default 99,
  created_at timestamptz default now(), updated_at timestamptz
);
insert into couriers (name, type, icon, color, "order") values
  ('Softcopy Saja','softcopy','file','#64748b',1), ('Diambil di Kantor','pickup','store','#1f4fd1',2),
  ('Gojek','courier','bike','#00a651',3), ('Grab','courier','bike','#00b14f',4),
  ('J&T','courier','truck','#d71920',5), ('JNE','courier','package','#1b3d8f',6);

create table if not exists requests (       -- pengajuan umum tanpa invoice: topup / refund / lain
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('topup','refund','lain')),
  branch text not null,
  fund text,                                  -- kas tujuan top up (cabang / 'Apostille')
  amount numeric not null,
  purpose text,
  project_id uuid references projects(id) on delete set null,   -- refund
  recipient jsonb default '{}'::jsonb, attachment jsonb,
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','dibayar','ditolak')),
  requested_by uuid, requested_name text,
  sumber_dana text, approved_by uuid, approved_name text, approved_at timestamptz,
  rejected_reason text, rejected_name text, rejected_at timestamptz,
  bukti_transfer jsonb, paid_date date, paid_by uuid, paid_name text, paid_at timestamptz,
  history jsonb default '[]'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz
);

create table if not exists perf_daily (     -- riwayat "Performa Hari Ini" (1 baris per user per hari, zona Asia/Makassar)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  done int not null default 0, total int not null default 0, waiting int not null default 0, overdue int not null default 0,
  pct int,                                    -- null = tidak ada deadline hari itu
  updated_at_local timestamptz, created_at timestamptz default now(), updated_at timestamptz,
  unique (user_id, day)
);

create table if not exists notifications (   -- notifikasi in-app
  id uuid primary key default gen_random_uuid(),
  to_user uuid, to_role text, to_branch text, -- tujuan: user tertentu / role (+cabang) / seluruh staf cabang
  text text not null,
  project_id uuid references projects(id) on delete cascade,
  by text,
  read_by jsonb not null default '[]',        -- daftar user id yang sudah membaca
  created_at timestamptz default now(), updated_at timestamptz
);

-- Superadmin pertama (ganti email), lalu buat akun login dengan email yang sama di InsForge → Auth
insert into users (name, email, role, branch) values ('Super Admin', 'admin@contoh.com', 'superadmin', 'Bali')
on conflict (email) do nothing;

-- ------------------------------------------------------------
--  Hak akses (RLS): hanya user login yang terdaftar & aktif.
--  Pembatasan per cabang juga diterapkan di aplikasi; perketat
--  di sini bila diperlukan (lihat README bagian Keamanan).
-- ------------------------------------------------------------
create or replace function atlas_me() returns users language sql stable security definer as $$
  select * from users where email = (select email from auth.users where id = auth.uid()) and active limit 1
$$;

alter table users enable row level security;
alter table people enable row level security;
alter table projects enable row level security;
alter table petty_cash enable row level security;
alter table couriers enable row level security;
alter table notifications enable row level security;

create policy users_read on users for select to authenticated using (true);
create policy users_admin on users for all to authenticated using ((atlas_me()).role = 'superadmin') with check ((atlas_me()).role = 'superadmin');

create policy people_read on people for select to authenticated using ((atlas_me()).id is not null);
create policy people_write on people for all to authenticated using ((atlas_me()).role in ('superadmin','admin_pusat','supervisor','akunting')) with check ((atlas_me()).role in ('superadmin','admin_pusat','supervisor','akunting'));

-- Penerjemah/proofreader/otorisator & staf cabang Print bekerja lintas cabang → akses baca/ubah project
-- dibuka untuk role tersebut; pembatasan tampilan per penugasan dilakukan di aplikasi.
create policy projects_rw on projects for all to authenticated
  using ((atlas_me()).role in ('superadmin','admin_pusat','supervisor','direktur','akunting','penerjemah','proofreader','otorisator')
         or branch = (atlas_me()).branch or about->>'print_location' = (atlas_me()).branch
         or branch = any((atlas_me()).branches) or about->>'print_location' = any((atlas_me()).branches))
  with check ((atlas_me()).role in ('superadmin','admin_pusat','supervisor','direktur','akunting','penerjemah','proofreader','otorisator')
         or branch = (atlas_me()).branch or about->>'print_location' = (atlas_me()).branch
         or branch = any((atlas_me()).branches) or about->>'print_location' = any((atlas_me()).branches));

create policy couriers_read on couriers for select to authenticated using ((atlas_me()).id is not null);
create policy couriers_write on couriers for all to authenticated using ((atlas_me()).role in ('superadmin','admin_pusat','supervisor')) with check ((atlas_me()).role in ('superadmin','admin_pusat','supervisor'));

alter table requests enable row level security;
create policy requests_rw on requests for all to authenticated
  using ((atlas_me()).role in ('superadmin','admin_pusat','supervisor','direktur','akunting') or branch = (atlas_me()).branch
         or branch = any((atlas_me()).branches) or requested_by = (atlas_me()).id)
  with check ((atlas_me()).id is not null);

alter table perf_daily enable row level security;
-- pengguna hanya melihat & menyimpan riwayatnya sendiri; pimpinan boleh membaca (ringkasan tim, tanpa leaderboard)
create policy perf_read on perf_daily for select to authenticated
  using (user_id = (atlas_me()).id or (atlas_me()).role in ('superadmin','admin_pusat','supervisor','direktur'));
create policy perf_write on perf_daily for all to authenticated using (user_id = (atlas_me()).id) with check (user_id = (atlas_me()).id);

create policy notif_rw on notifications for all to authenticated using ((atlas_me()).id is not null) with check ((atlas_me()).id is not null);

create policy petty_read on petty_cash for select to authenticated
  using ((atlas_me()).role in ('superadmin','admin_pusat','direktur','akunting') or branch = (atlas_me()).branch
         or branch = any((atlas_me()).branches) or (branch = 'Apostille' and (atlas_me()).role = 'supervisor'));
create policy petty_insert on petty_cash for insert to authenticated
  with check ((atlas_me()).role = 'superadmin' or (type = 'out' and (branch = (atlas_me()).branch
         or (branch = 'Apostille' and (atlas_me()).role in ('supervisor','direktur')))));

-- ------------------------------------------------------------
--  Privasi pelanggan untuk Penerjemah / Proofreader / Otorisator.
--  UI sudah menyembunyikan kontak & alamat; agar data juga tidak
--  terkirim ke perangkat mereka, arahkan role tsb membaca VIEW ini
--  (hanya nama pelanggan) — lihat README bagian Keamanan.
-- ------------------------------------------------------------
create or replace view projects_worker as
  select id, invoice_no, branch, about - 'resi_no' - 'resi_photo' as about, sub_projects, files, created_by, created_at, updated_at,
         jsonb_build_object('name', customer->>'name') as customer
  from projects;
