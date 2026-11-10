-- Nomor register: kode unik 6 angka berlanjut untuk semua arah, melanjutkan nomor terakhir di Google Sheet.
insert into public.app_settings (id, doc) values ('register_awal', '{"key":"register_awal","awal":31406}'::jsonb)
on conflict (id) do nothing;

create or replace function public.next_reg_no(p_lang_code text, p_date date default ((now() at time zone 'Asia/Makassar'))::date)
returns text language sql stable security definer set search_path to 'public' as $$
  with m as (
    select greatest(
      coalesce((select (doc->>'awal')::int from app_settings where id = 'register_awal'), 0),
      coalesce((select max(substr(reg_no, 7, 6)::int) from registrations where reg_no ~ '^4[1-4][0-9]{12}$'), 0)
    ) + 1 as seq
  )
  select p_lang_code || to_char(p_date, 'YYMM') || lpad(seq::text, 6, '0') || to_char(p_date, 'DD')
  from m where public.app_is_staff();
$$;

alter policy reg_update on public.registrations
  using ((select app_role()) = any (array['superadmin','direktur','otorisator','admin_pusat','supervisor']))
  with check ((select app_is_staff()));
