create table public.bioscene_rooms (
  room_id text primary key check (room_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,119}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scene jsonb not null check (jsonb_typeof(scene) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict
);

create table public.bioscene_room_members (
  room_id text not null references public.bioscene_rooms(room_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.bioscene_room_audit (
  id bigint generated always as identity primary key,
  room_id text not null references public.bioscene_rooms(room_id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  revision bigint not null check (revision > 0),
  action text not null check (action in ('create', 'update', 'member_add', 'member_remove')),
  created_at timestamptz not null default now()
);

create index bioscene_room_members_user_id_idx on public.bioscene_room_members(user_id);
create index bioscene_room_audit_room_revision_idx on public.bioscene_room_audit(room_id, revision desc);
create index bioscene_room_audit_actor_id_idx on public.bioscene_room_audit(actor_id);
create index bioscene_rooms_owner_id_idx on public.bioscene_rooms(owner_id);
create index bioscene_rooms_updated_by_idx on public.bioscene_rooms(updated_by);
create index bioscene_rooms_updated_at_idx on public.bioscene_rooms(updated_at desc);

alter table public.bioscene_rooms enable row level security;
alter table public.bioscene_room_members enable row level security;
alter table public.bioscene_room_audit enable row level security;

create policy bioscene_rooms_owner_select on public.bioscene_rooms
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy bioscene_rooms_owner_insert on public.bioscene_rooms
  for insert to authenticated
  with check ((select auth.uid()) = owner_id and (select auth.uid()) = updated_by);

create policy bioscene_rooms_owner_update on public.bioscene_rooms
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and (select auth.uid()) = updated_by);

create policy bioscene_rooms_owner_delete on public.bioscene_rooms
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy bioscene_members_self_or_owner_select on public.bioscene_room_members
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.bioscene_rooms room
      where room.room_id = bioscene_room_members.room_id
        and room.owner_id = (select auth.uid())
    )
  );

create policy bioscene_audit_owner_select on public.bioscene_room_audit
  for select to authenticated
  using (
    exists (
      select 1 from public.bioscene_rooms room
      where room.room_id = bioscene_room_audit.room_id
        and room.owner_id = (select auth.uid())
    )
  );

revoke all on table public.bioscene_rooms from anon, authenticated;
revoke all on table public.bioscene_room_members from anon, authenticated;
revoke all on table public.bioscene_room_audit from anon, authenticated;
revoke all on sequence public.bioscene_room_audit_id_seq from anon, authenticated;
