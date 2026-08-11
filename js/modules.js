/**
 * Module Configuration
 * Defines all modules, navigation order, help text, status definitions, and update logs
 */
const ModuleConfig = {
  modules: {
    today: {
      key: 'today',
      name: '今日',
      icon: 'today',
      help: {
        title: '今日',
        sections: [
          { label: '这个功能做什么', text: '集中展示你今天需要关注的事项，包括待办任务、待确认事项和异常提醒。任务来源于其他模块，不需要在这里重复创建。还显示AI资讯和平台热点的快速入口。' },
          { label: '怎么操作', text: '点击左侧圆圈可标记完成；点击条目可查看详情或跳转到来源模块。异常提醒会以黄色卡片显示，需要优先处理。点击AI资讯和热点卡片可快速跳转查看。' },
          { label: '完成后会发生什么', text: '标记完成后，条目会显示删除线并保留在今日列表中，方便回顾。' },
          { label: '如何撤销', text: '再次点击圆圈即可取消完成状态。' },
          { label: '出错怎么办', text: '如果今日列表显示异常，请尝试刷新页面。数据保存在浏览器本地，清除浏览器缓存会导致数据丢失，请定期导出备份。' },
        ],
      },
    },
    ainews: {
      key: 'ainews',
      name: 'AI资讯',
      icon: 'ainews',
      help: {
        title: 'AI资讯',
        sections: [
          { label: '这个功能做什么', text: '自动获取每日AI行业资讯，包括模型发布、产品更新、行业动态、论文研究和技巧观点五个分类。数据来源为aihot.virxact.com公开API。' },
          { label: '怎么操作', text: '打开页面自动加载最新资讯，点击刷新按钮可手动更新。每条资讯可点击跳转原文。数据每小时自动缓存一次。' },
          { label: '完成后会发生什么', text: '资讯加载后缓存在本地，1小时内再次打开直接显示缓存数据，减少等待。' },
          { label: '如何撤销', text: '本模块为只读模式，不会修改任何数据。' },
          { label: '出错怎么办', text: '如果加载失败，可能是网络问题或API暂时不可用。页面会显示上次缓存的数据。点击刷新按钮重试。' },
        ],
      },
    },
    hot: {
      key: 'hot',
      name: '平台热点',
      icon: 'hot',
      help: {
        title: '平台热点',
        sections: [
          { label: '这个功能做什么', text: '整合四类热点内容：1) 平台热搜——实时获取抖音、微博、小红书、B站、今日头条的热搜榜单；2) 生活热点——AI抓取抖音、小红书、B站生活类热门话题与趋势；3) AI热点——以「周」为维度（最近7天）真实抓取 GitHub/AI门户/社媒 以及 抖音/B站/小红书 的 AI 类热门话题，并由 AI 汇总成「本周 AI 热点概要」周报；4) 竞品参考——列出 xuan酱、不一书、西门聪明蛋XD、老陈是小凳、不喝九 等 AI 科普博主的代表选题与风格，刷新可让 AI 基于当前热点推断各家最新选题方向。' },
          { label: '怎么操作', text: '点击顶部大标签切换四类热点。平台热搜下再点击平台标签切换不同平台。AI热点为真实抓取、生活热点由Deepseek生成、竞品参考的"最新选题"刷新由Deepseek推断。' },
          { label: '完成后会发生什么', text: '平台热搜数据每30分钟自动缓存；点击右上角刷新时，AI热点会按当前时间点重新向门户站点实时抓取最近7天的真实资讯，并重新生成本周概要。' },
          { label: '如何撤销', text: '本模块为只读模式，不会修改任何数据。' },
          { label: '出错怎么办', text: 'AI热点和生活热点需要配置Deepseek API Key。如果加载失败，请检查设置中的API配置或网络连接。' },
        ],
      },
    },
    topics: {
      key: 'topics',
      name: '选题灵感',
      icon: 'topics',
      help: {
        title: '选题灵感',
        sections: [
          { label: '这个功能做什么', text: '整合选题灵感来源："今日灵感"由AI根据抖音热点、今日AI资讯和你的灵感记录生成；"用户灵感"用于记录你自己想到的点子。' },
          { label: '怎么操作', text: '点击"生成今日灵感"让AI推荐选题；或点击"记录灵感"把突然想到的点子保存到用户灵感。每个选题建议包含选题名、开场、内容概要、结尾和关键词。' },
          { label: '完成后会发生什么', text: 'AI生成的今日灵感会缓存在本地当天有效；用户灵感永久保存，可被AI参考用于后续推荐。' },
          { label: '如何撤销', text: '用户灵感可随时编辑或删除。今日灵感可重新生成覆盖。' },
          { label: '出错怎么办', text: 'AI功能需要配置Deepseek API Key。如果生成失败，请到设置页面检查API配置。' },
        ],
      },
    },
    content: {
      key: 'content',
      name: '内容创作',
      icon: 'content',
      help: {
        title: '内容创作',
        sections: [
          { label: '这个功能做什么', text: '管理你的所有内容创作项目，包括脚本、文案、创意想法。支持按状态分类（创意、草稿、编辑中、已发布）。AI可辅助生成初稿。' },
          { label: '怎么操作', text: '点击"新建内容"手动创建，或点击"AI写作"让AI生成初稿。AI写作会弹出表单，需填写选题、平台、创作目的、行业/领域、目标受众（产品可选），填全后AI按"零一数科·视频号爆款文案"逻辑产出结构化脚本（Hook/中段/CTA，每段含画面与台词）。在列表中点击条目可查看详情、编辑内容、关联素材或选题。' },
          { label: '完成后会发生什么', text: '内容保存后会自动更新修改时间。发布后的内容可以在今日页面追踪提醒。' },
          { label: '如何撤销', text: '编辑后可随时修改内容。删除操作不可撤销，请谨慎操作。' },
          { label: '出错怎么办', text: '内容自动保存到浏览器本地存储。如果数据异常，可在设置中导入之前导出的备份。' },
        ],
      },
    },
    decomp: {
      key: 'decomp',
      name: '爆款拆解',
      icon: 'decomp',
      help: {
        title: '爆款拆解',
        sections: [
          { label: '这个功能做什么', text: '输入视频标题和文案/脚本，AI 会从结构分段、爆款归因、六维评分、可借鉴策略等维度进行深度拆解分析。' },
          { label: '怎么操作', text: '在输入框填写视频标题和文案内容，选择发布平台，点击"AI 拆解分析"。AI 会在 10-30 秒内完成分析，报告显示在页面下方。' },
          { label: '完成后会发生什么', text: '拆解报告保存在本地，可随时查看。报告包含结构分段、爆款归因、六维评分、可借鉴策略和改进建议。' },
          { label: '如何撤销', text: '可删除历史拆解记录。' },
          { label: '出错怎么办', text: '拆解功能需要配置 Deepseek API Key。如果失败，请到设置页面检查 API Key 是否有效或余额是否充足。' },
        ],
      },
    },
    inbox: {
      key: 'inbox',
      name: '收集箱',
      icon: 'inbox',
      help: {
        title: '收集箱',
        sections: [
          { label: '这个功能做什么', text: '临时存放你暂时不知道归到哪里去的内容：灵感、链接、临时任务、粉丝反馈等。后续再整理到对应模块。' },
          { label: '怎么操作', text: '点击"快速记录"添加内容。每条记录有类型标签（灵感、任务、链接、其他）。你可以将收集箱内容移动到选题、内容创作等模块。' },
          { label: '完成后会发生什么', text: '移动到其他模块后，收集箱中的原始记录会标记为"已处理"。' },
          { label: '如何撤销', text: '可随时编辑、移动或删除收集箱内容。' },
          { label: '出错怎么办', text: '数据保存在本地，如遇异常请刷新或导入备份。' },
        ],
      },
    },
    ai: {
      key: 'ai',
      name: 'AI帮手',
      icon: 'ai',
      help: {
        title: 'AI帮手',
        sections: [
          { label: '这个功能做什么', text: '基于Deepseek大模型的AI助手，可以帮你生成内容初稿、分析选题方向、整理运营数据、回答创作相关问题。AI的修改会先展示预览，等你确认后再保存。' },
          { label: '怎么操作', text: '在输入框输入你的需求，或点击下方的建议提示快速开始。AI回复后，你可以选择采纳、修改或忽略。' },
          { label: '完成后会发生什么', text: '采纳的内容会保存到对应模块。聊天记录保留在本地，方便后续查阅。' },
          { label: '如何撤销', text: 'AI生成的内容不会自动保存，只有你明确采纳后才会写入。可随时在对应模块中编辑或删除。' },
          { label: '出错怎么办', text: 'AI功能需要配置Deepseek API Key。如果回复异常，请到设置页面检查API配置。可在设置中清除聊天记录。' },
        ],
      },
    },
    dashboard: {
      key: 'dashboard',
      name: '数据看板',
      icon: 'dashboard',
      help: {
        title: '数据看板',
        sections: [
          { label: '这个功能做什么', text: '记录每条抖音视频的详细数据指标（播放、点赞、评论、分享、收藏、完播率、吸粉等），并自动生成可视化图表和多视频对比分析，支持AI生成每周数据报告。' },
          { label: '怎么操作', text: '点击"新增数据"手动添加一条视频的数据；点击"CSV上传"从抖音创作者中心导出的数据文件批量导入；在视频列表中勾选2-5条视频可生成对比图表。' },
          { label: '完成后会发生什么', text: '数据保存到浏览器本地。在右上角切换"总览"、"对比"、"报告"三个视图查看不同维度的分析。' },
          { label: '如何撤销', text: '可随时编辑或删除单条数据。删除不可恢复，建议定期在"设置-数据管理"中导出备份。' },
          { label: '出错怎么办', text: 'AI周报需要配置Deepseek API Key。如图表不显示，请检查浏览器控制台错误。CSV上传需保证文件为UTF-8编码。' },
        ],
      },
    },
    settings: {
      key: 'settings',
      name: '设置与数据',
      icon: 'settings',
      help: {
        title: '设置与数据',
        sections: [
          { label: '这个功能做什么', text: '管理工作台的各项设置，包括个人信息、AI API配置、数据管理和更新日志。' },
          { label: '数据保存方式', text: '所有数据保存在浏览器的localStorage中，不上传到任何服务器。这意味着：1) 数据只在当前浏览器中可用；2) 清除浏览器缓存会丢失数据；3) 建议定期导出备份。' },
          { label: 'AI API配置', text: '需要配置Deepseek API Key才能使用AI帮手、选题工坊等AI功能。API Key只保存在本地浏览器中，不会上传到任何服务器。获取地址：https://platform.deepseek.com' },
          { label: '导出/备份', text: '点击"导出数据"会将所有数据下载为JSON文件。请妥善保存。' },
          { label: '恢复/迁移', text: '在"导入数据"中选择之前导出的JSON文件即可恢复。换设备时可用此功能迁移数据。' },
          { label: '账号/费用', text: '本工作台无需注册账号。所有 AI 功能均通过 Deepseek API 实现，按使用量计费，费用由 Deepseek 平台收取。' },
          { label: '未实现的能力', text: '当前版本暂不支持：云端同步、多设备实时同步。这些功能将在后续版本中逐步实现。' },
        ],
      },
    },
    habits: {
      key: 'habits',
      name: '习惯打卡',
      icon: 'habits',
      help: {
        title: '习惯打卡',
        sections: [
          { label: '这个功能做什么', text: '把"小日常"式极简习惯打卡嵌入工作台：今日打卡、习惯管理、番茄钟、碎念笔记、数据统计（连续天数/完成率/热力图）和糖罐/扭蛋机奖励。所有数据保存在本地，登录后自动同步到云端，与其他模块一样多端可用。' },
          { label: '怎么操作', text: '今日打卡页列出当天需要完成的习惯，点击卡片即可打卡（带点击特效与彩花）；时长类/数量类习惯点击后填入数值。底部子标签可在「今日打卡 / 统计 / 糖罐 / 番茄钟 / 碎念笔记 / 扭蛋机 / 习惯管理」之间切换。习惯管理页可新增习惯、从模板库一键导入、编辑或归档。' },
          { label: '糖球与扭蛋', text: '每次打卡按习惯设置获得普通糖球；连续打卡满 7/14/21/30 天额外得彩虹糖球；番茄钟完成得专注糖球。所有糖球累计为糖果，可在扭蛋机花 50 糖果抽一次扭蛋，奖品与中奖概率在「新增奖励」中配置。' },
          { label: '完成后会发生什么', text: '打卡记录、糖球、笔记、奖励均即时保存。番茄钟结束后若关联了习惯会自动打卡并生成专注糖球。登录状态下这些数据会随云端同步，换设备登录自动拉取。' },
          { label: '如何撤销', text: '再次点击已打卡的习惯可取消当天打卡；笔记、习惯、奖励均可删除或编辑；兑换记录不可撤销，请谨慎兑换。' },
          { label: '出错怎么办', text: '数据保存在本地，如遇异常可刷新页面。长期建议登录 GitHub 同步云端，并在「设置与数据」中定期导出备份。' },
        ],
      },
    },
    weightloss: {
      key: 'weightloss',
      name: '减肥记录',
      icon: 'weightloss',
      help: {
        title: '减肥记录',
        sections: [
          { label: '这个功能做什么', text: '极简的每日体重管理：早晨一键打卡体重、查看当日 AI 饮食建议、睡前补记运动/注射减重针等琐事，并自动生成趋势图与 AI 体重解读报告。所有数据保存在本地，登录后自动同步到云端，多端可用。' },
          { label: '怎么操作', text: '点击日历中的某一天可补录/编辑当天体重与琐事；点击「今日打卡」记录当天体重；点击「今日食谱」让 AI 生成一日三餐建议；点击「记录琐事」勾选运动/注射/排便等；点击「数据分析」生成 AI 体重解读报告。' },
          { label: '首次使用', text: '第一次进入会引导填写基础信息：性别、身高、出生年份、初始体重、目标体重、饮食口味、运动习惯。这些信息用于计算 BMI、目标进度与 AI 建议，仅保存在本地。' },
          { label: '完成后会发生什么', text: '每次打卡/记录即时保存，日历对应日期显示体重数字，有琐事记录的日期显示标记点；本月趋势图随数据自动更新。登录状态下数据随云端同步，换设备登录自动拉取。' },
          { label: '如何撤销', text: '点击某天可重新编辑覆盖；饮食建议与报告可重新生成；数据均可在「设置与数据」中导出备份。' },
          { label: '出错怎么办', text: 'AI 功能需要配置 Deepseek API Key。若生成失败，页面会显示「生成失败，点击重试」。数据保存在本地，异常可刷新或导入备份。' },
        ],
      },
    },
  },

  // 数据看板数据维度定义
  dataDimensions: [
    { key: 'views', label: '播放量', unit: '次', type: 'count', higher: true },
    { key: 'likes', label: '点赞量', unit: '次', type: 'count', higher: true },
    { key: 'comments', label: '评论量', unit: '次', type: 'count', higher: true },
    { key: 'shares', label: '分享量', unit: '次', type: 'count', higher: true },
    { key: 'favorites', label: '收藏量', unit: '次', type: 'count', higher: true },
    { key: 'completionRate', label: '完播率', unit: '%', type: 'percent', higher: true },
    { key: 'bounce2sRate', label: '2s跳出率', unit: '%', type: 'percent', higher: false },
    { key: 'avgDuration', label: '平均播放时长', unit: '秒', type: 'duration', higher: true },
    { key: 'completion5sRate', label: '5s完播率', unit: '%', type: 'percent', higher: true },
    { key: 'avgPlayRatio', label: '平均播放占比', unit: '%', type: 'percent', higher: true },
    { key: 'notInterestedRate', label: '不感兴趣率', unit: '%', type: 'percent', higher: false },
    { key: 'followGained', label: '吸粉量', unit: '人', type: 'count', higher: true },
    { key: 'followLost', label: '脱粉量', unit: '人', type: 'count', higher: false },
    { key: 'followGainRate', label: '吸粉率', unit: '%', type: 'percent', higher: true },
    { key: 'followLossRate', label: '脱粉率', unit: '%', type: 'percent', higher: false },
  ],

  // 导航顺序
  navOrder: [
    { section: '核心', items: ['today', 'dashboard'] },
    { section: '创作', items: ['topics', 'content', 'decomp'] },
    { section: '资讯', items: ['hot'] },
    { section: '自律', items: ['habits', 'weightloss'] },
    { section: '系统', items: ['settings'] },
  ],

  // 移动端底部导航（横版可滑动）
  // 注：AI 帮手已改为全局右下角悬浮按钮，不再出现在主导航中
  mobileNav: ['today', 'dashboard', 'topics', 'content', 'decomp', 'hot', 'habits', 'weightloss', 'settings'],

  // 内容状态
  contentStatus: {
    idea: { label: '创意', tag: 'tag-yellow' },
    draft: { label: '草稿', tag: 'tag-blue' },
    editing: { label: '编辑中', tag: 'tag-pink' },
    published: { label: '已发布', tag: 'tag-green' },
  },

  // 选题状态
  topicStatus: {
    idea: { label: '创意', tag: 'tag-yellow' },
    planning: { label: '规划中', tag: 'tag-blue' },
    done: { label: '已完成', tag: 'tag-green' },
  },

  // 今日类型
  todayTypes: {
    task: { label: '待办', color: '#AFC9EA' },
    confirm: { label: '待确认', color: '#E9A8CF' },
    alert: { label: '异常', color: '#F4D85A' },
  },

  // 热点平台
  hotPlatforms: [
    { key: 'douyin', name: '抖音', endpoint: 'douyin' },
    { key: 'weibo', name: '微博', endpoint: 'weibo' },
    { key: 'xiaohongshu', name: '小红书', endpoint: 'xiaohongshu' },
    { key: 'bili', name: 'B站', endpoint: 'bili' },
    { key: 'toutiao', name: '头条', endpoint: 'toutiao' },
  ],

  // 平台热点主标签
  hotTabs: [
    { key: 'platform', name: '平台热搜' },
    { key: 'life', name: '生活热点' },
    { key: 'ai', name: 'AI热点' },
    { key: 'competitor', name: '竞品参考' },
  ],

  // 更新日志
  updateLogs: [
    {
      date: '2026-08-11',
      version: 'v3.3.53',
      content: `v3.3.53更新。
- 糖罐内糖果改为「罐体内部不规则堆积」：js/habits.js renderGlassJar 不再把糖果排成一行，而是按糖罐 PNG 的视觉轮廓（顶部/底部窄、中间宽的抛物线罐肚）给每颗糖生成绝对定位的 left/top/rotate
- 位置使用基于索引的确定性伪随机，保证同一颗糖位置稳定；y 方向偏向底部模拟重力堆积，x 方向限制在罐体宽度内并留边距，整体看起来在玻璃肚里自然堆叠
- 晃动逻辑不变：.jar-shaking 仍触发 .jar-shake-wrap / .jar-candy-pile / .jar-candy 的物理摆动动画，糖果会随罐体一起晃动
- neo-brutalism.css 第 17 节更新：.jar-candy-pile 改为 absolute 铺满 100%×100%；.jar-candy 改为 absolute 定位并保留圆角/阴影；.jar-overflow 移到罐体右下角
- 缓存版本 ?v=84 → ?v=85`,
      impact: '糖罐 PNG 里的糖果真正「装进」玻璃罐体，不规则排列且随罐体晃动',
    },
    {
      date: '2026-08-11',
      version: 'v3.3.52',
      content: `v3.3.52更新。
- 糖罐视觉替换为 PNG：用户给出透明底糖罐图（1254×1254 RGBA），复制到 assets/candy-jar.png
- js/habits.js 的 renderGlassJar 删除原 SVG 绘制（jarGlassGrad / jarClip / jar-body path），改为 <img class="jar-png" src="assets/candy-jar.png?v=84">；糖果球 .jar-candy-pile 保留，绝对定位覆盖在糖罐图片的玻璃区域
- neo-brutalism.css 新增第 17 节：.jar-glass 去圆角/overflow、max-width 360px；.jar-png 100% 宽；.jar-candy-pile 用百分比定位（left/right 20%、bottom 13%、top 40%），让糖果球落在新糖罐的玻璃肚内
- 缓存版本 ?v=83 → ?v=84`,
      impact: '糖罐从 CSS/SVG 绘制改为用户提供的卡通 PNG，与扭蛋机/图标风格统一',
    },
    {
      date: '2026-08-11',
      version: 'v3.3.51',
      content: `v3.3.51更新。
- 减肥记录（体重档案/每日记录/AI报告）纳入 Supabase 云端同步：新增 OBJECT_BUCKETS 标记对象型 bucket，store.js 的 _pushBucket / syncAfterLogin / pushAllToCloud / pullFromCloud / refreshFromCloud 均增加对象型分支（整对象作为一个 user_items 行，localStorage 仅作离线缓存）
- setObject 对对象型 bucket 写本地后立即推云端；登录后多端自动同步减肥记录，断网保留本地
- 缓存版本 ?v=82 → ?v=83`,
      impact: '减肥记录与习惯/待办等模块一致，登录后跨设备自动同步，本地仅作离线缓存',
    },
    {
      date: '2026-08-11',
      version: 'v3.3.45',
      content: `v3.3.45更新。
- 修复移动端布局异常：.app 原为 grid(240px 1fr)，移动端侧边栏隐藏后 grid track 仍在，把主内容区挤压成约 100px 窄列、内容被 overflow:hidden 裁切，左侧大片空白；现 ≤900px 塌成单列，主内容占满视口宽度
- 落实【登录后优先读云端、本地仅作离线缓存】：store.js 新增 refreshFromCloud()（拉云端覆盖本地缓存）+ startCloudSync()/stopCloudSync()（登录后定时用云端覆盖本地，断网自动保留本地）；app.js 登录成功后启动、登出时停止
- 局部 bump 缓存版本 ?v=76 → ?v=77`,
      impact: '移动端布局恢复正常；登录后读取以云端为准、本地仅作离线缓存，多端同步更实时',
    },
    {
      date: '2026-08-11',
      version: 'v3.3.35',
      content: `v3.3.35更新。
- 全站视觉换肤为 Neo-brutalism（新粗野主义）：奶油底 #FFFDF5 + 底板波点纹理、纯黑描边与硬阴影（4/8/12px 无模糊）、一律直角（头像/徽章/玻璃罐/扭蛋球等圆形保留）
- 主色热红 #FF6B6B、辅色明黄 #FFD93D、柔和紫 #C4B5FD；字体 Space Grotesk（中文回退 Noto Sans SC）700/900
- 按钮直角+全大写+机械按压，输入框聚焦变黄，导航图标加彩色底座，欢迎 banner 红阴影、运势卡紫阴影+顶部拼色条纹
- 仅通过新增 css/neo-brutalism.css 覆盖实现，JS 与原 style.css 零改动；删除该 link 即可回退到 v3.3.34`,
      impact: '整站视觉切换为新粗野主义，功能逻辑零改动，可随时一键回退',
    },
    {
      date: '2026-08-11',
      version: 'v3.3.34',
      content: `v3.3.34更新。
- 纠正 v3.3.33 中"模块之间不留白"的误读：恢复各模块之间协调美观的留白
- 左侧 hero-left-stack 内部间距由 0 调整为 16px，today-hero 左右列间距保持 16px，整体留白节奏统一`,
      impact: '首页模块之间保留美观留白，不再完全紧贴',
    },
    {
      date: '2026-08-11',
      version: 'v3.3.33',
      content: `v3.3.33更新。
- 首页 today-hero 布局重组：左侧改为「绿色欢迎 banner + 提醒 & 动态」上下堆叠，中间无间隔；右侧整列留给今日运势模块
- today-hero 对齐方式恢复 stretch，让左侧堆叠与右侧运势卡片同高，模块之间不留白
- 运势卡片内容区改为 flex 纵向 space-between，在拉伸高度下自动分布，避免底部空荡`,
      impact: '首页模块排布更符合用户截图示意，减少模块间留白',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.32',
      content: `v3.3.32更新。
- 压缩首页左侧绿色欢迎 banner：内边距由 32px 减至 24px，标题字号 28→24px，副标题改为小号字，各元素间距收紧，最小高度由 200px 降至 170px
- 调整 today-hero 对齐方式：由 stretch 改为 start，让欢迎 banner 按自身内容高度自然呈现，不再被右侧运势+提醒面板撑出大面积空绿区`,
      impact: '首页欢迎模块面积明显减小，页面首屏更紧凑',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.31',
      content: `v3.3.31更新。
- 「今日运势」卡片移除「今日五行」展示标签（生成逻辑仍结合五行，仅不再单独展示）
- 压缩运势卡片整体面积：减小内边距、日期与分数字号、各区块间距；幸运色/食物标签由三列改回两列紧凑排布`,
      impact: '运势卡片更紧凑，首页 banner 占用面积明显减小',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.30',
      content: `v3.3.30更新。
- 「今日运势」升级为「星座 + 当日五行」双维度：Deepseek 结合用户星座与当日干支五行生成运势
- 卡片新增「今日五行」展示（金/木/水/火/土，带对应五行色圆点），与幸运色、幸运食物并排
- 提示词调整：今日建议与避免事项均要求结合当日星座与五行给出；其余字段（分数/星级/幸运色/食物/寄语）不变`,
      impact: '运势增加五行维度，建议与禁忌更贴合传统命理语境',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.29',
      content: `v3.3.29更新。
- 首页欢迎 Banner 右侧新增「今日运势」卡片：顶部日历环装饰 + 日期 + 今日运势分数 + 星级
- 运势由 Deepseek 根据生日（1992-12-04，射手座）每日生成，包含幸运色、幸运食物、今日建议、避免事项、运势分数与每日寄语
- 运势结果本地缓存 6 小时，支持一键重新生成；未配置 API Key 时友好提示前往设置`,
      impact: '首页新增 AI 生成今日运势，为每日开工提供轻松参考',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.28',
      content: `v3.3.28更新。
- 「糖罐」晃动更自然：罐子受惯性和重力影响做阻尼摆动，幅度递减；糖果 pile 与单颗糖果均有独立延迟的晃动动画，整体更真实
- 优化糖罐裁剪：糖果 pile 内缩更大边距，配合 overflow:hidden，避免糖果晃动时超出罐身
- 「扭蛋机」页面重排：扭蛋机置于上方，奖池移至下方
- 扭蛋机全新样式：奶油猫耳顶、玻璃球舱、粉色波浪遮篷、奖品橱窗、投币口、大转盘 lever，整体更贴近参考图`,
      impact: '糖罐物理晃动更自然，扭蛋机视觉与布局优化',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.26',
      content: `v3.3.26更新。
- 修复「新增/编辑习惯」弹窗无法滚动的问题（电脑端与手机端均可滚动），底部「每次完成奖励糖数」及保存按钮可正常操作
- 习惯图标库新增「药丸」「药膏」两个医疗/健康类图标`,
      impact: '习惯表单交互修复，新增健康类图标',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.25',
      content: `v3.3.25更新。
- 习惯打卡：去掉补签功能；「设置」更名为「习惯管理」
- 今日打卡卡片完成时不再翻转，改为绿色背景+边框高亮+✓放大，保留习惯名称避免误打卡；点击卡片新增涟漪动效
- 碎念笔记新增「记录日期」选择，可补记过往想法
- 新增「糖罐」独立标签页（位于统计右侧）：玻璃罐盛装已完成的糖果，支持周/月/年/自定义日期筛选，点击瓶子触发晃动动画+糖果自然晃动
- 糖罐下方展示所选周期内每个习惯的完成次数与对应糖果数
- 新增习惯时可设置每次完成奖励糖果数（0-100，快捷选择+步进器）`,
      impact: '习惯打卡交互与视觉体验优化，新增玻璃罐糖果展示与习惯奖励自定义',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.24',
      content: `v3.3.24更新。
- 新增「习惯打卡」模块（侧边栏「自律」分组、移动端底部导航新增入口），完全独立于现有功能，不改动任何原有模块与界面位置
- 今日打卡：列出当天需完成的习惯，点击卡片极速打卡（翻转动画 + 全勤彩花），支持按"次/时长/数量"三种打卡类型与近 7 天补签
- 习惯管理（设置页）：自定义名称/图标/马卡龙色/周期/时段/分组，内置模板库（早起、阅读 30 分钟、喝 8 杯水、冥想、背单词等）一键导入
- 番茄钟：SVG 圆形进度环、可自定义时长、可关联习惯（结束后自动打卡并生成专注糖球）
- 碎念笔记：时间线记录灵感与情绪，支持标签
- 统计：连续打卡天数、近 30 天完成率、总打卡数、日历热力图（5 级）、近 30 天趋势柱状图
- 小球罐积分系统：每次打卡得普通糖球（1 积分），连续 7/14/21/30 天额外得彩虹糖球（2 积分）；奖励商店支持自定义奖励兑换与 50 积分盲盒抽奖
- 数据复用工作台已有的 localStorage + Supabase 云端同步（新增 7 个同步 bucket），登录后与其他模块一起多端同步`,
      impact: '工作台新增「小日常」式习惯打卡与自律激励体系，原有功能与界面零改动',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.23',
      content: `v3.3.23更新。
- AI热点由「每日」改为「每周」维度：真实资讯只保留最近 7 天，GitHub 热门仓库时间窗从 2 天扩到 7 天，Hacker News 改用按时间检索并限定本周内，保证周报口径统一
- 「今日 AI 热点概要」更名为「本周 AI 热点概要」，提示词改为周报口径：要求把同主题资讯合并成一周趋势、越新的消息权重越高，并明确禁止编造素材外的产品名/公司名/数据
- 点击右上角刷新时穿透全部缓存做真实抓取：AI门户(Aihot) 的 force 参数此前未透传导致刷新仍读本地缓存，现已修复，刷新必定按当前时间点重新抓取门户最新消息并重新生成概要
- 概要卡片与列表新增「统计周期（如 08-04 ~ 08-10）」「更新于 / 抓取于 时间」标注，时效性一目了然
- 送入 AI 的资讯条数由 12 条增至 16 条，并附带每条的发布日期，便于按周归纳`,
      impact: 'AI热点以周为维度汇总，刷新即按当前时间抓取门户最新真实消息，兼顾周报视角与时效性',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.22',
      content: `v3.3.22更新。
- 今日页「提醒 & 动态」每条消息增加勾选已读功能，勾选后文字带删除线，与待办事项交互保持一致
- 「今日」侧边栏/底部导航的数字徽章现在同时统计「未完成待办 + 未读提醒」，全部已读后徽章自动消失
- 提醒数据持久化到 xl_alerts 并纳入云端同步，手机/电脑登录同一账号后已读状态自动同步
- 提醒面板增加「清空已读」按钮，可一键移除已读提醒`,
      impact: '提醒&动态支持已读管理，数字提示更准确',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.21',
      content: `v3.3.21更新。
- 修复「每次刷新页面都要重新登录」：登录成功后地址栏残留的一次性 ?code= 参数会在刷新时被重复交换，失败后清空登录态；现已在会话恢复后自动抹除回调参数，并加超时兜底
- 登录态恢复改为优先读取本地已持久化的 session，不再依赖网络请求校验，弱网/断网下刷新也能保持登录
- 修复初始化误判：INITIAL_SESSION 事件拿不到会话时不再当作「已退出登录」处理，不会再误弹退出提示
- token 自动续期时只刷新界面，不再重复触发全量云端同步；登录后界面立即切换为已登录状态，同步在后台进行`,
      impact: '刷新页面、关闭重开浏览器都能保持登录状态，不必反复授权',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.20',
      content: `v3.3.20更新。
- 修复 GitHub 登录后跳 404 的问题：显式开启 detectSessionInUrl 与 PKCE 流程，OAuth 回调带回的 code 参数会被自动交换为登录态并清理地址栏
- 新增 supabase/fix-profiles-backfill.sql：用于修复「Authentication → Users 已有账号但 profiles 表为空」的历史数据回填与触发器重建
- 部署指引补充 Step 8「回填网址到 Supabase」：Site URL 与 Redirect URLs 未配置是登录 404 的根本原因`,
      impact: '登录授权后可正常跳回工作台并完成云端同步',
    },
    {
      date: '2026-08-10',
      version: 'v3.3.19',
      content: `v3.3.19更新。
- 移动端登录入口：底部导航最右侧新增「登录同步」入口，未登录时点击跳转 GitHub OAuth；已登录时显示 GitHub 用户名/头像，点击弹出账号菜单可退出登录
- 修复手机端看不到登录功能的问题：原登录区仅在桌面侧边栏，手机端 sidebar 隐藏后无法登录；现在 bottom-nav 常驻登录入口
- GitHub OAuth 回调地址优化：由 window.location.href 改为固定站点根地址，避免带 hash/query 导致回调异常`,
      impact: '手机、电脑都能登录同一 GitHub 账号并自动同步数据',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.17',
      content: `v3.3.17更新。
- 日历支持月份切换：新增「上一月/下一月」按钮，标题显示当前年月；非当前月时「今天」入口改为「回到今天」按钮，可一键切回本月并选中今天
- 日历待办红点：有待办事项的日期（dueDate / 开始日期 / 结束日期）在日期数字下方显示小红点，一眼识别有内容的日期
- 待办编辑改为日期维度：「开始时间/结束时间」下拉框改为「开始日期/结束日期」日期选择框；存储字段同步为 startDate/endDate，并保留对旧 startTime/endTime 的读取兼容`,
      impact: '日历可查看其他月份并标识待办日期；待办时间字段改为日期范围',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.18',
      content: `v3.3.18更新。
- 多端同步：接入 Supabase（PostgreSQL 云）做云端数据层，前端仅使用 publishable(anon) key，靠 RLS 保证每用户仅读写自己的数据，禁用 service_role
- 登录：GitHub OAuth 登录（Authentication → Sign In / Providers 开启），侧边栏新增登录区，登录后自动把本地数据同步到云端、换设备登录自动拉取
- 数据迁移：新增 Store.syncAfterLogin 以云端为权威、首次自动上传本地存量数据；Store.pushAllToCloud / pullFromCloud / migrateLocalToSupabase 支持手动上传与拉取
- 同步策略：本地优先 + 后台异步推送（所有写操作先落 localStorage 再异步推云端），未登录时完全回退本地，不影响现有功能`,
      impact: '手机/电脑登录同一 GitHub 账号即可自动同步数据；各用户数据相互隔离',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.16',
      content: `v3.3.16更新。
- 修复日历/待办日期不一致 bug：根因是代码使用 new Date().toISOString().slice(0,10) 获取"今天"，在 UTC+8 晚间会跨日；同时 renderCalendar 用 new Date(year,month,day).toISOString() 生成 dateStr 时，本地 0 点转成 UTC 前一天 16 点，导致日历格子的 dateStr 与实际日期错位
- 统一日期处理：app.js 新增 App.localDateStr(d) 返回本地时区 YYYY-MM-DD；store.js 新增 Store.localDateStr(d)；替换所有与日历、待办、今日灵感缓存相关的日期生成
- 待办事项支持编辑和删除：todo-item 右侧新增编辑/删除图标按钮（PC hover 显示，移动端始终显示），点击编辑弹出回填表单，点击删除二次确认；bindTodayEvents 中整行跳转改为仅点击 .todo-main 区域
- 新增"清空待办"入口：待办面板 header 右侧增加清空按钮，支持"清空今天/选中日期"和"清空全部历史数据"；store.js 新增 clearTodayItemsByDate(dateStr) 和 clearAllTodayItems()
- 清空历史示例数据：seedData() 中 todayItems 改为空数组，新用户不再看到旧的示例待办（含宠物内容）`,
      impact: '修复日期错乱问题；待办可编辑删除；支持一键清空历史数据',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.15',
      content: `v3.3.15更新。
- AI热点页新增「今日 AI 热点概要」模块（位于真实资讯列表上方）：由 Deepseek 汇总真实 AI 资讯（GitHub/AI门户/HN/抖音/B站/小红书），输出覆盖 AI 动态、Agent/Skill、实用工具的概要报告
- api.js 新增 generateAIHotSummary(items, force)：系统提示词要求输出纯 JSON（summary/highlights/agents/tools/insight），面向短视频创作者口语化；鉴 DeepseekApiKey 缺失返回 NO_KEY；结果 Store.saveAIHotSummary 缓存 30min
- app.js loadAIHotTopics('ai') 抓取后并行生成概要，拼在 renderRealAIHot 之前；renderAIHotSummary(data) 渲染卡片（概述+三栏要点+选题启发），失败仅提示不阻断列表；store.js 新增 getAIHotSummary/saveAIHotSummary；css 新增 .ai-summary-card 深绿渐变样式（含移动端单列）`,
      impact: 'AI热点页顶部新增 AI/Agent/Skill/工具汇总的今日概要，创作者一眼看懂今日值得做的方向',
    },

    {
      date: '2026-08-09',
      version: 'v3.3.14',
      content: `v3.3.14更新。
- AI热点平台源关键词扩展：AI_TOPIC_KEYWORDS 新增 Codex/codex/gpt/WorkBuddy/workbuddy/Skill/skill/提示词工程/AI Agent
- fetchPlatformAIHotTopics 筛选提示词明确：抖音/B站/小红书热搜标题含 Codex、codex、GPT、gpt、ChatGPT、WorkBuddy、workbuddy、Skill、skill、AI Agent、智能体、提示词工程、Copilot（含大小写变体）等词的，也应视为 AI 相关并纳入 AI热点，让这些具体产品/工具名的热搜能被识别`,
      impact: 'AI热点在抖音/小红书/B站能覆盖 codex、gpt、workbuddy、skill 等具体 AI 产品/工具名相关的热点',
    },

    {
      date: '2026-08-09',
      version: 'v3.3.13',
      content: `v3.3.13更新。
- 选题灵感提示词追加参考源要求：系统提示词明确"必须综合参考 AI热点、竞品参考、用户灵感（含平台热点）四类来源，不可只依赖单一来源"；用户消息新增【AI热点（平台真实 AI 热门内容）】与【竞品参考（真实历史选题 + 最新选题方向）】两个数据块，结尾改为"综合参考 AI热点、竞品参考、用户灵感与平台热点"
- 调用层改动：generateTodayInspiration 新增 aiHotTopics、competitorRef 两参数；app.js 生成时并行抓取真实 AI热点（fetchRealAIHotNews）与竞品参考（Store.getCompetitorTopics 最新方向 + getCompetitorRealTitles 真实标题）一并传入，使"参考 AI热点/竞品参考"真正落地而非空承诺`,
      impact: '今日选题灵感将结合真实 AI热点与竞品博主选题方向产出，更贴近爆款角度',
    },

    {
      date: '2026-08-09',
      version: 'v3.3.12',
      content: `v3.3.12更新。
- AI热点平台源重写（fetchPlatformAIHotTopics）：旧逻辑用"AI关键词硬过滤"真实热搜，因抖音热搜多为娱乐/时事，AI命中极少导致抖音条目不出现；改为"真实热搜 + Deepseek 标注 AI 角度"，强制抖音至少返回 1 条（真实数据，无 AI 强内容时标"平台趋势"），B站/小红书筛到才返回；新增兜底 buildFallbackPlatformItems（AI失败时直接用真实抖音热搜 TOP3），renderRealAIHot 新增"AI热点/平台趋势"标签
- 竞品参考刷新改为基于真实公开信号：新增 fetchFeiguaArticles（抓取飞瓜 dy.feigua.cn/Article2 公开行业文章，实测可解析真实标题）作为真实信号，generateCompetitorTopics 的"最新选题方向"推断据此生成（不再纯靠抖音热搜）
- 竞品参考新增"真实历史选题"：每位博主卡片新增"添加真实选题"按钮，可手动粘贴从灰豚/蝉妈妈后台复制的该博主真实视频标题（每行一条），原样保存展示——这是拿到真实博主标题的唯一可行路径（灰豚主播页为腾讯滑块验证码墙、蝉妈妈为登录墙，无法程序化抓取指定博主视频列表）
- store.js 新增 getCompetitorRealTitles/saveCompetitorRealTitles；css 新增真实选题/标签样式`,
      impact: 'AI热点确保抖音/B站/小红书平台 AI 热点真实可见；竞品刷新有真实公开信号支撑，并支持粘贴真实博主选题',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.11',
      content: `v3.3.11更新。
- 选题灵感提示词放宽竞品博主约束：原"产出必须自有新意，不重复其内容"改为"产出只需略有新意即可；允许重复同样类型的内容，只要侧重点或切入角度不同即可"（api.js generateTodayInspiration）
- 平台热点新增「竞品参考」主标签：列出 xuan酱、不一书、西门聪明蛋XD、老陈是小凳、不喝九 五位 AI 科普博主的风格与代表性历史选题（示例）；点击刷新由 Deepseek 基于当前抖音/AI 热点推断各家"最新选题方向"（非真实抓取账号内容，抖音/小红书无公开 API 且前端跨域受限）
- AI热点新增平台 AI 热点源：在原有 GitHub/AI门户/社媒基础上，并行抓取并筛选 抖音/B站/小红书 热搜中的 AI 相关内容（关键词过滤），保证抖音至少出现；renderRealAIHot 新增抖音/B站/小红书来源徽章配色
- store.js 新增 getCompetitorTopics/saveCompetitorTopics 缓存；api.js 新增 generateCompetitorTopics / fetchPlatformAIHotTopics 并导出`,
      impact: '选题灵感更敢借鉴竞品；新增竞品监测 tab；AI热点覆盖抖音/B站/小红书平台 AI 热点',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.10',
      content: `v3.3.10更新。
- 内容创作「AI写作」提示词升级：仿照「零一数科·视频号爆款文案生成（体验版）」技能的生成逻辑与格式——5 字段信息收集（创作目的/行业/受众/选题/产品）→ 脚本类型选型（痛点/场景/剧情/口播/开箱/教程 6 类）→ 结构化生成（Hook段/中段/CTA段，每段分别给 visual 画面 + dialogue 台词）→ 合规质检（极限词/功效宣称/口语化）→ 结构化 JSON 输出
- AI写作问答弹窗重构：采集 选题/平台/创作目的/行业/受众/产品 6 项（前 5 项必填，产品可选），去除原"风格"下拉
- 生成结果改为结构化脚本卡片展示：分段表（段落/功能/画面/台词/时长）、脚本类型、节奏、标签、口播全文，并支持一键采纳保存到草稿
- api.js generateContent 改为接收对象参数；app.js showAIWritePanel 与新渲染、CSS .script-* 样式同步新增`,
      impact: 'AI写作产出具备爆款结构逻辑的分镜头脚本，更贴近零一数科爆款文案范式',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.9',
      content: `v3.3.9更新。
- 「平台热点 - AI热点」标签重构为真实每日资讯（不再是 AI 整合的趋势卡片）：并行抓取并聚合三个真实数据源——Aihot(AI门户真实资讯) + GitHub 每日热门仓库(Trending) + Hacker News(AI相关社媒讨论)，去重、按时间倒序、截取 6-10 条
- 新增 js/api.js 的 fetchRealAIHotNews() 及 3 个子源函数（fetchAihotRealItems / fetchGitHubTrending / fetchHackerNewsAI），走 fetchWithFallback 带 CORS 回退；独立缓存 key xl_ai_real_hot_cache，30 分钟 TTL，刷新按钮强制更新
- 新增 renderRealAIHot() 资讯列表渲染 + .real-hot-* CSS（来源徽章/GitHub星标/HN分数/时间/摘要截断）
- 「生活热点」标签保留原有 AI 生成趋势卡片不变`,
      impact: 'AI热点页展示 GitHub/AI门户/社媒的真实每日热点，刷新即更新；生活热点仍由 Deepseek 生成',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.8',
      content: `v3.3.8更新。
- 选题灵感"生成今日灵感"提示词新增竞品博主参考：xuan酱、不一书、西门聪明蛋XD、老陈是小凳、不喝九（均做教学 + AI Agent / Skill 实用知识科普）
- 系统提示词新增【竞品博主参考风格】段落，用户消息新增【竞品博主参考】清单，要求借鉴其选题角度（教学向、实用向、普通人0门槛），但产出必须自有新意不重复其内容`,
      impact: '"生成今日灵感"的选题会参考竞品博主风格，更贴近教学/实用科普方向',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.7',
      content: `v3.3.7更新。
- 移除工作台中所有提示词的宠物相关关键词：宠物热点模块的 AI 提示词（原"专注于宠物与AI领域/宠物领域生成"）改为"生活与AI领域/生活领域生成"
- 平台热点主标签"宠物热点"重命名为"生活热点"（hotTabs 的 key 由 pet 改为 life）
- 替换种子热搜数据（抖音/微博/小红书/B站/头条 + AI热点/生活热点缓存）中全部宠物内容，改为通用 AI/科技/生活类示例——这些热搜数据会作为上下文喂给"生成今日灵感"，是灵感仍偏宠物的真正根因
- 平台热点帮助文案同步去宠物化`,
      impact: '"生成今日灵感"不再受宠物内容影响；平台热点页的"宠物热点"标签变为"生活热点"',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.6',
      content: `v3.3.6更新。
- 调整「生成今日灵感」系统提示词的专家身份：从「资深的宠物自媒体选题策划专家」改为「面向普通人的 AI 应用科普选题专家」，更贴合当前"普通人 0 编程基础的 AI 易用性、日常应用"的选题方向`,
      impact: '选题灵感模块的输出风格更偏向 AI 生活应用科普，不再强调宠物自媒体视角',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.5',
      content: `v3.3.5更新。
- 真正修复「输入了 API Key 还是用不了」的问题：根因是设置页把 API Key 存在 xl_settings，而 AI 调用时从 xl_deepseek_settings 读取，两个 localStorage key 不一致
- 修改 API.getDeepseekSettings，优先从 Store.getSettings()（xl_settings）读取 Deepseek 配置，同时兼容旧的 xl_deepseek_settings`,
      impact: '设置页保存的 API Key 能被 AI 生成、AI 助手等所有功能正确读取',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.4',
      content: `v3.3.4更新。
- 修复设置页配置互相覆盖的问题：「保存用户信息」和「保存 Deepseek 配置」分别只传部分字段，原 saveSettings 会全量替换导致后存覆盖先存
- 将 Store.saveSettings 改为合并语义（只更新传入的字段，保留其他已存配置），分模块保存不再互相覆盖`,
      impact: '在设置页多次保存不同配置，API Key 等字段不再丢失',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.3',
      content: `v3.3.3更新。
- 修复 AI 悬浮助手输入框无法打字的问题：未配置 API Key 时不再禁用输入框，改为 placeholder 提示并在发送时弹窗引导配置
- 修复手机端数据看板视频列表字体大小不一致、表头/数据换行超框的问题：删除 1280px 以下对 grid 列数的覆盖，恢复 17 列横向滚动；表头与数据行字体统一为 12px/13px
- 视频表格最小宽度由 1460px 调整为 1520px，保证 15 个指标列完整显示不换行`,
      impact: 'AI 助手可正常输入，手机端视频表格不再超框',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.2',
      content: `v3.3.2更新。
- AI 帮手改为全局悬浮按钮：右下角蓝色机器人头像，点击展开对话弹窗
- AI 弹窗固定在屏幕右下角，随页面滚动始终可见；电脑端为 420×620 圆角卡片，手机端为底部抽屉
- 从侧边栏、底部导航、桌面浮动工具栏中移除"AI 帮手"入口，所有页面均可通过悬浮按钮唤起
- 弹窗内保留原有 AI 小猫助手全部功能：欢迎语、快捷提示词、聊天记录、输入发送
- 未配置 API Key 时，弹窗顶部显示友好提示并引导到设置页配置`,
      impact: 'AI 助手入口更明显，任何页面都能快速唤起',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.1',
      content: `v3.3.1更新。
- 今日灵感系统提示词调整：选题方向从"宠物赛道借势"改为"普通人0编程基础的AI易用性、普通人如何把AI应用在日常工作处理和生活"
- 输出数量调整为3-4个选题，聚焦普通人AI实用场景`,
      impact: '今日灵感选题方向更聚焦普通人AI应用',
    },
    {
      date: '2026-08-09',
      version: 'v3.3.0',
      content: `v3.3更新。
- 数据看板可视化：4 张图表的图例全部上移到卡片右上方，避免与 X 轴视频标题互相挤压
- 折线图与柱状图：底部 padding 扩大到 62px，X 轴标签倾斜 -35° 后可显示更多字符不截断
- 折线图：调整图层顺序，确保 Y 轴网格文字不会被数据点压住
- 图表卡片：去掉"标题栏拖拽移动卡片"功能（底部 resize 高度仍保留）
- 总览与对比分析 tab 下 8 个图表（含饼图）顶部图例位置统一`,
      impact: '图表文字不再超框 / 图例右上方不再占底部空间',
    },
    {
      date: '2026-08-08',
      version: 'v3.2.0',
      content: `v3.2更新。
- 数据看板视频列表：横向表头展示全部 15 个数据维度，支持横向滚动查看
- 数据看板视频列表：右上角增加时间段选择器，按 createdAt 上传日期分组筛选
- 数据看板可视化图表：X 轴标签改为倾斜角度显示，避免标题重叠超框
- 数据看板可视化图表：卡片支持拖拽调整位置，右下角可拖拽调整高度
- 对比分析：在纯数据表格上方新增可视化图表（播放量对比/互动数据对比/完播质量对比/播放量占比圆饼图）
- 对比分析：纯数据表格与最佳表现卡片保留在最下方
- 全站按钮样式精致化：优化圆角、阴影、hover 提升与图标对齐，删除类按钮悬停变红提示`,
      impact: '数据看板列表/图表/对比分析优化 + 按钮精致化',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v3.1.0',
      content: `v3.1更新。
- AI 帮手：全新欢迎界面，新增可爱的「AI 小猫助手」形象（SVG 绘制，机器人+小猫结合）
- AI 帮手：优化消息气泡样式，机器人消息为白底圆角卡片，用户消息为深色气泡
- AI 帮手：快捷建议按钮改为圆角胶囊样式，悬停时绿色高亮
- AI 帮手：输入框区域改为独立卡片样式，视觉更聚焦`,
      impact: 'AI 帮手界面美化',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v3.0.0',
      content: `v3.0更新。
- 今日页提醒&动态：改为基于数据看板视频数据自动对照
  - 按 createdAt 日期分组，对比最新上传批次与前一次上传批次
  - 触发条件：平均播放量下降 > 20%，或平均互动数（点赞+评论）升降幅 > 20%
  - 正常时显示绿色"当前数据正常"状态
- 今日页统计卡片：重构为 4 张
  - 今日完成率（保留）
  - 昨日播放量（按 publishDate 汇总数据看板视频）
  - 昨日互动数（点赞+评论，按 publishDate 汇总）
  - 已发布内容（保留）
- 示例数据：调整 _seedVideos 的 createdAt，使其分为两个上传批次，以便演示对照效果`,
      impact: '今日页提醒与统计卡片重构',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.9.0',
      content: `v2.9更新。
- 爆款拆解：页面重构为两部分，历史拆解报告放在页面上部，上传视频录入由放在页面下部
- 爆款拆解：历史报告按创建时间倒序排列，新上传/新AI生成的报告在前，日期最旧的在后
- 宠物热点：系统提示词改为专注宠物与AI领域，要求输出真实数据
- AI热点：系统提示词改为专注AI领域，要求输出真实数据`,
      impact: '爆款拆解页面重构 + 热点提示词优化',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.8.0',
      content: `v2.8更新。
- 修复：弹窗背景透明问题，showModal 统一包裹 .modal 白底容器
- 全模块：生成示例数据填充各页面（数据看板/选题灵感/内容创作/爆款拆解/平台热点）
- 数据看板：8条视频示例数据，覆盖爆款/普通/低完播场景
- 选题灵感：4条选题 + 3条用户灵感 + 4条AI今日灵感
- 内容创作：5条内容（编辑中/已发布/草稿/创意）
- 爆款拆解：2条完整拆解报告（含Markdown渲染）
- 平台热点：5平台热搜 + AI热点 + 宠物热点示例缓存
- 数据看板：提供CSV上传表头范例文件`,
      impact: '弹窗修复 + 全模块示例数据 + CSV范例',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.7.0',
      content: `v2.7更新。
- 平台热点：重构为三栏结构（平台热搜 / 宠物热点 / AI热点）
- 平台热搜：平台调整为抖音、微博、小红书、B站、头条
- 宠物热点：接入 Deepseek，实时生成抖音/小红书/B站宠物类趋势卡片
- AI热点：接入 Deepseek，实时生成抖音/小红书/B站AI类趋势卡片，并整合原AI资讯内容
- 菜单：移除独立"AI资讯"入口，内容合并至平台热点-AI热点
- 今日看板：提醒&动态模块调整至问候卡片下方
- 今日看板：日历左侧、待办右侧并排展示，移除原日期待办区域
- 今日看板：待办面板增加日期下拉选择，点击日历或下拉均可切换日期
- 新增趋势卡片UI，参考趋势解读风格设计`,
      impact: '平台热点重构 + AI资讯合并 + 今日看板布局调整',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.6.0',
      content: `v2.6更新。
- 今日看板：日历缩小为紧凑尺寸，点击日期可查看该日期待办事项
- 待办弹窗：背景明确为白色，标题改为"增加待办"
- 待办弹窗：新增完成日期选择、开始/结束时间下拉选择
- 待办数据：支持 dueDate/startTime/endTime 字段
- 菜单栏：重新分组排序为 核心/创作/资讯/工具/系统
- 移动端底部导航：改为横版可滑动，当前页面按钮绿色高亮
- 爆款拆解：历史报告区增加"手动上传报告"入口
- 内容创作：列表改为卡片式网格展示
- 平台热点：热搜列表改为卡片式网格展示
- 爆款拆解：待分析/历史报告均改为卡片式展示`,
      impact: 'UI 统一优化 + 导航重构 + 待办/爆款拆解增强',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.5.0',
      content: `v2.5更新。
- 修复：所有模态框/浮层无法显示的严重 Bug（CSS 类名 .active 与 JS .show 不匹配）
- 修复：待办新增按钮、记录灵感按钮、新建内容按钮点击无响应（均为模态框 Bug 导致）
- 修复：Toast 提示组件可见性控制和定位
- 修复：搜索浮层、帮助浮层、FAB 浮层同样无法显示的问题
- 爆款拆解：从 Skill 复制粘贴工作流改为直接 AI 分析
- 爆款拆解：保存任务后自动调用 Deepseek API 生成拆解报告
- 爆款拆解：支持 Markdown 格式报告渲染（标题/列表/加粗等）
- 爆款拆解：新增"分析中"状态显示，加载动画`,
      impact: '全局模态框修复 + 爆款拆解模块改造',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.4.0',
      content: `v2.4更新。
- 今日看板：移除右上角"新建"按钮
- 今日看板：移除 AI资讯/平台热点/选题灵感/内容创作 四个快捷入口卡片
- 今日看板：新增日历组件，风格与整体 UI 一致
- 今日看板：问候卡中除日期外新增杭州天气温度显示
- 全页面：移除所有页面标题后的问号帮助按钮
- 爆款拆解：改为 Skill 工作流，支持上传视频本地路径、口播文案、平台、目标定位、投放数据
- 爆款拆解：新增"生成 Skill 分析指令"和"粘贴 Skill 报告"功能
- 通用表单：补充 form-group / form-input / form-select / form-textarea 等基础样式`,
      impact: '今日看板与爆款拆解模块改造',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.3.0',
      content: `v2.3更新。
- 重新整合选题灵感：原"选题工坊"更名为"选题灵感"，原"收集箱"整合为"用户灵感"
- 选题灵感下新增两个功能：今日灵感（AI生成）、用户灵感（手动记录）
- 今日灵感：AI结合抖音热点、今日AI资讯和用户灵感记录，输出选题名/开场/内容概要/结尾/关键词
- 右上角"新建选题"按钮改为记录用户灵感
- 移除左侧导航中的"收集箱"独立入口`,
      impact: '选题灵感模块重构',
      needAction: false,
    },
    {
      date: '2026-08-08',
      version: 'v2.2.0',
      content: 'v2.2更新。\n- 新增【数据看板】模块：记录每条抖音视频详细数据，支持手动录入、CSV批量上传、可视化图表、视频对比分析\n- 数据维度15个：播放量、点赞量、评论量、分享量、收藏量、完播率、2s跳出率、平均播放时长、5s完播率、平均播放占比、不感兴趣率、吸粉量、脱粉量、吸粉率、脱粉率\n- 支持AI周报生成：基于Deepseek分析近7天数据，输出趋势分析、问题诊断、优化建议\n- 今日页面布局优化：统计卡片与快捷入口位置互换\n- 顶部"新建"按钮改造为"新增今日待办"，并移动到待办事项小栏目\n- 浏览器缓存修复：CSS/JS资源添加版本号参数',
      impact: '新增数据看板模块，今日页面布局调整',
      needAction: false,
    },
    {
      date: '2026-08-07',
      version: 'v2.1.0',
      content: 'v2.1更新。\n- 爆款拆解升级：从零一数科付费API改为Deepseek AI驱动，不再需要额外付费Key\n- 爆款拆解新增：输入视频标题+文案即可AI分析，输出结构分段/爆款归因/六维评分/可借鉴策略\n- 爆款拆解支持抖音/小红书/视频号/B站/公众号/快手多平台\n- 移除零一数科API配置，所有AI功能统一由Deepseek驱动\n- 拆解报告支持结构化展示和历史记录回看',
      impact: '爆款拆解功能改进',
      needAction: false,
    },
    {
      date: '2026-08-07',
      version: 'v2.0.0',
      content: 'v2.0重大更新。\n- 新增AI资讯模块：自动获取每日AI行业资讯（来源：aihot.virxact.com）\n- 新增平台热点模块：实时获取抖音/微博/知乎/百度/头条/B站热搜（来源：60s.viki.moe）\n- 新增选题工坊模块：AI辅助选题生成，含评分和差异化角度\n- 新增爆款拆解模块：视频号视频拆解分析\n- AI帮手接入Deepseek大模型，支持真实AI对话\n- 内容创作支持AI写作辅助\n- 部署到CloudStudio云端，支持HTTPS长期访问',
      impact: '首次使用v2.0版本',
      needAction: true,
    },
  ],
};

if (typeof window !== 'undefined') {
  window.ModuleConfig = ModuleConfig;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleConfig;
}
