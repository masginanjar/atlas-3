-- Jabatan tersembunyi: akun boleh bertindak SEBAGAI pengguna lain (persona) bila
-- doc->'act_as' akun aslinya memuat id persona itu. Persona yang sedang aktif
-- disimpan per auth user, dan app_user() (dasar semua RLS) mengembalikan persona.
-- (Sudah diterapkan ke project cdeiirdxrxogspqmesik pada 9 Nov 2026.)
create table if not exists public.persona_aktif (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  persona_id text not null,
  updated_at timestamptz not null default now()
);
alter table public.persona_aktif enable row level security;
create policy persona_aktif_sendiri on public.persona_aktif
  for all to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

create or replace function public.app_user()
returns public.users
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select p from public.users u
       join public.persona_aktif pa on pa.auth_id = auth.uid()
       join public.users p on p.id = pa.persona_id and p.active
      where u.auth_id = auth.uid() and u.active
        and coalesce(u.doc->'act_as', '[]'::jsonb) ? pa.persona_id
      limit 1),
    (select u from public.users u where u.auth_id = auth.uid() and u.active limit 1))
$$;

create or replace function public.persona_set(p_id text)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare me public.users;
begin
  select u.* into me from public.users u where u.auth_id = auth.uid() and u.active limit 1;
  if me.id is null then raise exception 'Tidak masuk'; end if;
  if p_id is null or p_id = '' then
    delete from public.persona_aktif where auth_id = auth.uid();
    return null;
  end if;
  if not (coalesce(me.doc->'act_as', '[]'::jsonb) ? p_id) then raise exception 'Tidak berhak memakai persona ini'; end if;
  insert into public.persona_aktif (auth_id, persona_id) values (auth.uid(), p_id)
    on conflict (auth_id) do update set persona_id = excluded.persona_id, updated_at = now();
  return p_id;
end $$;
grant execute on function public.persona_set(text) to authenticated;
