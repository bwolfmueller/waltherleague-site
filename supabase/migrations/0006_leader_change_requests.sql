-- Leader change requests.
-- A chair or co-chair proposes their chapter's new leaders (chair, co-chairs, pastoral sponsor).
-- Nothing changes until the office approves. Approving replaces the chapter's leader records,
-- updates who receives the chapter's two email addresses, and marks the chapter renewed.
--
-- To undo:
--   drop function public.approve_leader_change(uuid, boolean);
--   drop table public.leader_changes;

create table public.leader_changes (
  id uuid primary key default gen_random_uuid(),
  chapter_id text not null references public.chapters(id) on delete cascade,
  -- the full proposed list: [{role, full_name, email, congregation, city, state}, ...]
  -- congregation, city, and state are filled in for the pastoral sponsor only
  leaders jsonb not null check (jsonb_typeof(leaders) = 'array' and jsonb_array_length(leaders) between 3 and 12),
  note text not null default '' check (char_length(note) <= 2000),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Declined')),
  requested_by uuid references public.profiles(id) on delete set null,
  requested_by_name text not null default '',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now()
);

-- one open request per chapter at a time
create unique index leader_changes_one_pending on public.leader_changes (chapter_id) where status = 'Pending';
create index leader_changes_chapter_idx on public.leader_changes (chapter_id, created_at desc);

alter table public.leader_changes enable row level security;

create policy leader_changes_office on public.leader_changes
  for all using (public.is_office()) with check (public.is_office());

-- chairs and co-chairs: see their own chapter's requests, send a new one, withdraw one still waiting
create policy leader_changes_chair_read on public.leader_changes
  for select using (public.is_chair_of(chapter_id));

create policy leader_changes_chair_send on public.leader_changes
  for insert to authenticated
  with check (public.is_chair_of(chapter_id) and status = 'Pending' and requested_by = auth.uid()
              and decided_by is null and decided_at is null and decision_note = '');

create policy leader_changes_chair_withdraw on public.leader_changes
  for delete to authenticated
  using (public.is_chair_of(chapter_id) and status = 'Pending');

-- Approve a request (office only).
-- If the pastoral sponsor is a different man than the one on record, the office must first
-- confirm he is an active LCMS pastor in the chapter's city and pass sponsor_verified = true.
create function public.approve_leader_change(change_id uuid, sponsor_verified boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c public.leader_changes;
  sp jsonb;
  old_email text;
  n_chair int; n_co int; n_sp int; n_bad int;
  aid uuid;
begin
  if not public.is_office() then raise exception 'Office only'; end if;
  select * into c from public.leader_changes where id = change_id for update;
  if not found then raise exception 'Request not found'; end if;
  if c.status <> 'Pending' then raise exception 'This request was already %', lower(c.status); end if;

  select count(*) filter (where e->>'role' = 'chair'),
         count(*) filter (where e->>'role' = 'cochair'),
         count(*) filter (where e->>'role' = 'pastoral_sponsor'),
         count(*) filter (where coalesce(trim(e->>'full_name'), '') = '' or coalesce(trim(e->>'email'), '') !~ '^\S+@\S+\.\S+$'
                             or coalesce(e->>'role', '') not in ('chair', 'cochair', 'pastoral_sponsor'))
    into n_chair, n_co, n_sp, n_bad
    from jsonb_array_elements(c.leaders) e;
  if n_bad > 0 then raise exception 'Every leader needs a role, a name, and an email address'; end if;
  if n_chair <> 1 then raise exception 'A chapter has exactly one chair'; end if;
  if n_co < 1 then raise exception 'A chapter needs at least one co-chair'; end if;
  if n_sp <> 1 then raise exception 'A chapter has exactly one pastoral sponsor'; end if;

  select e into sp from jsonb_array_elements(c.leaders) e where e->>'role' = 'pastoral_sponsor';
  select lower(email) into old_email from public.chapter_leaders
   where chapter_id = c.chapter_id and role = 'pastoral_sponsor' limit 1;
  if (old_email is null or old_email <> lower(trim(sp->>'email'))) and not sponsor_verified then
    raise exception 'The new pastoral sponsor has not been verified as an active LCMS pastor';
  end if;

  -- replace the leader records; a chair or co-chair who stays on keeps their sign-in link
  with gone as (
    delete from public.chapter_leaders where chapter_id = c.chapter_id returning email, profile_id, role
  )
  insert into public.chapter_leaders (chapter_id, role, full_name, email, congregation, profile_id)
  select c.chapter_id, e->>'role', trim(e->>'full_name'), lower(trim(e->>'email')),
         case when e->>'role' = 'pastoral_sponsor' then coalesce(trim(e->>'congregation'), '') else '' end,
         case when e->>'role' in ('chair', 'cochair') then
           (select g.profile_id from gone g
             where lower(g.email) = lower(trim(e->>'email')) and g.profile_id is not null and g.role in ('chair', 'cochair') limit 1)
         end
  from jsonb_array_elements(c.leaders) e;

  -- the chapter's addresses now go to the new people
  select id into aid from public.email_aliases where chapter_id = c.chapter_id and kind = 'chapter' limit 1;
  if aid is not null then
    delete from public.alias_recipients where alias_id = aid;
    insert into public.alias_recipients (alias_id, email)
    select aid, lower(trim(e->>'email')) from jsonb_array_elements(c.leaders) e where e->>'role' in ('chair', 'cochair')
    on conflict do nothing;
  end if;
  select id into aid from public.email_aliases where chapter_id = c.chapter_id and kind = 'pastor' limit 1;
  if aid is not null then
    delete from public.alias_recipients where alias_id = aid;
    insert into public.alias_recipients (alias_id, email) values (aid, lower(trim(sp->>'email')));
  end if;

  -- confirming the leaders is the yearly renewal
  update public.chapters set renewed_on = current_date where id = c.chapter_id;

  update public.leader_changes set status = 'Approved', decided_by = auth.uid(), decided_at = now() where id = change_id;
  insert into public.change_log (actor_id, actor_name, summary)
  values (auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), ''),
          'Approved new leaders for ' || c.chapter_id || ' and updated its email addresses');
end $$;

revoke execute on function public.approve_leader_change(uuid, boolean) from public, anon;
grant execute on function public.approve_leader_change(uuid, boolean) to authenticated;
