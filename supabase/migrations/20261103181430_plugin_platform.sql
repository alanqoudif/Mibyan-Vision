create table if not exists public.mata_plugins (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null check (char_length(description) between 1 and 240),
  category text not null check (category in ('study','mobility','safety','pharmacy','custom')),
  instructions text not null check (char_length(instructions) between 1 and 4000),
  capabilities text[] not null default array['camera','speech'],
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_builtin = (owner_id is null)),
  check (cardinality(capabilities) > 0 and capabilities <@ array['camera','speech','catalog','location']),
  check (category = 'pharmacy' or not ('catalog' = any(capabilities)))
);
create index if not exists mata_plugins_owner_updated_idx on public.mata_plugins(owner_id, updated_at desc);
alter table public.mata_plugins enable row level security;
drop policy if exists "Read built-in or owned plugins" on public.mata_plugins;
create policy "Read built-in or owned plugins" on public.mata_plugins for select to anon, authenticated using (is_builtin or owner_id = (select auth.uid()));
drop policy if exists "Create own plugins" on public.mata_plugins;
create policy "Create own plugins" on public.mata_plugins for insert to authenticated with check (owner_id = (select auth.uid()) and not is_builtin);
drop policy if exists "Update own plugins" on public.mata_plugins;
create policy "Update own plugins" on public.mata_plugins for update to authenticated using (owner_id = (select auth.uid()) and not is_builtin) with check (owner_id = (select auth.uid()) and not is_builtin);
drop policy if exists "Delete own plugins" on public.mata_plugins;
create policy "Delete own plugins" on public.mata_plugins for delete to authenticated using (owner_id = (select auth.uid()) and not is_builtin);
grant select on public.mata_plugins to anon, authenticated;
grant insert, update, delete on public.mata_plugins to authenticated;
grant all on public.mata_plugins to service_role;

create table if not exists public.mata_pharmacy_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  strength text check (strength is null or char_length(strength) <= 80),
  barcode text check (barcode is null or char_length(barcode) <= 80),
  shelf text not null check (char_length(shelf) between 1 and 80),
  row text not null check (char_length(row) between 1 and 80),
  position text check (position is null or char_length(position) <= 80),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mata_pharmacy_items_owner_name_idx on public.mata_pharmacy_items(owner_id, name);
create index if not exists mata_pharmacy_items_owner_barcode_idx on public.mata_pharmacy_items(owner_id, barcode) where barcode is not null;
alter table public.mata_pharmacy_items enable row level security;
drop policy if exists "Manage own pharmacy items" on public.mata_pharmacy_items;
create policy "Manage own pharmacy items" on public.mata_pharmacy_items for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.mata_pharmacy_items to authenticated;
grant all on public.mata_pharmacy_items to service_role;

create table if not exists public.mata_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 16384),
  updated_at timestamptz not null default now()
);
alter table public.mata_user_settings enable row level security;
drop policy if exists "Manage own settings" on public.mata_user_settings;
create policy "Manage own settings" on public.mata_user_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.mata_user_settings to authenticated;
grant all on public.mata_user_settings to service_role;

create table if not exists public.mata_device_links (
  device_id text primary key check (char_length(device_id) between 8 and 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);
alter table public.mata_device_links enable row level security;
drop policy if exists "Read own linked devices" on public.mata_device_links;
revoke all on public.mata_device_links from anon, authenticated;
grant all on public.mata_device_links to service_role;

-- Keep the deployed history table compatible when present; service-role inserts continue to work.
do $$ begin
  if to_regclass('public.mata_sessions') is not null then
    alter table public.mata_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;
    create index if not exists mata_sessions_user_created_idx on public.mata_sessions(user_id, created_at desc);
    execute 'alter table public.mata_sessions enable row level security';
    execute 'drop policy if exists "Read own linked history" on public.mata_sessions';
    execute 'create policy "Read own linked history" on public.mata_sessions for select to authenticated using (user_id = (select auth.uid()))';
  end if;
end $$;

insert into public.mata_plugins(id, owner_id, name, description, category, instructions, capabilities, is_builtin)
values
('builtin-study', null, 'مساعد الدراسة', 'اقرأ المحتوى واشرحه خطوة بخطوة مع الكاميرا والصوت.', 'study', 'ساعد المستخدم على فهم ما يظهر أمام الكاميرا. اقرأ النص عند الطلب، اشرح المفاهيم بلغة واضحة، واسأل سؤالاً توضيحياً عند الحاجة. لا تخترع نصاً غير مقروء.', array['camera','speech'], true),
('builtin-navigation', null, 'مساعد التنقل', 'صف المعالم والعوائق الظاهرة حول المستخدم.', 'mobility', 'صف ما يظهر بوضوح وباختصار، ونبّه إلى العوائق المرئية فقط. لا تدّع معرفة الطريق الآمن ولا تستبدل وسائل الملاحة أو مساعدة شخص قريب.', array['camera','speech','location'], true),
('builtin-safety-inspection', null, 'مراجعة معدات السلامة', 'ساعد في ملاحظة الملصقات والعلامات المرئية على المعدات.', 'safety', 'صف الملصقات والعلامات والحالة الظاهرة للمعدة، واذكر ما لا يمكن التحقق منه بصرياً. لا تصدر شهادة صلاحية أو ضمان سلامة؛ اطلب الرجوع لإجراءات الفحص المعتمدة عند الشك.', array['camera','speech'], true),
('builtin-pharmacy-shelf', null, 'موقع الدواء في الصيدلية', 'ابحث في كتالوج الصيدلية عن الرف والصف المسجلين.', 'pharmacy', 'طابق اسم الدواء أو تركيزه مع كتالوج المستخدم فقط. اقرأ الموقع المسجل حرفياً. إذا غاب التطابق أو كان ملتبساً فقل ذلك واطلب من الصيدلي التحقق. لا تقدم توصية دوائية أو تشخيصاً.', array['camera','speech','catalog'], true)
on conflict (id) do update set name=excluded.name, description=excluded.description, category=excluded.category, instructions=excluded.instructions, capabilities=excluded.capabilities;
