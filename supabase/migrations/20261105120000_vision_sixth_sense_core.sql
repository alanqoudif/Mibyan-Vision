-- Mibyan Vision / Sixth Sense core (additive, reversible; touches no existing table).
-- Rollback: drop the vision_* tables listed at the bottom, in reverse order.

create table if not exists public.vision_senses (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{2,63}$'),
  owner_id uuid references auth.users(id) on delete cascade,   -- null = official built-in
  kind text not null check (kind in ('builtin','flow','code','template','organization')),
  category text not null,
  is_public boolean not null default false,
  latest_version text not null,
  created_at timestamptz not null default now(),
  check ((kind = 'builtin') = (owner_id is null))
);

create table if not exists public.vision_sense_versions (
  sense_id text not null references public.vision_senses(id) on delete cascade,
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object' and pg_column_size(manifest) <= 262144),
  status text not null default 'draft' check (status in ('draft','validated','submitted','published','rejected')),
  created_at timestamptz not null default now(),
  primary key (sense_id, version)
);

create table if not exists public.vision_sense_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sense_id text not null,
  version text not null,
  enabled boolean not null default false,
  granted_permissions text[] not null default '{}',   -- exactly what the user consented to
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 16384),
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sense_id),
  foreign key (sense_id, version) references public.vision_sense_versions(sense_id, version)
);
create index if not exists vision_installations_user_idx on public.vision_sense_installations(user_id, enabled);

create table if not exists public.vision_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists vision_shifts_user_idx on public.vision_shifts(user_id, started_at desc);

create table if not exists public.vision_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid references public.vision_shifts(id) on delete cascade,
  sense_id text,
  type text not null check (type in ('observation','inspection','task_done','task_pending','issue')),
  text text not null check (char_length(text) between 1 and 4000),
  equipment_id text,
  flagged boolean not null default false,
  consented boolean not null default false,   -- only consented records enter a handover
  source text not null default 'device' check (source in ('device','phone','upload','demo')),  -- demo data stays labelled
  created_at timestamptz not null default now()
);
create index if not exists vision_records_shift_idx on public.vision_records(shift_id, created_at);
create index if not exists vision_records_user_idx on public.vision_records(user_id, created_at desc);

create table if not exists public.vision_handovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_id uuid not null references public.vision_shifts(id) on delete cascade,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'approved') = (approved_at is not null))
);
create index if not exists vision_handovers_shift_idx on public.vision_handovers(shift_id);

create table if not exists public.vision_audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS: each user sees only their own rows. Organization sharing is a later, separate migration.
alter table public.vision_senses enable row level security;
alter table public.vision_sense_versions enable row level security;
alter table public.vision_sense_installations enable row level security;
alter table public.vision_shifts enable row level security;
alter table public.vision_records enable row level security;
alter table public.vision_handovers enable row level security;
alter table public.vision_audit_logs enable row level security;

create policy "read builtin, public or own senses" on public.vision_senses for select to authenticated
  using (owner_id is null or is_public or owner_id = (select auth.uid()));
create policy "manage own senses" on public.vision_senses for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and kind <> 'builtin');

create policy "read versions of visible senses" on public.vision_sense_versions for select to authenticated
  using (exists (select 1 from public.vision_senses s where s.id = sense_id and (s.owner_id is null or s.owner_id = (select auth.uid()) or (s.is_public and status = 'published'))));
create policy "manage own versions" on public.vision_sense_versions for all to authenticated
  using (exists (select 1 from public.vision_senses s where s.id = sense_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.vision_senses s where s.id = sense_id and s.owner_id = (select auth.uid())));

create policy "own installations" on public.vision_sense_installations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own shifts" on public.vision_shifts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own records" on public.vision_records for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own handovers" on public.vision_handovers for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read own audit" on public.vision_audit_logs for select to authenticated using (user_id = (select auth.uid()));

grant select on public.vision_senses, public.vision_sense_versions to authenticated;
grant insert, update, delete on public.vision_senses, public.vision_sense_versions to authenticated;
grant select, insert, update, delete on public.vision_sense_installations, public.vision_shifts, public.vision_records, public.vision_handovers to authenticated;
grant select on public.vision_audit_logs to authenticated;
grant all on public.vision_senses, public.vision_sense_versions, public.vision_sense_installations, public.vision_shifts,
  public.vision_records, public.vision_handovers, public.vision_audit_logs to service_role;

-- Rollback:
-- drop table public.vision_audit_logs, public.vision_handovers, public.vision_records, public.vision_shifts,
--   public.vision_sense_installations, public.vision_sense_versions, public.vision_senses;
