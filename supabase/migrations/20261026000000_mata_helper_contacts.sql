-- Trusted helpers: the blind user adds someone once (a 6-digit invite they enter in their own
-- copy of the app), then "call mom to see with me" notifies them directly, no code to read out.
-- Only the mata-helper edge function (service role) touches these.

create table public.mata_helper_invites (
  code text primary key check (code ~ '^[0-9]{6}$'),
  device_id text not null check (char_length(device_id) between 8 and 64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day'
);

create table public.mata_helper_contacts (
  id bigint generated always as identity primary key,
  owner_device text not null check (char_length(owner_device) between 8 and 64),
  helper_device text not null check (char_length(helper_device) between 8 and 64),
  -- What the blind user calls the helper ("Mom"), and what the helper calls them.
  helper_name text not null check (char_length(helper_name) between 1 and 60),
  owner_name text not null check (char_length(owner_name) between 1 and 60),
  push_token text check (char_length(push_token) <= 200),
  lang text not null default 'ar' check (lang in ('ar', 'en')),
  created_at timestamptz not null default now(),
  unique (owner_device, helper_device)
);

create index mata_helper_contacts_helper on public.mata_helper_contacts (helper_device);

alter table public.mata_helper_invites enable row level security;
alter table public.mata_helper_contacts enable row level security;
