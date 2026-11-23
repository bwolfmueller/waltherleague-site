-- Applied to the live project on Nov 23, 2026 (version 20261123175838).
-- This file is a copy of what the database recorded, kept here so the folder matches the live project.

-- 1. Pastoral sponsor details and age confirmation on applications
alter table public.applications
  add column sponsor_congregation text not null default '',
  add column sponsor_city text not null default '',
  add column sponsor_state text not null default '',
  add column sponsor_verified boolean not null default false,
  add column sponsor_verified_at timestamptz,
  add column ages_confirmed boolean not null default false;

alter table public.applications
  add constraint applications_ages_confirmed check (ages_confirmed);

drop policy applications_submit on public.applications;
create policy applications_submit on public.applications
  for insert to anon, authenticated
  with check (stage = 0 and chapter_id is null and sponsor_verified = false and sponsor_verified_at is null);

-- 2. Congregation on chapter leaders (used for the pastoral sponsor)
alter table public.chapter_leaders
  add column congregation text not null default '';

-- 3. Interest map: people who want a Walther League where they live
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  setting text not null default 'City' check (setting in ('Campus', 'City')),
  school text not null default '',
  city text not null,
  state text not null check (char_length(state) = 2),
  lat numeric,
  lon numeric,
  age_confirmed boolean not null check (age_confirmed),
  note text not null default '' check (char_length(note) <= 2000),
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Joined chapter', 'Started chapter', 'Closed')),
  chapter_id text references public.chapters(id),
  created_at timestamptz not null default now()
);

create index interests_place_idx on public.interests (state, city);

alter table public.interests enable row level security;

create policy interests_submit on public.interests
  for insert to anon, authenticated
  with check (status = 'New' and chapter_id is null);

create policy interests_office on public.interests
  for all using (public.is_office()) with check (public.is_office());

-- Public map data: places and counts only, locations rounded to about 7 miles, no names or emails
create or replace function public.interest_map()
returns table (city text, state text, setting text, school text, lat numeric, lon numeric, people integer)
language sql stable security definer set search_path = public
as $$
  select i.city, i.state, i.setting, i.school,
         round(avg(i.lat), 1), round(avg(i.lon), 1), count(*)::int
  from public.interests i
  where i.status in ('New', 'Contacted') and i.lat is not null and i.lon is not null
  group by i.city, i.state, i.setting, i.school;
$$;

grant execute on function public.interest_map() to anon, authenticated;

-- 4. Publishing: require a verified pastor, allow a chosen address, and name campus chapters by school
drop function public.publish_application(text);

create function public.publish_application(app_id text, chapter_slug text default null)
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
  insert into public.alias_recipients values (alias_id, a.chair_email), (alias_id, a.cochair_email);

  insert into public.email_aliases (local_part, kind, chapter_id) values (cid || 'pastor', 'pastor', cid) returning id into alias_id;
  insert into public.alias_recipients values (alias_id, a.sponsor_email);

  update public.applications set stage = 4, chapter_id = cid where id = app_id;
  insert into public.change_log (actor_id, summary) values (auth.uid(), 'Published chapter ' || cid || ' (' || a.city || ', ' || a.state || ')');
  return cid;
end $$;

revoke execute on function public.publish_application(text, text) from public, anon;
grant execute on function public.publish_application(text, text) to authenticated;
