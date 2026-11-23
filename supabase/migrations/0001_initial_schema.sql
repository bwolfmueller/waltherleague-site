-- Walther League website: initial database schema (Supabase / Postgres)
-- Run once in a new, empty Walther League project (SQL editor, or `supabase db push`).
--
-- Who can do what:
--   Visitors (not signed in): read published chapters, events, and chapter leader names.
--                             Send a chapter application or a contact inquiry. Nothing else.
--   Chairs (signed in):       edit their own chapter's page and events.
--   Office (Hanna, Bryan, board): everything, including applications, email aliases, and the change log.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- People who sign in
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'chair' check (role in ('chair', 'office')),
  created_at  timestamptz not null default now()
);

-- Create a profile row automatically when someone is invited or signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Chapters
-- ---------------------------------------------------------------------------
create table public.chapters (
  id            text primary key check (id ~ '^[a-z0-9]+$'),   -- email-safe slug, e.g. 'austin'
  city          text not null,
  state         text not null check (char_length(state) = 2),
  lat           numeric(8,5),
  lon           numeric(8,5),
  setting       text not null check (setting in ('Campus', 'City', 'Region')),  -- never congregational
  school        text not null default '',
  meets         text not null default '',
  member_count  integer not null default 0 check (member_count >= 0),
  status        text not null default 'Forming' check (status in ('Forming', 'Active', 'Inactive')),
  chat_bases    text[] not null default '{}',        -- e.g. {Discord,GroupMe,Instagram}
  text_line     text not null default '',            -- optional chapter Google Voice number
  church        text not null default '',            -- sponsoring pastor's congregation
  about         text not null default '',
  renewed_on    date,                                 -- last yearly leader update
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.chapter_leaders (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  text not null references public.chapters(id) on delete cascade,
  role        text not null check (role in ('chair', 'cochair', 'pastoral_sponsor')),
  full_name   text not null,
  email       text not null,                          -- private: never shown publicly
  profile_id  uuid references public.profiles(id) on delete set null,  -- links a chair to their login
  created_at  timestamptz not null default now()
);
create index on public.chapter_leaders (chapter_id);
create index on public.chapter_leaders (profile_id);

-- ---------------------------------------------------------------------------
-- Events and announcements
-- ---------------------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  text references public.chapters(id) on delete cascade,  -- null = League-wide
  kind        text not null default 'event' check (kind in ('event', 'announcement')),
  title       text not null,
  event_date  date not null,
  event_time  text not null default '',
  place       text not null default '',
  blurb       text not null default '',
  created_at  timestamptz not null default now()
);
create index on public.events (event_date);
create index on public.events (chapter_id);

-- ---------------------------------------------------------------------------
-- Start-a-chapter applications
-- ---------------------------------------------------------------------------
create sequence public.application_number start 1;

create table public.applications (
  id             text primary key default
                   ('WL-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.application_number')::text, 3, '0')),
  city           text not null,
  state          text not null check (char_length(state) = 2),
  setting        text not null check (setting in ('Campus', 'City', 'Region')),
  school         text not null default '',
  chair_name     text not null,
  chair_email    text not null,
  cochair_name   text not null,
  cochair_email  text not null,
  sponsor_name   text not null,
  sponsor_email  text not null,
  church         text not null default '',
  chat_bases     text[] not null default '{}',
  why            text not null default '',
  agreed         boolean not null check (agreed),     -- chapter charter must be accepted
  stage          integer not null default 0 check (stage between 0 and 4),
    -- 0 Received, 1 Pastor confirmed, 2 Recommendations confirmed, 3 Approved, 4 Published
  chapter_id     text references public.chapters(id),
  submitted_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messages sent through the public contact forms
-- ---------------------------------------------------------------------------
create table public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  to_alias      text not null,                         -- e.g. 'austin' or 'austinpastor' or 'help'
  from_name     text not null,
  from_email    text not null,
  about         text not null default '',
  note          text not null check (char_length(note) between 1 and 4000),
  answered      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Email forwarding: one address, many recipients, all editable
-- ---------------------------------------------------------------------------
create table public.email_aliases (
  id          uuid primary key default gen_random_uuid(),
  local_part  text not null unique check (local_part ~ '^[a-z0-9._-]+$'),  -- before the @
  kind        text not null check (kind in ('chapter', 'pastor', 'general')),
  chapter_id  text references public.chapters(id) on delete cascade,
  note        text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.alias_recipients (
  alias_id  uuid not null references public.email_aliases(id) on delete cascade,
  email     text not null,
  primary key (alias_id, email)
);

-- ---------------------------------------------------------------------------
-- Change log (who changed what, shown in the office view)
-- ---------------------------------------------------------------------------
create table public.change_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text not null default '',
  summary     text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions used by the access rules
-- ---------------------------------------------------------------------------
create or replace function public.is_office() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'office');
$$;

create or replace function public.is_chair_of(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chapter_leaders
    where chapter_id = cid and profile_id = auth.uid() and role in ('chair', 'cochair')
  );
$$;

-- ---------------------------------------------------------------------------
-- Keep updated_at current, and limit what a chair may change on a chapter
-- ---------------------------------------------------------------------------
create or replace function public.chapters_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_office() then
    -- chairs may only edit the public-facing details of their own page
    if new.id is distinct from old.id or new.city is distinct from old.city
       or new.state is distinct from old.state or new.setting is distinct from old.setting
       or new.school is distinct from old.school or new.status is distinct from old.status
       or new.published is distinct from old.published or new.church is distinct from old.church
       or new.lat is distinct from old.lat or new.lon is distinct from old.lon
       or new.renewed_on is distinct from old.renewed_on then
      raise exception 'Only the League office can change that field';
    end if;
  end if;
  return new;
end $$;

create trigger chapters_guard before update on public.chapters
  for each row execute function public.chapters_guard();

-- ---------------------------------------------------------------------------
-- Public views (what visitors see; no private emails)
-- ---------------------------------------------------------------------------
create view public.chapters_public with (security_invoker = false) as
  select id, city, state, lat, lon, setting, school, meets, member_count, status,
         chat_bases, text_line, church, about
  from public.chapters where published;

create view public.chapter_leaders_public with (security_invoker = false) as
  select l.id, l.chapter_id, l.role, l.full_name
  from public.chapter_leaders l
  join public.chapters c on c.id = l.chapter_id
  where c.published;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.chapters         enable row level security;
alter table public.chapter_leaders  enable row level security;
alter table public.events           enable row level security;
alter table public.applications     enable row level security;
alter table public.inquiries        enable row level security;
alter table public.email_aliases    enable row level security;
alter table public.alias_recipients enable row level security;
alter table public.change_log       enable row level security;

-- profiles: see your own; office sees and edits all
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_office());
create policy profiles_office_all  on public.profiles for all    using (public.is_office()) with check (public.is_office());

-- chapters: office does everything; chairs read and edit their own
create policy chapters_office_all  on public.chapters for all using (public.is_office()) with check (public.is_office());
create policy chapters_chair_read  on public.chapters for select using (public.is_chair_of(id));
create policy chapters_chair_edit  on public.chapters for update using (public.is_chair_of(id)) with check (public.is_chair_of(id));

-- chapter leaders (contains private emails): office, plus a chair can see their own chapter's leaders
create policy leaders_office_all   on public.chapter_leaders for all using (public.is_office()) with check (public.is_office());
create policy leaders_chair_read   on public.chapter_leaders for select using (public.is_chair_of(chapter_id));

-- events: everyone reads; chairs manage their chapter's events; office manages all
create policy events_public_read   on public.events for select using (true);
create policy events_office_all    on public.events for all using (public.is_office()) with check (public.is_office());
create policy events_chair_write   on public.events for all
  using (chapter_id is not null and public.is_chair_of(chapter_id))
  with check (chapter_id is not null and public.is_chair_of(chapter_id));

-- applications: anyone can submit (stage must start at 0); only the office can read or change them
create policy applications_submit  on public.applications for insert to anon, authenticated
  with check (stage = 0 and chapter_id is null);
create policy applications_office  on public.applications for all using (public.is_office()) with check (public.is_office());

-- inquiries: anyone can send; only the office can read or mark answered
create policy inquiries_send       on public.inquiries for insert to anon, authenticated
  with check (answered = false);
create policy inquiries_office     on public.inquiries for all using (public.is_office()) with check (public.is_office());

-- email forwarding and change log: office only
create policy aliases_office       on public.email_aliases    for all using (public.is_office()) with check (public.is_office());
create policy recipients_office    on public.alias_recipients for all using (public.is_office()) with check (public.is_office());
create policy changelog_office     on public.change_log       for all using (public.is_office()) with check (public.is_office());

-- Visitors read only the public views (they cannot read the base tables with private emails)
grant select on public.chapters_public, public.chapter_leaders_public, public.events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Approving an application publishes the chapter and creates its two addresses
-- (office only). Mirrors the "Create addresses and publish" step in the mockup.
-- ---------------------------------------------------------------------------
create or replace function public.publish_application(app_id text) returns text
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
  if exists (select 1 from public.chapters where id = cid) then
    raise exception 'A chapter with address "%" already exists', cid;
  end if;

  insert into public.chapters (id, city, state, setting, school, status, chat_bases, church, published, renewed_on)
  values (cid, a.city, a.state, a.setting, a.school, 'Forming', a.chat_bases, a.church, true, current_date);

  insert into public.chapter_leaders (chapter_id, role, full_name, email) values
    (cid, 'chair',            a.chair_name,   a.chair_email),
    (cid, 'cochair',          a.cochair_name, a.cochair_email),
    (cid, 'pastoral_sponsor', a.sponsor_name, a.sponsor_email);

  insert into public.email_aliases (local_part, kind, chapter_id) values (cid, 'chapter', cid) returning id into alias_id;
  insert into public.alias_recipients values (alias_id, a.chair_email), (alias_id, a.cochair_email);

  insert into public.email_aliases (local_part, kind, chapter_id) values (cid || 'pastor', 'pastor', cid) returning id into alias_id;
  insert into public.alias_recipients values (alias_id, a.sponsor_email);

  update public.applications set stage = 4, chapter_id = cid where id = app_id;
  insert into public.change_log (actor_id, summary) values (auth.uid(), 'Published chapter ' || a.city || ', ' || a.state);
  return cid;
end $$;

revoke all on function public.publish_application(text) from public, anon;
grant execute on function public.publish_application(text) to authenticated;
