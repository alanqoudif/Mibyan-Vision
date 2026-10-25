-- "Someone see with me": a blind user shares their glasses view with a trusted helper
-- through a short code. Only the mata-helper edge function (service role) touches these.

create table public.mata_helper_sessions (
  code text primary key check (code ~ '^[0-9]{8}$'),
  device_id text not null check (char_length(device_id) between 8 and 64),
  frame text,
  frame_at timestamptz,
  joined_at timestamptz,
  ended boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);

create table public.mata_helper_messages (
  id bigint generated always as identity primary key,
  code text not null references public.mata_helper_sessions (code) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create index mata_helper_messages_code_id on public.mata_helper_messages (code, id);

alter table public.mata_helper_sessions enable row level security;
alter table public.mata_helper_messages enable row level security;
