# 任务检查点 · 小冷个人 AI 工作台

> 本文件是「新会话上下文单点入口」。未来开新会话，只需读取本文件即可恢复全部项目背景。
> 最后更新：2026-08-11 15:30（**v3.3.50 已部署镜像站**：打卡模块的「线条 SVG 图标」整体替换为 PNG 图标（21 个，由用户提供的精灵图自动分割），「CSS 绘制扭蛋机」替换为单张 PNG 扭蛋机图；缓存 `?v=82`。**Vercel 待用户提供 GitHub PAT 后推送**（本机无持久凭证））

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
- 当前版本：**v3.3.50**（打卡图标与扭蛋机改为 PNG 资源；缓存版本 `?v=82`）。
- **镜像站**：`http://191.40.37.48` ✅ **v3.3.50**（已通过 `tar + expect auto-deploy.exp` 部署并验证 HTTP 200；`assets/gacha-machine.png` 可访问 200（~1.98MB）、`assets/icons/sunrise.png` 等 21 个 PNG 均可访问 200；index.html 含 `v3.3.50` / `?v=82`；无头 Chrome 实测 5 个习惯图标均 `<img>` 加载完成、扭蛋机 PNG 渲染 280×420）。
- **GitHub / Vercel**：`main` 当前为 **v3.3.49**（commit `bcc430f`）。**v3.3.50 已本地就绪但未推送**——本机无持久 GitHub 凭证，需用户临时提供 PAT 后走 `git push` 触发 Vercel 自动构建（历史规约：commit → 注入 PAT → `push --no-thin` → 立即清除 token）。
- **v3.3.47 改动（减肥记录模块）**：①在「自律」分组新增 `weightloss` 模块（图标、导航、注册齐全）；②新增 `js/weightloss.js`（月份选择器、体重日历、今日体重卡、AI 饮食建议、记录琐事、趋势图、AI 报告、首次引导弹窗）；③新增 `css/weightloss.css`（Neo-brutalism 独立样式）；④`store.js` 数据访问改用 `getObject/setObject`（对象型），并从 `SYNC_BUCKETS` 移除三个 weightloss 键（数组型同步循环不兼容对象型，避免云端数组回写覆盖本地对象）；⑤缓存 `?v=77`→`?v=79`，版本串 `v3.3.45`→`v3.3.47`。
- **v3.3.49 改动（banner 加入打字猫 GIF）**：在首页 `.hero-greeting` banner 右下角新增 `<img class="hero-cat-gif" src="assets/cat-typing.gif">`；GIF 已验证含透明像素（P 模式有 alpha），桌面显示 150×150、移动端 ≤900px 显示 100×100，底部贴近 banner 下边框内侧；`server.js` 增加 `.gif` MIME 类型，`remote-setup.sh` 增加 `chmod -R 755 /var/www/workbench` 修复首次部署时 assets 403 问题。缓存 `?v=80`→`?v=81`，版本串 `v3.3.48`→`v3.3.49`。
- **v3.3.50 改动（打卡图标 + 扭蛋机 PNG 化）**：按用户提供的精灵图替换打卡模块视觉资源。①**图标**：用户给出一张未分割的精灵图 `图标.png`（1254×1254 RGBA），用 Python PIL 按 **6 列 × 4 行、每格 209×209、顶部 209px 为空行（图标从 y=209 起）** 自动切分，每格居中裁 170×170，产出 `assets/icons/` 下 21 个 PNG（与 `HABIT_ICONS` 的 key 一一对应：sunrise/book/droplet/sparkes/activity/coffee/moon/apple/pencil/code/music/heart/flame/star/target/leaf/zap/walk/dumbbell/pill/ointment）。`js/habits.js` 的 `HABIT_ICONS` 由「内联 SVG 字符串」改为「`<img class="habit-icon-img" src="assets/icons/<key>.png?v=82">`」（新增 `habitIconImg(key,size)` / `ICON_ASSET_VERSION='82'` 辅助函数；默认 `circle` 仍用 SVG 圆，保留旧线条观感）；习惯卡图标、`.icon-pick` 图标选择器、小球罐 `.jar-candy` 图标行全部切到 `habitIconImg()`（选择器 18px、球罐 12px、卡片 28px，尺寸在 `neo-brutalism.css` 第 15 节控制）。②**扭蛋机**：用户给出 `扭蛋机png.png`（1024×1536 RGBA），复制到 `assets/gacha-machine.png`；`habits.js` 删除原纯 CSS 绘制的扭蛋机 DOM（`.gacha-dome`/`.gacha-body`/`.gacha-earing`/`.gacha-lever` 等），改为单张 `<img class="gacha-machine-img" src="assets/gacha-machine.png?v=82">` + 出蛋口 `.gacha-chute`（`gacha()` 逻辑引用的 `#gachaMachine` / `#gachaChute` 保留不变）；`neo-brutalism.css` 第 16 节新增 `.gacha-machine`（max-width 340px、移动端 280px）、`.gacha-chute`（绝对定位出蛋口）、`.gacha-spinning` 抖动动画。③`index.html` 全部 `?v=81`→`?v=82`（13 处）、版本串 `v3.3.49`→`v3.3.50`；`server.js` 已含 `.png` MIME，无需改。**验证**：`node --check js/habits.js` 通过、CSS 花括号 188=188 配对；无头 Chrome 实测 5 个习惯图标 `<img>` 均 `complete:true` 且 src 指向 `assets/icons/*.png?v=82`、扭蛋机 PNG `complete:true` 尺寸 280×420；镜像站 curl 验证 `gacha-machine.png` 200（1.98MB）、`sunrise.png` 200（43KB）、`habits.js?v=82` 含 `gacha-machine.png` 与 `assets/icons/` 引用、`index.html?v=82` 含 `v3.3.50`。缓存 `?v=81`→`?v=82`，版本串 `v3.3.49`→`v3.3.50`。
- **v3.3.48 改动（体验三处优化）**：①**今日运势**：原有「重新生成」按钮仅在出错时显示；改为运势卡片标题右侧常驻「↻ 刷新」按钮（`#fortuneRefreshBtnTop`），点击即 `API.generateDailyFortune(profile, true)` 强制让 Deepseek 拉取最新运势；另说明：运势本就按「日」缓存（cacheKey 含日期），跨天打开自动重新生成，即每日自动刷新。②**今日页间距**：`@media (min-width:900px)` 下把 `.today-page` gap 16→36px、`.today-hero` 28px、`.today-stats` 24px、`.hero-left-stack` 20px，电脑横版不再拥挤（移动端不受影响）。③**减肥日历**：新增 `#wlTrivia` 常驻面板，显示所选日期记录的琐事（注射/运动/排便/饮酒/熬夜/备注），点击日历某天即切换；日历面板底色由白 `#fff` 改为奶油 `#FFF7DC`，与今日页日历卡片 `.calendar-card` 底色（neo-brutalism 第 294 行）一致。缓存 `?v=79`→`?v=80`，版本串 `v3.3.47`→`v3.3.48`。
- **v3.3.46**（仅本地 commit `1c1ef22`，未部署）：补充减肥记录模块产品文档到仓库（与实际代码版本号未对齐，v3.3.47 已含全部功能）。
- **v3.3.45 改动**（历史）：①修复移动端 `.app` 布局异常；②落实云端优先同步；③缓存 `?v=76`→`?v=77`。
- **v3.3.44 改动**（历史）：修复 `js/auth.js` 登录回调写死旧域名；缓存 `?v=69`→`?v=76`。

### 2.4 Supabase 前端集成（已完成）
- 已把 Supabase URL 与 publishable key 填入 `js/supabase-config.js`（仅 anon key）。
- `js/supabase-client.js`：通用 CRUD 封装（`list/upsertAll/save/remove/getSettings/saveSettings`），未配置时 `SupabaseReady=false` 自动回退 localStorage。
- `js/auth.js`：GitHub OAuth 登录/登出、登录态订阅、刷新页面恢复 session（并清理地址栏 `?code=` 防止刷新掉登录）；`redirectTo` 已修正为 `window.location.origin`。
- `js/store.js`：云端同步已完整实现——`_shouldSync` / `_pushBucket`（写时自动推云端）、`syncAfterLogin`（登录后以云端为权威、首次自动上传本地存量）、`pushAllToCloud` / `pullFromCloud` / `migrateLocalToSupabase`。
- `js/app.js`：`initAuth()` 全流程已接好——渲染登录按钮/头像、`getCurrentUser` 恢复登录态、`onAuthChange` 切换云端态、`Store.setCloudUser`、登录后 `syncAfterLogin`、登出清空；顶栏 `authArea`（id=`authArea`）+ 底部导航均有登录/退出入口。
- **【登录后优先读云端、本地仅作离线缓存】已落实（v3.3.45）**：`store.js` 新增 `refreshFromCloud()`（把云端数据拉回本地缓存作离线副本；拉取失败自动保留本地）、`startCloudSync(rerender)` / `stopCloudSync()`（登录后每 20s 用云端覆盖本地缓存并触发重渲染，断网自动回退本地；登出时停止）。`app.js` 在 `_onSignedIn` 后调用 `Store.startCloudSync(...)`、`_onSignedOut` 中调用 `Store.stopCloudSync()`。由于 UI 读取始终走同步的 `get()`（本地缓存），本地缓存被持续镜像成「云端的最新值」，因此登录后「你看到的数据 = 云端数据」，断网或另一端写入后定时刷新即可看到。
- **结论**：前端“登录 → 同步 → 回退”链路已 100% 就绪，服务端两步配置（建表 + 启用 GitHub provider）亦已完成，全链路打通。

### 2.5 减肥记录模块（v3.3.47 新增，自律分组）
- **入口**：侧边栏「自律」分组第二项「减肥记录」（图标为体重秤）；移动端底部导航含 `weightloss`。`app.js` 的 `navigate` 已挂 `weightloss` 分支 → `window.WeightLossModule.render(container)`。
- **文件**：`js/weightloss.js`（逻辑，IIFE 暴露 `window.WeightLossModule`）、`css/weightloss.css`（独立 Neo-brutalism 样式，不改动 `style.css`）。
- **功能点（按 PRD 完整实现）**：
  1. **首次引导**：`ensureProfile` 检测 localStorage 无档案则弹出「设置基础信息」（性别/身高/出生年份/初始体重/目标体重/口味/运动习惯），保存后自动用初始体重作为今日打卡。
  2. **月份选择器**：`wl-monthbar` 上一月/下一月 + 「全部记录」切换；「全部记录」视图按日期倒序列出所有体重打卡。
  3. **体重日历**：`wl-cal` 7 列网格，今日红色高亮、选中描黑边、格内显示体重数字、有琐事画小圆点。
  4. **今日体重卡**：打卡按钮、当前体重、本月变化、本月目标、BMI（含偏瘦/正常/超重/肥胖状态色）、目标进度（进度条颜色随完成度变化）、还差多少/已达标提示。
  5. **AI 饮食建议**：`showDietModal` → `API.aiChat`（Deepseek），输出 JSON 三餐 + 加餐热量；同日缓存（避免重复生成），支持重新生成。
  6. **记录琐事**：注射减重针（药名/剂量）、运动（类型/时长）、排便、饮酒、熬夜、备注。
  7. **趋势图**：`trendSVG` 纯 SVG 折线（体重实线 + 目标虚线 + Y 轴刻度 + 数据点 tooltip），<2 条记录显示空态。
  8. **AI 报告**：`showReportModal` → `API.aiChat`，按「本月 / 全部」作用域缓存，需 ≥2 条记录。
- **数据层**：档案 / 记录 / 报告均为**对象型**（记录按 `YYYY-MM-DD` 聚合，报告按作用域 key）。**必须用 `Store.getObject/setObject`**（不能用 `get/set` 数组型：空键返回 `[]` 为 truthy，会让 `ensureProfile` 误判“已有档案”跳过首启弹窗——这是 v3.3.47 修掉的核心 bug）。
- **云端同步现状（重要）**：三个 weightloss 键**已移出 `SYNC_BUCKETS`**，因其为对象型，与数组型同步循环（`_pushBucket`/`upsertAll`）不兼容——若留在 `SYNC_BUCKETS`，登录后 `pullFromCloud` 可能把云端数组回写覆盖本地对象，造成数据损坏。因此**当前减肥记录仅本地 `localStorage` 持久化，不跨设备同步**（P3 待办：为对象型 bucket 单独接云端同步）。

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

1. **✅ Supabase 服务端两步已完成（2026-08-11，走 Management API）**：用户给 `sbp_e156...` 管理 token，由我走 API 完成：
   - **① 建表 + RLS**：`POST /v1/projects/{ref}/database/query` 执行 `schema.sql`（201）。已校验 `information_schema` 三表存在、`pg_class.relrowsecurity` 三表均为 true、`pg_policies` 4 条策略就位（settings_owner / items_owner / profiles_read / profiles_write）。
   - **② 启用 GitHub 登录**：`PATCH /v1/projects/{ref}/config/auth`（`external_github_enabled=true`、client_id=`61ef00c3-...`、secret 已写入；`auth/v1/settings` 对外 `github:true` 确认）。回调白名单 `uri_allow_list` 已含 Vercel 与镜像两站。
   - **Secret 绝不进前端代码**，只留在 Supabase 后台 ✅。
   - 注：建表 + 启用 provider 均由 API 完成，**前端代码无需改动**，v3.3.44 即为上线版本。
2. **✅ GitHub client_id 已修正为正确 OAuth App 格式（2026-08-11）**：用户确认正确 Client ID 为 `Ov23liEodzXsXLAZqWGh`（GitHub OAuth App 现代格式，以 `Ov23` 开头，非 UUID），已 PATCH 更新到 Supabase（response 确认 `external_github_client_id=Ov23liEodzXsXLAZqWGh`、`enabled=true`、secret 沿用 `dfa8beca...`）。原 UUID `61ef00c3-...` 是误贴（疑似 GitHub App）。**残留风险**：secret `dfa8beca...` 是否为该 OAuth App 的密钥尚未实测——若登录报 bad client credentials/secret 错误，需用户提供此 OAuth App 对应的 Client Secret。另外须确保该 OAuth App 的 Authorization callback URL = `https://zvjiofbvfsyahkxrqhvb.supabase.co/auth/v1/callback`（否则 GitHub 跳转后报错）。
3. **✅ RLS 联调已通过（2026-08-11，用户在手机端验证同步）**：用户已在手机端用 GitHub 登录并验证数据上云与多端同步，说明建表 + RLS + GitHub provider 全链路打通；刷新不丢登录（`stripOAuthParams` 已清地址栏 `?code=`）、换号数据隔离（RLS `auth.uid()=user_id`）均按设计生效。
4. **🟢 UI 持续微调**：后续可能继续根据截图反馈小修小改。

---

## 5. 下一步计划

### 近期（UI 收尾）
- 根据用户后续截图反馈继续精修 Neo-brutalism 细节。
- 每次修改后保持：本地校验 → commit → 镜像部署 → GitHub push → Vercel 验证（带 `?nocache=`）。

### 中期（Supabase 迁移 —— 前端已完成，服务端已建表+启用 provider，仅差联调）
1. ✅ 建表 + RLS 已通过 Management API 完成（见第 4 节）。
2. ✅ GitHub provider 已通过 Management API 启用并写入凭据 + 回调白名单。
3. **（待做）** 提供一个**测试用 GitHub 账号**做联调：登录 → 数据上云 → 刷新不丢登录 → 换号数据隔离。重点排查 UUID/OAuth-App 风险（见第 4 节 item 2）。
4. 验证 Vercel 线上 `ai-workbench-tan.vercel.app` 与镜像 `191.40.37.48` 登录同步一致。

### 长期
- 稳定运行后，把 `progress.md` 更新为更轻量的“版本日志 + 架构决策”文档。

---

## 6. 已生成的关键文件清单及其路径

| 文件路径 | 说明 |
| --- | --- |
| `/Users/xuleng/WorkBuddy/ai/workspace/index.html` | 入口；加载 `style.css` → `neo-brutalism.css` → `weightloss.css?v=82`；版本字符串 `v3.3.50`；脚本统一 `?v=82` |
| `/Users/xuleng/WorkBuddy/ai/workspace/css/style.css` | **原站样式，换肤期禁止修改** |
| `/Users/xuleng/WorkBuddy/ai/workspace/css/neo-brutalism.css` | **主题覆盖层（当前 v82）**，所有 Neo-brutalism 视觉与修复补丁在此；第 15 节=图标 PNG 尺寸、第 16 节=扭蛋机 PNG |
| `/Users/xuleng/WorkBuddy/ai/workspace/neo-brutalism-preview.html` | 预览/参考页面，用于比对设计效果 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/app.js` | 主应用逻辑，含页面渲染、弹窗、日历、KPI 等 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/habits.js` | 习惯打卡模块；已注入 `--hc` 变量使阴影跟随图标色；v3.3.50 `HABIT_ICONS` 改为 PNG `<img>`、扭蛋机改为单张 PNG |
| `/Users/xuleng/WorkBuddy/ai/workspace/assets/gacha-machine.png` | **v3.3.50 新增**：扭蛋机 PNG 图（复制自用户 `扭蛋机png.png` 1024×1536），替代原 CSS 绘制扭蛋机 |
| `/Users/xuleng/WorkBuddy/ai/workspace/assets/icons/` | **v3.3.50 新增**：21 个打卡图标 PNG（由用户 `图标.png` 精灵图按 6×4 网格自动分割，每格裁 170×170），key 与 `HABIT_ICONS` 对应 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/weightloss.js` | **减肥记录模块**（v3.3.47 新增）；暴露 `window.WeightLossModule`；对象型数据走 `getObject/setObject` |
| `/Users/xuleng/WorkBuddy/ai/workspace/css/weightloss.css` | **减肥记录模块样式**（v3.3.47 新增），独立 Neo-brutalism 风格，不改动 `style.css` |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/modules.js` | 模块注册、导航顺序、更新日志 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/supabase-config.js` | Supabase URL + publishable key（已配置） |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/supabase-client.js` | Supabase 通用 CRUD 封装，未配置时回退 localStorage |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/auth.js` | GitHub OAuth 登录态管理 |
| `/Users/xuleng/WorkBuddy/ai/workspace/js/store.js` | 数据存储层；已实现 Supabase/localStorage 双后端（云端优先 + 本地离线缓存） |
| `/Users/xuleng/WorkBuddy/ai/workspace/supabase/schema.sql` | Supabase 表结构 + RLS 策略 |
| `/Users/xuleng/WorkBuddy/ai/workspace/progress.md` | 本检查点文件 |
| `/Users/xuleng/WorkBuddy/ai/workspace/server.js` | 本地静态服务器（开发用） |
| `/Users/xuleng/WorkBuddy/ai/auto-deploy.exp` | 镜像服务器 expect 自动部署脚本 |
| `/Users/xuleng/WorkBuddy/ai/.workbuddy/memory/2026-08-11.md` | 当日工作日志（含详细操作记录） |
| `/Users/xuleng/WorkBuddy/ai/.workbuddy/memory/MEMORY.md` | 项目长期记忆（架构决策、部署规则） |

---

## 7. 给新会话的 TL;DR

- 这是一个**纯前端的个人 AI 工作台**，已做 **Neo-brutalism 换肤** + **Supabase 数据同步**。
- 当前版本 **v3.3.50**：移动端布局已修复、云端优先同步已落实；**镜像站 v3.3.50 已部署** ✅，**Vercel 待 PAT 推送**（v3.3.49 已上线）。新增「减肥记录」模块（自律分组）：月份选择器 + 体重日历 + 今日体重卡（BMI/进度）+ AI 饮食/报告 + 记录琐事 + 趋势图 + 首启引导；数据本地 `localStorage`（对象型，`getObject/setObject`）。v3.3.48 体验优化：运势常驻刷新按钮 + 今日页桌面间距放宽 + 减肥日历琐事查看面板与奶油底色对齐。v3.3.49 banner 加入透明背景打字猫 GIF。**v3.3.50：打卡模块图标整体由线条 SVG 改为 PNG（21 个，精灵图自动分割）、扭蛋机由 CSS 绘制改为单张 PNG 图（均带 `?v=82` 缓存破坏）**。
- **Supabase 服务端两步已完成**（建表 + RLS + GitHub provider，走 Management API），GitHub Client ID 已修正为 OAuth App 格式 `Ov23liEodzXsXLAZqWGh`，用户在手机端已验证同步联通。
- 关键铁律：换肤只动 `neo-brutalism.css`、部署前 `node --check` + CSS 花括号配对、Supabase 只放 anon key、GitHub 推完清 token、Vercel 验证带 `?nocache=`、镜像打包必须在 `ai/` 目录 `tar -C workspace`。

---

## 8. 使用说明（云端同步机制）

### 8.1 如何开启多端同步
1. 打开网站（镜像 `http://191.40.37.48` 或 Vercel `https://ai-workbench-tan.vercel.app/`），点击左下角「登录同步」（已登录时点击头像）。
2. 用 **GitHub 账号** 授权登录（OAuth 跳转，回调自动回到当前站点）。
3. 首次登录：本地已有的数据会**自动上传到 Supabase 云端**；之后每次改动先写本地、后台同步到云端。

### 8.2 登录后数据流向（v3.3.45 起：云端优先）
- **未登录**：数据只在浏览器 `localStorage`，不碰云端。
- **已登录**：`localStorage` 作为**工作副本 + 离线缓存**；云端是权威。
  - 每次改动：本地立即保存，后台异步推到云端（fire-and-forget）。
  - 登录后每 20s：`refreshFromCloud()` 把云端最新数据拉回本地缓存并触发重渲染（断网时自动保留本地，不报错）。
  - 因此「你看到的内容 = 云端内容」，另一端写入后，本端最多 20s 内自动刷新看到（无需手动刷新）。
- **换设备 / 换浏览器**：同样用同一 GitHub 账号登录，即自动从云端拉取数据。

### 8.3 安全与隔离
- 数据按 GitHub 用户 ID 隔离（RLS `auth.uid() = user_id`），你只能读写自己的数据。
- 前端只持有 Supabase **anon / publishable key**；GitHub Secret 仅存于 Supabase 后台，绝不进前端代码。

### 8.4 回退与故障
- 换肤回退：删除 `index.html` 中 `neo-brutalism.css` 的 `<link>`，或 `git checkout v3.3.34 -- index.html`。
- 云端同步失败：网络异常时本地缓存继续可用，联网后定时任务自动重试；如需强制重新上云，可在设置页清除本地后用同一账号重新登录触发 `syncAfterLogin`。
- 登录后刷新页面：地址栏 `?code=` 会被自动清理，登录态不丢。
