# 任务检查点 · 小冷个人 AI 工作台

> 本文件是「新会话上下文单点入口」。未来开新会话，只需读取本文件即可恢复全部项目背景。
> 最后更新：2026-08-11 09:43（v3.3.43 已同步镜像 + Vercel）

---

## 1. 原始任务目标

1. **Neo-brutalism 换肤**：把旧的奶油圆角风格改为新粗野主义风格（奶油底 #FFFDF5、纯黑描边、硬阴影、直角、Space Grotesk + Noto Sans SC、彩色点缀）。
2. **按图例精修 UI**：根据用户多轮截图反馈，逐项调整颜色、间距、边框、hover、弹窗位置、日历、运势卡、习惯卡、KPI 便签、选题灵感等细节。
3. **Supabase 多端同步**：在保留纯前端架构的前提下，把数据从 `localStorage` 迁移到 Supabase（PostgreSQL + REST/Realtime + Auth），实现手机/电脑数据自动同步，并部署到 Vercel。

---

## 2. 已完成的工作

### 2.1 换肤基础
- 采用**独立覆盖层方案**：新增 `css/neo-brutalism.css`，在 `index.html` 中于 `css/style.css` 之后加载，通过层叠 + `!important` 覆盖视觉样式。
- **不修改 `css/style.css` 和任何 JS 逻辑**，确保可一键回退到 v3.3.34（删除覆盖层 link 或 `git checkout v3.3.34 -- index.html`）。

### 2.2 UI 精修（多轮截图反馈已落实）
- 问候语“小冷”改为黑色高亮块。
- 列表项 hover 不再变黑，改为浅底 + 小浮起，文字始终可见。
- 顶栏去掉“工作台”tab 和“+新建”按钮，返回按钮黄色，标题大写，左右边框与下方模块对齐。
- 侧边栏每个菜单图标底座按模块分配不同颜色。
- 数据看板 4 个 KPI 便签使用黄/紫/粉/蓝四色，并带轻微倾斜角度。
- 内容创作 / 爆款拆解 / 数据可视化卡片使用彩色硬阴影，相邻卡片颜色不同（红/黄/紫/蓝循环）。
- 习惯打卡文字强制黑色；习惯卡阴影色跟随图标底色（由 `js/habits.js` 注入 `--hc` 变量）。
- 弹窗恢复居中/原位置弹出，底色改为奶油黄，header 黄色。
- 日历日期格改为白底、黑边框、今天红色高亮。
- 今日运势顶部彩条改为笔直红黄紫三色条，填满模块上边框内侧。
- 选题灵感（用户灵感 + 今日灵感）条目改为 playful 彩色硬阴影，相邻不同色。
- **今日页去掉 `.main-content` 外框**，各模块直接漂浮在奶油底上；模块间距统一为 **16px**（与图例一致）。

### 2.3 部署与版本
- 当前版本：**v3.3.43**，commit `a4bd31b`。
- **镜像站**：`http://191.40.37.48` ✅ v3.3.43（通过 `tar + expect auto-deploy.exp` 部署）。
- **GitHub**：`main = a4bd31b` ✅（已用临时 PAT 推送，token 已清除）。
- **Vercel**：`https://ai-workbench-tan.vercel.app/` ✅ v3.3.43（通过 GitHub 自动构建触发，验证时带 `?nocache=` 绕过 CDN 缓存）。

### 2.4 Supabase 前期准备
- 已把用户提供的 Supabase URL 与 publishable key 填入 `js/supabase-config.js`。
- 预备了 `js/supabase-client.js`（通用 CRUD 封装，未配置时自动回退 localStorage）、`js/auth.js`（GitHub OAuth 登录态）、`supabase/schema.sql`（含 `user_settings` / `user_items` / `profiles` + RLS）。

---

## 3. 重要约束和要求（反复强调）

- **换肤只动覆盖层**：所有 Neo-brutalism 视觉改动必须写在 `css/neo-brutalism.css`；禁止修改 `css/style.css` 和任何 JS 文件（除非功能本身需要）。
- **部署前必检**：每次改完源码后，先用 `node --check` 逐文件确认 JS 无语法错误，再用花括号配对检查 CSS，**全部通过后才能打包/部署**。
- **modules.js 铁律**：新增 `updateLogs` 条目时，`impact` 后必须补 `},`，已连续多次漏写导致全站 JS 解析失败。
- **文字必须看得见**：任何 hover、深色底、彩色底都要保证文字对比度，不能再出现“字看不见”。
- **弹窗不能跑页底**：所有 overlay/弹窗必须保持原定位（居中或原位置），禁止把 `position:fixed` 误改成 `relative`。
- **Supabase 安全**：只使用 `anon` / `publishable key`，绝不把 `service_role` key 放进前端；必须启用 RLS，确保用户只能读写自己的数据。
- **GitHub 推送**：本机无持久 GitHub 凭证，每次需要用户临时提供 PAT；推送命令必须加 `-c http.version=HTTP/1.1 -c http.postBuffer=524288000 push --no-thin`；推完立即从 remote URL 清除 token。
- **Vercel 验证**：跨网验证 Vercel 时必须带 `?nocache=随机` 参数，否则会被 CDN 缓存误导。
- **镜像部署**：源码在 `/Users/xuleng/WorkBuddy/ai/workspace/`；打包时必须用 `-C workspace` 指向源码目录，否则 expect 脚本会上传旧包。

---

## 4. 待解决的问题

1. **🟡 Supabase 全量迁移未完成**：目前只填了 URL + publishable key，Store 层兼容改造、GitHub OAuth 登录联调、数据迁移、RLS 测试都还没做。
2. **🟡 缺少 GitHub OAuth App 凭据**：需要 `Client ID` 和 `Client Secret` 才能在 Supabase Auth 里启用 GitHub 登录。
3. **🟡 Vercel 环境变量未配置**：需要在 Vercel 项目里添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（或沿用前端硬编码，视方案而定）。
4. **🟡 数据迁移与回滚策略未验证**：需要一套 localStorage → Supabase 的迁移流程，以及未登录时自动回退 localStorage 的兜底逻辑。
5. **🟢 UI 持续微调**：后续可能继续根据截图反馈小修小改；当前已建立“截图 → 定位 → CSS 覆盖 → 部署 → 验证”的快速迭代流程。

---

## 5. 下一步计划

### 近期（UI 收尾）
- 根据用户后续截图反馈继续精修 Neo-brutalism 细节。
- 每次修改后保持：本地校验 → commit → 镜像部署 → GitHub push → Vercel 验证（带 `?nocache=`）。

### 中期（Supabase 迁移）
1. 用户提供 **GitHub OAuth App** 的 `Client ID` + `Client Secret`。
2. 在 Supabase Dashboard 里配置 GitHub Provider，并设置 Vercel 生产域名为允许的 Redirect URL。
3. 改造 `js/store.js`：检测登录态 → 已登录走 Supabase / 未登录回退 localStorage。
4. 编写一次性迁移脚本/逻辑：把当前 `localStorage` 里的数据导入 `user_items` / `user_settings`。
5. 在 RLS 开启的情况下，测试刷新、重登、换账号的数据隔离与正确性。
6. 推送 GitHub，确认 Vercel 构建通过并线上测试。

### 长期
- 稳定运行后，把 `progress.md` 更新为更轻量的“版本日志 + 架构决策”文档。

---

## 6. 已生成的关键文件清单及其路径

| 文件路径 | 说明 |
| --- | --- |
| `/Users/xuleng/WorkBuddy/ai/workspace/index.html` | 入口；加载 `style.css` → `neo-brutalism.css?v=75`；版本字符串 `v3.3.43` |
| `/Users/xuleng/WorkBuddy/ai/workspace/css/style.css` | **原站样式，换肤期禁止修改** |
| `/Users/xuleng/WorkBuddy/ai/workspace/css/neo-brutalism.css` | **主题覆盖层（当前 v75）**，所有 Neo-brutalism 视觉与修复补丁在此 |
| `/Users/xuleng/WorkBuddy/ai/workspace/neo-brutalism-preview.html` | 预览/参考页面，用于比对设计效果 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/app.js` | 主应用逻辑，含页面渲染、弹窗、日历、KPI 等 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/habits.js` | 习惯打卡模块；已注入 `--hc` 变量使阴影跟随图标色 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/modules.js` | 模块注册、导航顺序、更新日志 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/supabase-config.js` | Supabase URL + publishable key（已配置） |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/supabase-client.js` | Supabase 通用 CRUD 封装，未配置时回退 localStorage |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/auth.js` | GitHub OAuth 登录态管理 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/store.js` | 数据存储层；待改造为 Supabase/localStorage 双后端 |
| `/Users/xuleng/WorkBuddy/ai/workspace/supabase/schema.sql` | Supabase 表结构 + RLS 策略 |
| `/Users/xuleng/WorkBuddy/ai/workspace/progress.md` | 本检查点文件 |
| `/Users/xuleng/WorkBuddy/ai/workspace/server.js` | 本地静态服务器（开发用） |
| `/Users/xuleng/WorkBuddy/ai/auto-deploy.exp` | 镜像服务器 expect 自动部署脚本 |
| `/Users/xuleng/WorkBuddy/ai/.workbuddy/memory/2026-08-11.md` | 当日工作日志（含详细操作记录） |
| `/Users/xuleng/WorkBuddy/ai/.workbuddy/memory/MEMORY.md` | 项目长期记忆（架构决策、部署规则） |

---

## 7. 给新会话的 TL;DR

- 这是一个**纯前端的个人 AI 工作台**，正在做 **Neo-brutalism 换肤** + **Supabase 数据同步**。
- 当前线上版本 **v3.3.43**，镜像与 Vercel 已一致；UI 反馈基本修完，只剩 **Supabase 全量迁移**。
- 迁移前需要你提供：**GitHub OAuth App 的 Client ID + Client Secret**（以及是否要在 Vercel 配环境变量）。
- 关键铁律：换肤只动 `neo-brutalism.css`、部署前 `node --check`、Supabase 只放 anon key、GitHub 推完清 token、Vercel 验证带 `?nocache=`。
