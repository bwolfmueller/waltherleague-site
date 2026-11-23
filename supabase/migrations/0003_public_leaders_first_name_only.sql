-- Applied to the live project on Nov 23, 2026 (version 20261123180021).
-- This file is a copy of what the database recorded, kept here so the folder matches the live project.

drop view public.chapter_leaders_public;

create view public.chapter_leaders_public as
  select l.id,
         l.chapter_id,
         l.role,
         split_part(trim(l.full_name), ' ', 1) as first_name
  from public.chapter_leaders l
  join public.chapters c on c.id = l.chapter_id
  where c.published;

grant select on public.chapter_leaders_public to anon, authenticated;
