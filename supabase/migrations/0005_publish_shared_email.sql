-- Publishing failed with a "duplicate key" error when the chair and co-chair (for example
-- a married couple) gave the same email address, because the chapter address tried to
-- list that recipient twice. This is the function from migration 2 with one change: a
-- repeated recipient is skipped.

create or replace function public.publish_application(app_id text, chapter_slug text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  a public.applications;
  cid text;
  alias_id uuid;
begin
  if not public.is_office() then raise exception 'Office only'; end if;
  select * into a from public.applications where id = app_id for update;
  if not found then raise exception 'Application not found'; end if;
  if a.stage = 4 then return a.chapter_id; end if;
  if a.stage < 3 then raise exception 'Application is not approved yet'; end if;
  if not a.sponsor_verified then
    raise exception 'The pastoral sponsor has not been verified as an active LCMS pastor';
  end if;

  cid := regexp_replace(lower(coalesce(nullif(chapter_slug, ''),
           case when a.setting = 'Campus' then nullif(a.school, '') end,
           a.city)), '[^a-z0-9]', '', 'g');
  if cid = '' then raise exception 'Could not make a chapter address; pass one in'; end if;
  if exists (select 1 from public.chapters where id = cid) then
    raise exception 'A chapter with address "%" already exists; choose another', cid;
  end if;

  insert into public.chapters (id, city, state, setting, school, status, chat_bases, church, published, renewed_on)
  values (cid, a.city, a.state, a.setting, a.school, 'Forming', a.chat_bases, a.church, true, current_date);

  insert into public.chapter_leaders (chapter_id, role, full_name, email, congregation) values
    (cid, 'chair',            a.chair_name,   a.chair_email,   ''),
    (cid, 'cochair',          a.cochair_name, a.cochair_email, ''),
    (cid, 'pastoral_sponsor', a.sponsor_name, a.sponsor_email, a.sponsor_congregation);

  insert into public.email_aliases (local_part, kind, chapter_id) values (cid, 'chapter', cid) returning id into alias_id;
  insert into public.alias_recipients values (alias_id, a.chair_email), (alias_id, a.cochair_email)
    on conflict do nothing;

  insert into public.email_aliases (local_part, kind, chapter_id) values (cid || 'pastor', 'pastor', cid) returning id into alias_id;
  insert into public.alias_recipients values (alias_id, a.sponsor_email);

  update public.applications set stage = 4, chapter_id = cid where id = app_id;
  insert into public.change_log (actor_id, summary) values (auth.uid(), 'Published chapter ' || cid || ' (' || a.city || ', ' || a.state || ')');
  return cid;
end $$;

revoke execute on function public.publish_application(text, text) from public, anon;
grant execute on function public.publish_application(text, text) to authenticated;
