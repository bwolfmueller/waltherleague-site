-- Walther League website: changes needed to connect the site to the database.
-- Run after 0001_initial_schema.sql.

-- A suspended chapter is hidden from the public directory and map.
alter table public.chapters drop constraint chapters_status_check;
alter table public.chapters add constraint chapters_status_check
  check (status in ('Forming', 'Active', 'Inactive', 'Suspended'));

-- Which side of its map pin the chapter name sits on (l, r, t, b).
alter table public.chapters add column map_label text not null default 'r' check (map_label in ('l', 'r', 't', 'b'));

-- Invite links for the chapter's chat spaces, e.g. {"Discord": "https://discord.gg/..."}.
alter table public.chapters add column chat_links jsonb not null default '{}'::jsonb;

-- Remembers a chapter's status while it is suspended, so reinstating restores it.
alter table public.chapters add column prev_status text;

-- Multi-day events.
alter table public.events add column end_date date;

-- The application form collects more than the main columns hold (phones, addresses,
-- recommendations, expected size). They are kept together here for the office to read.
alter table public.applications add column details jsonb not null default '{}'::jsonb;
-- A pastoral sponsor can be left blank; the office helps the chapter find one.
alter table public.applications alter column sponsor_name set default '';
alter table public.applications alter column sponsor_email set default '';

-- Events of suspended chapters are hidden too.
create or replace function public.is_published(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chapters where id = cid and published and status <> 'Suspended');
$$;

-- Public views: rebuilt to hide suspended chapters and to show only first names
-- for chairs and co-chairs (the pastoral sponsor's full name is shown).
drop view public.chapters_public;
drop view public.chapter_leaders_public;

create view public.chapters_public with (security_invoker = false) as
  select id, city, state, lat, lon, setting, school, meets, member_count, status,
         chat_bases, chat_links, text_line, church, about, map_label
  from public.chapters
  where published and status <> 'Suspended';

create view public.chapter_leaders_public with (security_invoker = false) as
  select l.id, l.chapter_id, l.role,
         case when l.role = 'pastoral_sponsor' then l.full_name
              else split_part(l.full_name, ' ', 1) end as display_name
  from public.chapter_leaders l
  join public.chapters c on c.id = l.chapter_id
  where c.published and c.status <> 'Suspended';

grant select on public.chapters_public, public.chapter_leaders_public to anon, authenticated;

-- Chairs may not change the office-only fields of their chapter.
create or replace function public.chapters_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  -- auth.uid() is null for the dashboard, migrations, and server-side code: those are not limited
  if auth.uid() is not null and not public.is_office() then
    if new.id is distinct from old.id or new.city is distinct from old.city
       or new.state is distinct from old.state or new.setting is distinct from old.setting
       or new.school is distinct from old.school or new.status is distinct from old.status
       or new.prev_status is distinct from old.prev_status
       or new.published is distinct from old.published or new.church is distinct from old.church
       or new.lat is distinct from old.lat or new.lon is distinct from old.lon
       or new.map_label is distinct from old.map_label
       or new.renewed_on is distinct from old.renewed_on then
      raise exception 'Only the League office can change that field';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.chapters_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Link a signed-in chair to their chapter by matching the email they signed in with.
-- Only the owner of an email address can sign in with it, so this is safe.
-- ---------------------------------------------------------------------------
create or replace function public.claim_leadership() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.chapter_leaders
     set profile_id = auth.uid()
   where profile_id is null
     and role in ('chair', 'cochair')
     and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.claim_leadership() from public, anon;
grant execute on function public.claim_leadership() to authenticated;

-- ---------------------------------------------------------------------------
-- Create or edit an email address and its recipients in one step (office only).
-- p_id null = create a new general address.
-- ---------------------------------------------------------------------------
create or replace function public.save_alias(
  p_id uuid, p_local text, p_recipients text[], p_active boolean default true, p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  aid uuid := p_id;
  r text;
  clean text[] := '{}';
begin
  if not public.is_office() then raise exception 'Office only'; end if;
  p_local := lower(trim(p_local));
  if p_local !~ '^[a-z0-9][a-z0-9._-]*$' then raise exception 'Use lowercase letters, numbers, dots, or hyphens for the address'; end if;

  foreach r in array coalesce(p_recipients, '{}') loop
    r := lower(trim(r));
    if r = '' then continue; end if;
    if r !~ '^\S+@\S+\.\S+$' then raise exception '% does not look like an email address', r; end if;
    if not (r = any (clean)) then clean := clean || r; end if;
  end loop;
  if p_active and coalesce(array_length(clean, 1), 0) = 0 then
    raise exception 'Add at least one email to forward to';
  end if;

  if aid is null then
    insert into public.email_aliases (local_part, kind, note, active)
    values (p_local, 'general', coalesce(p_note, ''), p_active) returning id into aid;
  else
    update public.email_aliases set local_part = p_local, active = p_active where id = aid;
    if not found then raise exception 'Address not found'; end if;
  end if;

  delete from public.alias_recipients where alias_id = aid;
  insert into public.alias_recipients (alias_id, email) select aid, unnest(clean);
  return aid;
end $$;

revoke all on function public.save_alias(uuid, text, text[], boolean, text) from public, anon;
grant execute on function public.save_alias(uuid, text, text[], boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Change log: fill in who made the change.
-- ---------------------------------------------------------------------------
create or replace function public.change_log_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.actor_id := coalesce(new.actor_id, auth.uid());
  if coalesce(new.actor_name, '') = '' then
    new.actor_name := coalesce((select full_name from public.profiles where id = new.actor_id), '');
  end if;
  return new;
end $$;

create trigger change_log_fill before insert on public.change_log
  for each row execute function public.change_log_fill();
revoke all on function public.change_log_fill() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Publishing: replaces the version in 0001. Adds map position, sensible starting
-- details, collision handling for chapter addresses, and a missing-sponsor case.
-- ---------------------------------------------------------------------------
drop function public.publish_application(text);

create or replace function public.publish_application(
  app_id text, p_lat numeric default null, p_lon numeric default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  a public.applications;
  cid text;
  alias_id uuid;
begin
  if not public.is_office() then raise exception 'Office only'; end if;
  select * into a from public.applications where id = app_id for update;
  if not found then raise exception 'Application not found'; end if;
  if a.stage < 3 then raise exception 'Application is not approved yet'; end if;
  if a.stage = 4 then return a.chapter_id; end if;

  cid := regexp_replace(lower(a.city), '[^a-z0-9]', '', 'g');
  if cid = '' then raise exception 'The city name has no usable letters'; end if;
  if exists (select 1 from public.chapters where id = cid) then cid := cid || lower(a.state); end if;
  if exists (select 1 from public.chapters where id = cid) then
    raise exception 'A chapter with address "%" already exists', cid;
  end if;
  if exists (select 1 from public.email_aliases where local_part in (cid, cid || 'pastor')) then
    raise exception 'The address "%" is already in use', cid;
  end if;

  insert into public.chapters
    (id, city, state, lat, lon, setting, school, meets, member_count, status, chat_bases, church, about, renewed_on, published)
  values
    (cid, a.city, a.state, p_lat, p_lon, a.setting, a.school, 'Time to be announced', 3, 'Forming', a.chat_bases, a.church,
     coalesce(nullif(left(a.why, 160), ''), 'A new chapter getting started. Check back for the first gathering.'),
     current_date, true);

  insert into public.chapter_leaders (chapter_id, role, full_name, email) values
    (cid, 'chair',   a.chair_name,   a.chair_email),
    (cid, 'cochair', a.cochair_name, a.cochair_email);
  if a.sponsor_name <> '' then
    insert into public.chapter_leaders (chapter_id, role, full_name, email)
    values (cid, 'pastoral_sponsor', a.sponsor_name, a.sponsor_email);
  end if;

  insert into public.email_aliases (local_part, kind, chapter_id) values (cid, 'chapter', cid) returning id into alias_id;
  insert into public.alias_recipients values (alias_id, lower(a.chair_email)), (alias_id, lower(a.cochair_email))
    on conflict do nothing;

  -- With no sponsor yet, the pastor address exists but stays paused until the office adds one.
  insert into public.email_aliases (local_part, kind, chapter_id, active)
  values (cid || 'pastor', 'pastor', cid, a.sponsor_email <> '') returning id into alias_id;
  if a.sponsor_email <> '' then
    insert into public.alias_recipients values (alias_id, lower(a.sponsor_email));
  end if;

  update public.applications set stage = 4, chapter_id = cid where id = app_id;
  insert into public.change_log (summary)
  values ('Created ' || cid || ' and ' || cid || 'pastor for the new ' || a.city || ' chapter');
  return cid;
end $$;

revoke all on function public.publish_application(text, numeric, numeric) from public, anon;
grant execute on function public.publish_application(text, numeric, numeric) to authenticated;
