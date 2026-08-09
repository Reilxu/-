-- ============================================================================
-- 小冷 AI 工作台 · Supabase 数据迁移
-- 设计原则：
--   1. 所有用户数据表统一带 user_id，开启 RLS，policy 限制 auth.uid() = user_id
--   2. 列表型业务数据统一存 user_items 表（bucket 区分类型，data 存原 JSON），
--      完全映射现有 localStorage 的 KEYS + 数组，迁移零损耗、前端改动最小
--   3. 单值设置存 user_settings（每个用户一行）
--   4. 前端只用 anon/publishable key，靠 RLS 保证每用户仅读写自己数据；
--      service_role key 严禁出现在浏览器
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 用户设置（单行）：对应 xl_settings
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 通用列表型数据：映射原 localStorage 各类数组
--   bucket = 原 KEY：today / content / topics / materials / inbox / links /
--            aiChat / decomp / mcnOutput / videos / reports
--   item_id = 原对象的 id（用于 upsert 去重）
--   data = 原对象的完整 JSON（保持现有字段，不做破坏性拆分）
-- ---------------------------------------------------------------------------
create table if not exists public.user_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  bucket     text not null,
  item_id    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bucket, item_id)
);

create index if not exists user_items_user_bucket_idx
  on public.user_items (user_id, bucket);

-- ---------------------------------------------------------------------------
-- 资料表（昵称/头像）：非强制，登录后自动建
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- 新用户自动建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'user_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 行级安全 RLS：确保每用户只能读写自己的数据
-- ============================================================================
alter table public.user_settings enable row level security;
alter table public.user_items    enable row level security;
alter table public.profiles      enable row level security;

-- user_settings：仅本人
drop policy if exists "settings_owner" on public.user_settings;
create policy "settings_owner" on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_items：仅本人（同一 policy 覆盖 select/insert/update/delete）
drop policy if exists "items_owner" on public.user_items;
create policy "items_owner" on public.user_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- profiles：任何人可读，仅本人可写
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using (true);

drop policy if exists "profiles_write" on public.profiles;
create policy "profiles_write" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
