-- ============================================================================
-- 云端同步「真实」验证 + profiles 回填
-- 用法：Supabase 后台 → 左侧 SQL Editor → New query → 全文粘贴 → Run
--
-- 【为什么必须在 SQL Editor 里查】
--   user_settings / user_items 开了 RLS：using (auth.uid() = user_id)
--   用浏览器/curl 拿 anon key 去查，auth.uid() 是 null，**永远返回空数组**，
--   这是 RLS 正常工作的表现，不代表没数据。
--   SQL Editor 走 service_role 权限，绕过 RLS，才能看到真实行数。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ① 回填 profiles：给触发器生效前就已注册的老用户补建资料行
-- ---------------------------------------------------------------------------
insert into public.profiles (id, display_name)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'user_name',
                u.raw_user_meta_data ->> 'name',
                split_part(u.email, '@', 1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ② 确认触发器存在（新用户以后会自动建 profile，无需再回填）
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'user_name',
                           new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ③ 下面是「体检报告」，Run 之后看最后输出的表格
-- ============================================================================

select
  '1. 注册用户数'                    as 检查项,
  (select count(*)::text from auth.users)                        as 结果,
  '应 ≥ 1。为 0 说明 GitHub 授权就没成功'                          as 说明
union all
select
  '2. profiles 资料行',
  (select count(*)::text from public.profiles),
  '跑完本脚本应与用户数一致'
union all
select
  '3. user_settings 行数',
  (select count(*)::text from public.user_settings),
  '登录后在网站改过设置才会有行'
union all
select
  '4. user_items 数据条数',
  (select count(*)::text from public.user_items),
  '关键指标！>0 说明业务数据真的同步上云了'
union all
select
  '5. 最近一次同步时间',
  coalesce((select max(updated_at)::text from public.user_items), '(暂无)'),
  '应接近你最后一次操作网站的时间'
order by 检查项;

-- ---------------------------------------------------------------------------
-- ④ 按业务类型看同步明细（today/content/topics/materials/inbox/links...）
-- ---------------------------------------------------------------------------
select bucket as 数据类型,
       count(*) as 条数,
       max(updated_at) as 最近更新
from public.user_items
group by bucket
order by 条数 desc;

-- ---------------------------------------------------------------------------
-- ⑤ 列出所有已登录账号
-- ---------------------------------------------------------------------------
select u.email,
       u.raw_user_meta_data ->> 'user_name' as github账号,
       u.created_at as 首次登录,
       u.last_sign_in_at as 最近登录
from auth.users u
order by u.created_at;
