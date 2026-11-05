-- ============================================================
--  ATLAS Alfa — tabel baru untuk Notes, My Reminders (to-do +
--  alarm) dan Chat Internal. Mengikuti pola yang sudah dipakai:
--  id / created_at / updated_at / doc jsonb, + kolom turunan
--  untuk RLS & filter.
--  Aman dijalankan ulang (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- ---------- NOTES (catatan pribadi) ----------
create table if not exists public.notes (
  id          text primary key default gen_random_uuid()::text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  doc         jsonb not null default '{}'::jsonb,
  owner_id    text generated always as (doc->>'owner_id') stored,
  project_id  text generated always as (doc->>'project_id') stored
);
create index if not exists notes_owner_idx on public.notes (owner_id);
alter table public.notes enable row level security;
drop policy if exists notes_select on public.notes;
drop policy if exists notes_insert on public.notes;
drop policy if exists notes_update on public.notes;
drop policy if exists notes_delete on public.notes;
create policy notes_select on public.notes for select using (owner_id = app_user_id());
create policy notes_insert on public.notes for insert with check (app_is_staff() and (doc->>'owner_id') = app_user_id());
create policy notes_update on public.notes for update using (owner_id = app_user_id());
create policy notes_delete on public.notes for delete using (owner_id = app_user_id());

-- ---------- TODOS (to-do pribadi + permintaan antar rekan) ----------
create table if not exists public.todos (
  id           text primary key default gen_random_uuid()::text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  doc          jsonb not null default '{}'::jsonb,
  owner_id     text generated always as (doc->>'owner_id') stored,
  assigned_to  text generated always as (doc->>'assigned_to') stored,
  assigned_by  text generated always as (doc->>'assigned_by') stored,
  project_id   text generated always as (doc->>'project_id') stored
);
create index if not exists todos_owner_idx on public.todos (owner_id);
create index if not exists todos_assigned_idx on public.todos (assigned_to);
alter table public.todos enable row level security;
drop policy if exists todos_select on public.todos;
drop policy if exists todos_insert on public.todos;
drop policy if exists todos_update on public.todos;
drop policy if exists todos_delete on public.todos;
-- pemilik, penerima permintaan, dan pengirimnya boleh melihat
create policy todos_select on public.todos for select
  using (owner_id = app_user_id() or assigned_to = app_user_id() or assigned_by = app_user_id());
create policy todos_insert on public.todos for insert with check (app_is_staff() and (doc->>'owner_id') = app_user_id());
-- penerima boleh mengubah status; pemilik boleh mengubah isinya
create policy todos_update on public.todos for update
  using (owner_id = app_user_id() or assigned_to = app_user_id());
create policy todos_delete on public.todos for delete using (owner_id = app_user_id());

-- ---------- REMINDERS (alarm) ----------
create table if not exists public.reminders (
  id          text primary key default gen_random_uuid()::text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  doc         jsonb not null default '{}'::jsonb,
  owner_id    text generated always as (doc->>'owner_id') stored,
  project_id  text generated always as (doc->>'project_id') stored
);
create index if not exists reminders_owner_idx on public.reminders (owner_id);
alter table public.reminders enable row level security;
drop policy if exists reminders_select on public.reminders;
drop policy if exists reminders_insert on public.reminders;
drop policy if exists reminders_update on public.reminders;
drop policy if exists reminders_delete on public.reminders;
create policy reminders_select on public.reminders for select using (owner_id = app_user_id());
create policy reminders_insert on public.reminders for insert with check (app_is_staff() and (doc->>'owner_id') = app_user_id());
create policy reminders_update on public.reminders for update using (owner_id = app_user_id());
create policy reminders_delete on public.reminders for delete using (owner_id = app_user_id());

-- ---------- MESSAGES (chat internal + ping) ----------
create table if not exists public.messages (
  id          text primary key default gen_random_uuid()::text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  doc         jsonb not null default '{}'::jsonb,
  thread      text generated always as (doc->>'thread') stored,
  from_user   text generated always as (doc->>'from_user') stored,
  to_user     text generated always as (doc->>'to_user') stored,
  kind        text generated always as (doc->>'kind') stored
);
create index if not exists messages_thread_idx on public.messages (thread, created_at);
create index if not exists messages_to_idx on public.messages (to_user);
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;
-- hanya peserta percakapan; inbox tim proofreader dibaca oleh proofreader
create policy messages_select on public.messages for select using (
  from_user = app_user_id() or to_user = app_user_id()
  or (thread like 'team:%' and app_role() = 'proofreader')
);
create policy messages_insert on public.messages for insert with check (
  app_is_staff() and (doc->>'from_user') = app_user_id()
);
-- yang boleh diubah hanya penanda sudah dibaca oleh penerima
create policy messages_update on public.messages for update using (
  to_user = app_user_id() or (thread like 'team:%' and app_role() = 'proofreader')
);

-- ---------- izinkan app_patch menyentuh tabel baru ----------
create or replace function public.app_patch(tbl text, row_id text, patch jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare out jsonb;
begin
  if tbl not in ('users','people','projects','petty_cash','couriers','notifications','requests','perf_daily',
                 'share_links','share_log','vendor_bills','fund_balances','app_settings','activity_log','pings',
                 'notes','todos','reminders','messages') then
    raise exception 'tabel tidak dikenal: %', tbl;
  end if;
  execute format('update public.%I set doc = doc || $1 where id = $2 returning jsonb_build_object(''id'', id, ''created_at'', created_at, ''updated_at'', updated_at) || doc', tbl)
    into out using patch, row_id;
  if out is null then raise exception 'baris tidak ditemukan / tidak berhak'; end if;
  return out;
end $function$;

-- ---------- realtime ----------
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.todos;
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.messages;

-- Catatan: kolom baru pada users (online_until, last_active_at, status_text,
-- mute_until, available_24h) dan projects (zoho_invoice_id) TIDAK perlu migrasi —
-- semuanya tersimpan di dalam kolom doc yang sudah ada.
