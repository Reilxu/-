-- ============================================================================
-- 修复：Authentication → Users 里已有账号，但 public.profiles 表为空
-- 原因：handle_new_user 触发器未生效（建表 SQL 执行时机晚于用户注册，或触发器报错）
-- 用法：Supabase 后台 → SQL Editor → New query → 粘贴全部 → Run
-- 说明：可重复执行，不会产生重复数据
-- ============================================================================

-- 1) 重建自动建档触发器（兼容 GitHub 无 user_name 的情况，依次回退 full_name / email）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      new.email
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) 回填已存在的历史用户
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'user_name',
    u.raw_user_meta_data ->> 'full_name',
    u.email
  )
from auth.users u
on conflict (id) do nothing;

-- 3) 验证：应能看到你的 GitHub 账号行
select id, display_name, created_at
from public.profiles
order by created_at desc;
