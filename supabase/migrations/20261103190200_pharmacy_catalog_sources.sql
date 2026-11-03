insert into storage.buckets (id, name, public, file_size_limit)
values ('mata-pharmacy-catalog', 'mata-pharmacy-catalog', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create table if not exists public.mata_pharmacy_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text,
  file_size bigint not null check (file_size >= 0 and file_size <= 26214400),
  created_at timestamptz not null default now()
);
create index if not exists mata_pharmacy_files_owner_created_idx on public.mata_pharmacy_files(owner_id, created_at desc);
alter table public.mata_pharmacy_files enable row level security;
create policy "Manage own pharmacy source files" on public.mata_pharmacy_files
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
grant select, insert, delete on public.mata_pharmacy_files to authenticated;
grant all on public.mata_pharmacy_files to service_role;

create policy "Read own pharmacy catalog files" on storage.objects
  for select to authenticated using (
    bucket_id = 'mata-pharmacy-catalog'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "Upload own pharmacy catalog files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mata-pharmacy-catalog'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "Delete own pharmacy catalog files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'mata-pharmacy-catalog'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
