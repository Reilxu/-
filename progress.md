# 任务检查点 · 个人 AI 工作台（Neo-brutalism 换肤 + Supabase 同步）

> 本文件是「新会话上下文单点」。未来开新会话，只需读取本文件即可恢复全部背景。
> 最后更新：2026-08-11（v3.3.40 已部署镜像，GitHub/Vercel 未同步）

---

## 0. 一句话项目背景

小冷的个人 AI 工作台网站，纯前端（HTML+CSS+JS+localStorage），从旧暖白设计换成 **Neo-brutalism（新粗野主义）** 风格，并计划把数据从 localStorage 全量迁移到 **Supabase** 实现多端同步。

- 源码目录：`/Users/xuleng/WorkBuddy/ai/workspace/`
- 镜像服务器：`http://191.40.37.48`（用 tar + expect 脚本部署，**这是目前线上在跑的版本**）
- Vercel 预览：`ai-workbench-tan.vercel.app`（仅由 GitHub push `Reilxu/-` 自动构建）
- 设计参考页：`/Users/xuleng/WorkBuddy/ai/workspace/neo-brutalism-preview.html`（所有配色/间距/悬停效果以此为准）

---

## 1. 原始任务目标

1. **Neo-brutalism 全站换肤**：奶油底 `#FFFDF5` / 纯黑描边 + 硬阴影 / 主色红 `#FF6B6B`、辅色黄 `#FFD93D`、柔和紫 `#C4B5FD` / 直角（圆形元素保留）/ Space Grotesk + Noto Sans SC。
2. **修 UI 反馈**：回应用户多轮截图反馈（hover 变黑、弹窗跑页底、文字看不见、日历/运势/习惯卡样式不一致等共 13 项）。
3. **Supabase 云端化**：全量迁移 localStorage → Supabase，加 GitHub OAuth 登录 + RLS（每用户仅读写自己数据），前端仅用 anon/publishable key，CRUD 齐全，部署到 Vercel。

---

## 2. 已完成的工作步骤

| 版本 | commit | 内容 |
|------|--------|------|
| v3.3.35 | `14d7ae6` | Neo-brutalism 全站换肤：新增 `css/neo-brutalism.css` 覆盖层，JS/原 `style.css` **零改动**，可一键回退 v3.3.34（`f2e1c26`） |
| v3.3.39 | — | 尝试永久隐藏 searchOverlay / fabOverlay（后已回退，未保留） |
| v3.3.35 回退 | `14d7ae6` | 用户要求回退到此版本；镜像已部署；GitHub 强制推送曾 502 失败、token 已清除 |
| **v3.3.40** | `f126bdd` | **13 项 UI 修复 + 配置 Supabase 凭据**；已部署镜像 191.40.37.48；未推 GitHub |

**v3.3.40 的 13 项修复清单（全部完成）：**
1. 问候语「小冷」文字改纯黑。
2. 卡片 hover 不再变黑（待办/提醒等 hover 改浅底 + 小浮起，文字始终可见）。
3. 顶栏对齐预览：隐藏「工作台」tab 与「新建」按钮（CSS `display:none` 保留 JS），返回按钮变黄。
4. 侧边栏每个菜单图标底座用不同颜色（按 `data-module` 配色）。
5. 数据看板 4 个 KPI 便签各用不同底色（黄/紫/粉/蓝）。
6. 爆款拆解/数据可视化/内容创作卡片用红/黄/紫/蓝循环硬阴影，相邻不同色。
7. 习惯打卡文字强制黑色（含帮助中心白字改黑），解决看不见问题。
8. 弹窗恢复固定定位居中弹出（之前被误改 `position:relative` 跑到页底），底色改奶油黄、header 黄色。
9. 每个习惯卡边框阴影色 = 该习惯图标底色（`habits.js` 注入 `--hc` CSS 变量，最小 JS 改动）。
10. 日历改预览样式（奶黄底、周末红头、今天红、日期格黑边）。
11. 今日运势卡改预览样式（顶部红黄紫条纹、日期红底黑边、右上彩色圆环）。
12. Supabase URL 与 publishable key 填入 `js/supabase-config.js`。
13. 各模块间距统一为 18px（与预览一致）。

**已通过校验**：所有 JS `node --check` + `neo-brutalism.css` 花括号配对 OK。

---

## 3. 重要约束与反复强调的要求（⚠️ 必读）

### 3.1 换肤架构铁律
- 换肤**只新增 `css/neo-brutalism.css` 覆盖层**，在 `index.html` 里于 `style.css` **之后**加载，靠层叠 + `!important` 覆盖。**绝不改 `style.css` 与任何 JS 业务逻辑**。
- 回退方式：删 `index.html` 中 neo-brutalism.css 那行 link；或 `git checkout v3.3.34 -- index.html`；或 `git reset --hard v3.3.34`（`f2e1c26`）。
- **教训**：不要全局 `*{border-radius:0}`——会误伤玻璃罐/扭蛋球/color-pick 等圆形。用 `:root` 变量圆角→0 + 对卡片/按钮/输入/导航显式直角；50%/999px 圆形保留。

### 3.2 部署前必检规则（曾连续踩坑）
- 新增 `modules.js` 的 `updateLogs` 条目时，**每个条目结尾 `impact` 之后必须补 `},` 闭合**（漏写会致 `modules.js` 语法错误，且部署链仍会把坏文件发上线，全站 JS 解析失败）。
- 正确做法：每次改完源码先 `node --check` 逐文件确认全部 OK，**再**打包+部署。任何文件 FAIL 都不进部署步骤。

### 3.3 实际部署方式（镜像）
- 源码在 `workspace/`，打包：`tar czf deploy-package.tar.gz -C workspace index.html css js server.js`，再 `cp` 到 `/Users/xuleng/WorkBuddy/ai/deploy-package.tar.gz`。
- 部署：`cd /Users/xuleng/WorkBuddy/ai && expect auto-deploy.exp`（scp 源**写死**为 `/Users/xuleng/WorkBuddy/ai/deploy-package.tar.gz`，必须先把包放到该路径，否则会上传旧包）。
- 部署后用 `curl 191.40.37.48/js/app.js?v=N | grep` 实测关键新字符串确认。

### 3.4 用户反复强调的体验红线
- **文字必须保证能看见**：hover 不能纯黑、浅底浅字必须改深。任何「黑底黑字 / 浅底浅字」都是 bug。
- **弹窗不要跑到页面最底部**，要和原来一样位置弹出（居中/原位置）。
- 配色/间距/悬停浮动效果一律**参考 `neo-brutalism-preview.html`**。
- **不要留整页遮罩让点不了**：搜索、快速添加等浮层若挡交互就直接删按钮。

### 3.5 Supabase 安全
- `supabase-config.js` **只放 anon / publishable key，严禁放 service_role key**（暴露浏览器即失控）。
- 前端用 anon key + RLS（`auth.uid()=user_id`）约束，未配置时 `SupabaseReady=false` 回退 localStorage。

### 3.6 GitHub / Vercel 推送（本机无持久凭证）
- Vercel 仅由 GitHub push 触发；本机无持久 GitHub 凭证，每次需用户**临时提供 PAT**。
- 推送命令（沙箱直推常遇 HTTP/2 framing/502，必须加参数）：
  `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push --no-thin origin HEAD:main`
- 用完立即从 remote URL 清除 token（`git remote set-url origin https://github.com/Reilxu/-.git`）。
- 坑：`branch.main.remote` 可能残留旧 token 的整条 URL，push 前用 `git config --local branch.main.remote origin` 修正，或显式 `git push origin HEAD:main`。
- 沙箱网络屏蔽 vercel.app（curl 000），用 WebFetch 跨网验证线上文件。

---

## 4. 关键文件清单

### 源码（workspace/）
- `index.html` —— 入口，加载顺序 `style.css` → `neo-brutalism.css?v=73`；含版本字符串 `v3.3.40`
- `css/style.css` —— **原站样式，换肤期禁止改**
- `css/neo-brutalism.css` —— **主题覆盖层（当前 v73）**，所有换肤视觉在此
- `js/supabase-config.js` —— **已填入用户 Supabase 凭据**（URL + publishable key）
- `js/supabase-client.js` —— CDN supabase-js 封装，通用 CRUD，受 RLS 约束，未配置回退
- `js/auth.js` —— GitHub OAuth 登录态
- `js/store.js` —— Store 层（**待改造兼容云端**）
- `js/habits.js` —— 习惯卡渲染，已注入 `--hc` 变量（阴影=图标色）
- `js/app.js` —— 主逻辑（首页/导航/弹窗/日历/运势等）
- `js/modules.js` —— 模块注册表（`updateLogs` 条目注意 `},` 闭合）
- `neo-brutalism-preview.html` —— **设计参考页**（配色/间距/悬停唯一标准）
- `supabase/schema.sql` —— `user_settings` 单行表 + `user_items` 通用表（bucket 映射原 KEY，data 存原 JSON）+ `profiles` 触发；RLS 用 `auth.uid()=user_id`
- `server.js` —— 静态服务器

### 部署相关（/Users/xuleng/WorkBuddy/ai/）
- `deploy-package.tar.gz` —— 部署包（expect 脚本 scp 源）
- `auto-deploy.exp` —— expect 自动部署脚本

### 记忆
- `/Users/xuleng/WorkBuddy/ai/.workbuddy/memory/MEMORY.md` —— 项目长期笔记
- `/Users/xuleng/WorkBuddy/ai/.workbuddy/memory/2026-08-10.md` 等 —— 每日工作日志
- `~/.workbuddy/MEMORY.md` —— 跨项目用户偏好（技能安装优先 skillhub 等）

---

## 5. 待解决的问题（风险点）

1. ~~🔴 GitHub / Vercel 未同步 v3.3.40~~ → **✅ 已解决（2026-08-11）**：用用户临时 PAT 强推 `HEAD:main`（commit f126bdd）使 GitHub 对齐本地 v3.3.40；因 Vercel webhook 未即时触发，追加一个空提交 `414ad10` 重新触发构建。WebFetch 初查命中 CDN 旧缓存误判"仍不一致"，加 `?nocache=` 随机参数绕过缓存后确认 Vercel 下发 CSS 含「反馈修复补丁（v3.3.40）」与 `.report-kpis` 四色规则，即 Vercel = 镜像 v3.3.40。token 用后已清除。
2. **🟡 Supabase 全量迁移未完成**（仅配了凭据）：
   - Store 层兼容改造（登录走云端 / 未登录回退 localStorage）。
   - `auth.js` 实际 GitHub OAuth 登录流程联调。
   - RLS 测试：刷新 / 重登 / 换号后数据正确（每用户仅见自己数据）。
   - 用户给的 key 是 `sb_publishable_...`（publishable 类型），需确认 Supabase 项目该 key 与 RLS 策略匹配、并非仅本地 mock。
3. **🟡 部署包与服务器一致性**：每次改完务必重新 `tar` + `cp` 到 `ai/` 再 `expect`，否则服务器跑旧代码（曾因此返工）。
4. **🟢 全站巡查**：改视觉后习惯/创作/热点/日历/弹窗等模块仍可能有未覆盖的类名或 glitches，按反馈迭代。

---

## 6. 下一步计划

1. ~~同步 GitHub/Vercel~~ → **✅ 已完成（2026-08-11）**：Vercel 已对齐镜像 v3.3.40。
2. **Supabase 全量迁移**（用户已给 URL + key）：
   - 在 Supabase 后台执行 `supabase/schema.sql` 建表 + RLS。
   - 改造 `store.js`：登录走云端 CRUD，未登录回退 localStorage。
   - 联调 `auth.js` GitHub OAuth 登录态。
   - 测试刷新/重登/换号数据隔离。
3. **部署到 Vercel**：用户提供 GitHub OAuth App（client id/secret）、Vercel 账号后做部署与联调测试。
4. 视用户截图反馈持续迭代视觉细节。

---

## 7. 给新会话的速记（TL;DR）

- 项目 = 纯前端 AI 工作台，正在做 Neo-brutalism 换肤 + Supabase 同步。
- 换肤只动 `css/neo-brutalism.css`，**绝不碰 `style.css`/JS 业务逻辑**；回退靠删 link 或 `git reset --hard v3.3.34`。
- 部署 = `tar` 打包 → `cp` 到 `ai/deploy-package.tar.gz` → `expect auto-deploy.exp` 到 191.40.37.48。GitHub/Vercel 需用户临时 PAT，用完清 token。
- 体验红线：文字必须可见、弹窗别跑页底、配色间距以 `neo-brutalism-preview.html` 为准、别留整页遮罩。
- 当前线上（镜像）= v3.3.40（13 项修复 + Supabase 凭据已填）；**GitHub/Vercel 还没同步**，Supabase 只配凭据、未做全量迁移。
- 用户 Supabase：URL `https://zvjiofbvfsyahkxrqhvb.supabase.co`，key 已写入 `js/supabase-config.js`。
