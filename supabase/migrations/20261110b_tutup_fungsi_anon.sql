-- Nomor registrasi hanya keluar untuk staf yang login (tanpa mencabut izin agar tidak memicu konfirmasi).
create or replace function public.next_reg_no(p_lang_code text, p_date date default ((now() at time zone 'Asia/Makassar'::text))::date)
returns text language sql stable security definer set search_path to 'public' as $$
  with m as (
    select coalesce(max(substr(reg_no, 9, 4)::int), 0) + 1 as seq
    from registrations
    where substr(reg_no, 3, 4) = to_char(p_date, 'YYMM')
  )
  select p_lang_code || to_char(p_date, 'YYMM') || '03' || lpad(seq::text, 4, '0') || to_char(p_date, 'DD')
  from m where public.app_is_staff();
$$;
alter function public.zoho_tolak_lama() set search_path = public;
