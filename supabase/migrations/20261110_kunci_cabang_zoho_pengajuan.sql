-- Audit keamanan 10 Nov 2026: kunci data per cabang di server (RLS).
-- 1) Zoho (invoice, pembayaran, kontak) hanya cabang sendiri / yang beririsan
-- 2) Pengajuan & petty cash: status ACC/Dibayar hanya oleh peran yang berhak
-- 3) Registrasi dokumen hanya cabang sendiri / proyek yang terlihat
-- 5) Fungsi publik ditutup untuk pengguna tanpa login

-- ── Kode cabang dari nomor invoice (sama dengan BRANCH_CODES di access.js)
create or replace function public.inv_branch(no text)
returns text language sql immutable set search_path = '' as $$
  select case substring(no from '^\s*INV-(\d{3})')
    when '101' then 'Bali' when '202' then 'Jakarta' when '303' then 'Bandung'
    when '304' then 'Yogyakarta' when '305' then 'Surabaya' when '306' then 'Medan'
    when '307' then 'Semarang' when '308' then 'Makassar' when '309' then 'Batam'
    when '209' then 'Batam' end
$$;

-- ── Organisasi Zoho milik cabang pengguna (dipakai untuk kontak pelanggan)
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.app_org_ids()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct i.org_id), '{}')
  from public.zoho_invoices i
  where (select auth.uid()) is not null
    and public.inv_branch(i.invoice_no) = any(coalesce(public.app_branches(), '{}'))
$$;
grant execute on function private.app_org_ids() to authenticated;

-- ── 1. Zoho invoices
alter policy zi_select on public.zoho_invoices to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or ((select public.app_role()) <> all(array['penerjemah','proofreader','otorisator','vendor'])
        and public.inv_branch(invoice_no) = any(coalesce((select public.app_branches()), '{}')))
    or exists (select 1 from public.projects p where p.invoice_no = zoho_invoices.invoice_no)
  ));

alter policy zp_select on public.zoho_payments to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or exists (select 1 from public.zoho_invoices i where i.invoice_no = zoho_payments.invoice_no)
  ));

alter policy zc_select on public.zoho_contacts to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or ((select public.app_role()) <> all(array['penerjemah','proofreader','otorisator','vendor']) and (
          org_id = any(coalesce((select private.app_org_ids()), '{}'))
          or exists (select 1 from public.zoho_invoices i where i.customer_id = zoho_contacts.zoho_id)))
  ));

-- ── 3. Registrasi dokumen
alter policy reg_select on public.registrations to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor','otorisator'])
    or created_by = (select public.app_user_id())
    or (project_id is not null and exists (select 1 from public.projects p where p.id = registrations.project_id))
    or (invoice_no is not null and exists (select 1 from public.projects p where p.invoice_no = registrations.invoice_no))
    or public.inv_branch(invoice_no) = any(coalesce((select public.app_branches()), '{}'))
  ));

-- ── 2a. Pengajuan (requests)
alter policy requests_write_ins on public.requests to authenticated with check (
  (select public.app_is_staff()) and ((select public.app_sees_all()) or branch is null
    or branch = any(coalesce((select public.app_branches()), '{}'))));
alter policy requests_write_upd on public.requests to authenticated
  using ((select public.app_is_staff()) and ((select public.app_sees_all())
    or branch = any(coalesce((select public.app_branches()), '{}'))
    or (doc->>'requested_by') = (select public.app_user_id())))
  with check ((select public.app_is_staff()) and ((select public.app_sees_all()) or branch is null
    or branch = any(coalesce((select public.app_branches()), '{}'))
    or (doc->>'requested_by') = (select public.app_user_id())));
alter policy requests_write_del on public.requests to authenticated using (
  (select public.app_role()) = any(array['superadmin','direktur'])
  or ((doc->>'requested_by') = (select public.app_user_id()) and coalesce(doc->>'status','menunggu') = 'menunggu'));

create or replace function public.requests_jaga_status()
returns trigger language plpgsql set search_path = public as $$
declare r text; lama text; baru text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if; -- server/edge function
  r := public.app_role();
  baru := coalesce(new.doc->>'status', 'menunggu');
  if tg_op = 'INSERT' then
    if baru <> 'menunggu' and r not in ('superadmin','direktur','akunting') then
      raise exception 'Pengajuan baru harus berstatus menunggu';
    end if;
    return new;
  end if;
  lama := coalesce(old.doc->>'status', 'menunggu');
  if baru is distinct from lama then
    if baru in ('disetujui','ditolak') and r not in ('superadmin','direktur') then
      raise exception 'Hanya Direktur yang bisa ACC / menolak pengajuan';
    elsif baru = 'dibayar' and r not in ('superadmin','akunting') then
      raise exception 'Hanya Akunting yang bisa menandai pengajuan dibayar';
    elsif baru not in ('disetujui','ditolak','dibayar') and r not in ('superadmin','direktur','akunting') then
      raise exception 'Status pengajuan tidak bisa diubah';
    end if;
  elsif lama <> 'menunggu' and r not in ('superadmin','direktur','akunting') and (
        old.doc->'amount' is distinct from new.doc->'amount'
     or old.doc->'sumber_dana' is distinct from new.doc->'sumber_dana'
     or old.doc->'recipient' is distinct from new.doc->'recipient'
     or old.doc->'bukti_transfer' is distinct from new.doc->'bukti_transfer'
     or old.doc->'approved_by' is distinct from new.doc->'approved_by'
     or old.doc->'paid_by' is distinct from new.doc->'paid_by') then
    raise exception 'Pengajuan yang sudah diproses tidak bisa diubah';
  end if;
  return new;
end $$;
create or replace trigger requests_jaga_status before insert or update on public.requests
  for each row execute function public.requests_jaga_status();

-- ── 2b. Petty cash
alter policy petty_select on public.petty_cash to authenticated using (
  (select public.app_is_staff()) and ((select public.app_sees_all())
    or branch = any(coalesce((select public.app_branches()), '{}'))
    or (branch in ('Apostille','APOSTILLE') and (select public.app_role()) = 'staf_apostille')));
alter policy petty_write_ins on public.petty_cash to authenticated with check (
  (select public.app_is_staff())
  and ((select public.app_sees_all()) or branch = any(coalesce((select public.app_branches()), '{}')) or branch in ('Apostille','APOSTILLE'))
  and (coalesce(doc->>'type','out') <> 'in'
       or (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])));
alter policy petty_write_upd on public.petty_cash to authenticated
  using ((select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or (doc->>'by_id') = (select public.app_user_id())
    or (branch in ('Apostille','APOSTILLE') and doc->>'project_id' is not null and doc->>'type' = 'out')))
  with check ((select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or (coalesce(doc->>'type','out') = 'out' and ((doc->>'by_id') = (select public.app_user_id())
        or (branch in ('Apostille','APOSTILLE') and doc->>'project_id' is not null)))));
alter policy petty_write_del on public.petty_cash to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or (doc->>'by_id') = (select public.app_user_id())
    or (branch in ('Apostille','APOSTILLE') and doc->>'project_id' is not null and doc->>'type' = 'out')));

-- ── Tambahan setelah uji: kas & pengajuan tidak terlihat oleh pelaksana (penerjemah dst.)
alter policy petty_select on public.petty_cash to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor'])
    or ((select public.app_role()) <> all(array['penerjemah','proofreader','otorisator','vendor'])
        and branch = any(coalesce((select public.app_branches()), '{}')))
    or (branch in ('Apostille','APOSTILLE') and (select public.app_role()) = 'staf_apostille')));
alter policy requests_select on public.requests to authenticated using (
  (select public.app_is_staff()) and (
    (select public.app_role()) = any(array['superadmin','direktur','akunting','admin_pusat','supervisor','koordinator'])
    or ((select public.app_role()) <> all(array['penerjemah','proofreader','otorisator','vendor'])
        and branch = any(coalesce((select public.app_branches()), '{}')))
    or (doc->>'requested_by') = (select public.app_user_id())));
