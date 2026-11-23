-- Walther League website: the three small additions the site needs on top of migrations 1 to 3.
-- Nothing here removes or rewrites existing data.
--
-- To undo:
--   drop function public.claim_leadership();
--   alter table public.applications drop column details;
--   then re-run 0003_public_leaders_first_name_only.sql

-- 1. The application form collects more than the main columns hold (phones, mailing
--    addresses, and the two recommendations for the chair and co-chair). They are kept
--    together here so the office can confirm the recommendations. Office-only, like the rest
--    of the application.
alter table public.applications add column details jsonb not null default '{}'::jsonb;

-- 2. Link a signed-in chair or co-chair to their chapter by matching the email address they
--    signed in with against the one the League has on file. Only a confirmed address counts,
--    so a person can only claim a chapter whose leader email they actually control.
create or replace function public.claim_leadership() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  em text;
begin
  if auth.uid() is null then return 0; end if;
  select lower(u.email) into em
    from auth.users u
   where u.id = auth.uid() and u.email_confirmed_at is not null;
  if em is null or em = '' then return 0; end if;
  update public.chapter_leaders
     set profile_id = auth.uid()
   where profile_id is null
     and role in ('chair', 'cochair')
     and lower(email) = em;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.claim_leadership() from public, anon;
grant execute on function public.claim_leadership() to authenticated;

-- 3. Public first names: skip a leading title, so "Rev. Mark Hartmann" shows as "Mark"
--    and not as "Rev.". Same columns as before.
create or replace view public.chapter_leaders_public as
  select l.id,
         l.chapter_id,
         l.role,
         split_part(
           regexp_replace(trim(l.full_name), '^((the|rev|reverend|pastor|pr|dr|fr|mr|mrs|ms|miss)\.?\s+)+', '', 'i'),
           ' ', 1) as first_name
  from public.chapter_leaders l
  join public.chapters c on c.id = l.chapter_id
  where c.published;

grant select on public.chapter_leaders_public to anon, authenticated;
