/**
 * API Integration Module
 * 个人AI工作空间 - 外部API调用层
 *
 * 集成三个外部API:
 *   1. Aihot API    - AI行业资讯
 *   2. 60s.viki.moe - 平台热搜/热榜
 *   3. Deepseek API - AI对话 + 一人MCN功能
 *
 * 特性:
 *   - CORS 回退 (直接请求 → corsproxy.io 代理)
 *   - localStorage 缓存 + TTL
 *   - 统一的结构化错误返回
 *   - 零外部依赖
 */

const API = (() => {
  // =============================================================================
  // Configuration
  // =============================================================================

  const CONFIG = {
    // CORS proxy（直接请求失败时的回退方案）
    corsProxy: "https://corsproxy.io/?url=",

    // Aihot API
    aihot: {
      baseUrl: "https://aihot.virxact.com",
      endpoint: "/api/public/items",
      cacheKey: "xl_ai_news_cache",
      cacheTTL: 60 * 60 * 1000, // 1 小时
    },

    // 热搜 API
    hotTopics: {
      baseUrl: "https://60s.viki.moe/v2",
      platforms: ["douyin", "weibo", "xiaohongshu", "bili", "toutiao"],
      cachePrefix: "xl_hot_topics_cache",
      cacheTTL: 30 * 60 * 1000, // 30 分钟
    },

    // AI 生成热点
    aiHotTopics: {
      cachePrefix: "xl_ai_hot_topics_cache",
      cacheTTL: 30 * 60 * 1000, // 30 分钟
    },

    // 真实 AI 每日热点（聚合抓取，非 AI 生成趋势）
    realAIHot: {
      cacheKey: "xl_ai_real_hot_cache",
      cacheTTL: 30 * 60 * 1000, // 30 分钟
      githubUrl: "https://api.github.com/search/repositories",
      hnUrl: "https://hn.algolia.com/api/v1/search",
    },

    // Deepseek API
    deepseek: {
      defaultUrl: "https://api.deepseek.com/v1",
      chatEndpoint: "/chat/completions",
      defaultModel: "deepseek-chat",
      settingsKey: "xl_deepseek_settings",
      chatTemp: 0.7,
      creativeTemp: 0.9,
    },
  };

  // =============================================================================
  // Utility Functions
  // =============================================================================

  /**
   * 格式化时间戳为中文相对时间
   * @param {number|string} timestamp - 时间戳(ms) 或 ISO 字符串
   * @returns {string} e.g. "2小时前", "今天上午09:48", "昨天下午14:30"
   */
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const ts = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();

    if (isNaN(ts)) return "时间未知";

    const diff = now - ts;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    // 1 分钟内
    if (diff < minute) return "刚刚";
    // 60 分钟内
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
    // 24 小时内
    if (diff < day) {
      const d = new Date(ts);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const period = d.getHours() < 12 ? "上午" : "下午";
      return `今天${period}${hours}:${minutes}`;
    }
    // 48 小时内
    if (diff < 2 * day) {
      const d = new Date(ts);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const period = d.getHours() < 12 ? "上午" : "下午";
      return `昨天${period}${hours}:${minutes}`;
    }
    // 超过 48 小时
    if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;

    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /**
   * 格式化热度数值为中文可读形式
   * @param {number} score
   * @returns {string} e.g. "123.4万", "5678", "1.2亿"
   */
  function formatHeatScore(score) {
    if (score == null || isNaN(score)) return "热度未知";
    const n = Number(score);
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
    return String(Math.floor(n));
  }

  // =============================================================================
  // CORS Fallback Fetch
  // =============================================================================

  /**
   * 带 CORS 回退的 fetch 封装
   *
   * 策略:
   *   1. 先尝试直接 fetch（适用于支持 CORS 或同源的情况）
   *   2. 如收到 network error（很可能是 CORS 拦截），通过 corsproxy.io 代理重试
   *   3. 代理也失败则返回 null
   *
   * @param {string} url - 请求地址
   * @param {object} [options={}] - fetch options
   * @returns {Promise<Response|null>} Response 对象或 null
   */
  async function fetchWithFallback(url, options = {}) {
    const mergedOptions = { ...options };

    // 直接请求
    try {
      const resp = await fetch(url, mergedOptions);
      if (resp.ok) return resp;
      // HTTP 错误 → 返回 response（调用方处理 status）
      return resp;
    } catch (directErr) {
      // 网络层错误（CORS / DNS / 超时等）
      const isNetworkErr =
        directErr instanceof TypeError &&
        (directErr.message === "Failed to fetch" ||
          /NetworkError|fetch/.test(String(directErr)));

      if (!isNetworkErr) {
        return null;
      }

      // 尝试 CORS 代理
      // 注意: 代理请求的 options 需要简化，避免触发预检 OPTIONS
      let proxyUrl = CONFIG.corsProxy + encodeURIComponent(url);

      // 如果是 GET 且无自定义 headers，直接用简单请求
      if (
        !options.method ||
        options.method === "GET"
      ) {
        try {
          const proxyResp = await fetch(proxyUrl);
          return proxyResp.ok ? proxyResp : null;
        } catch (_proxyErr) {
          return null;
        }
      }

      // POST 等复杂请求，尝试通过代理
      // 注意：corsproxy.io 对带 body 的请求支持有限
      try {
        const proxyOptions = {
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
          },
        };
        if (options.body) {
          proxyOptions.body =
            typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body);
        }
        const proxyResp = await fetch(proxyUrl, proxyOptions);
        return proxyResp.ok ? proxyResp : null;
      } catch (_proxyErr2) {
        return null;
      }
    }
  }

  // =============================================================================
  // Cache Helpers
  // =============================================================================

  /**
   * 从 localStorage 读取缓存
   * @param {string} key
   * @param {number} ttl - 有效期(ms)
   * @returns {object|null}
   */
  function getCache(key, ttl) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || !cached._ts) return null;
      if (Date.now() - cached._ts > ttl) {
        localStorage.removeItem(key);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }

  /**
   * 写入 localStorage 缓存
   * @param {string} key
   * @param {object} data
   */
  function setCache(key, data) {
    try {
      const toStore = { ...data, _ts: Date.now() };
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch {
      // 写入失败静默忽略 (QuotaExceeded)
    }
  }

  /**
   * 构建统一的错误返回对象
   */
  function makeError(code, status = null, message = "") {
    const err = { error: code };
    if (status !== null) err.status = status;
    if (message) err.message = message;
    return err;
  }

  // =============================================================================
  // 1. Aihot API — AI 新闻资讯
  // =============================================================================

  /**
   * 获取 AI 行业新闻
   *
   * @param {boolean} [force=false] - 强制刷新，忽略缓存
   * @returns {Promise<{items:Array, lastFetch:number, source:string}|{error:string}>}
   */
  async function fetchAINews(force = false) {
    // 1. 检查缓存
    if (!force) {
      const cached = getCache(CONFIG.aihot.cacheKey, CONFIG.aihot.cacheTTL);
      if (cached && Array.isArray(cached.items)) {
        return {
          items: cached.items,
          lastFetch: cached._ts,
          source: "cache",
        };
      }
    }

    // 2. 构造请求 URL
    const since = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
    const apiUrl = `${CONFIG.aihot.baseUrl}${CONFIG.aihot.endpoint}?mode=selected&since=${encodeURIComponent(since)}&take=50`;

    // 3. 发起请求
    const resp = await fetchWithFallback(apiUrl);

    if (!resp) {
      // 网络完全不通 → 尝试返回过期缓存作为降级
      const stale = getCache(CONFIG.aihot.cacheKey, Infinity);
      if (stale && Array.isArray(stale.items)) {
        return {
          items: stale.items,
          lastFetch: stale._ts,
          source: "cache-stale",
        };
      }
      return makeError("NETWORK_ERROR", null, "网络请求失败，无法获取新闻资讯");
    }

    if (!resp.ok) {
      return makeError("API_ERROR", resp.status, `服务器返回 ${resp.status}`);
    }

    // 4. 解析数据
    let json;
    try {
      json = await resp.json();
    } catch {
      return makeError("PARSE_ERROR", null, "响应数据格式错误");
    }

    // Aihot 返回结构: { data: [...] } 或数组本身
    const items = Array.isArray(json) ? json : Array.isArray(json?.data)
      ? json.data
      : [];

    // 5. 标准化字段 & 入缓存
    const normalized = items.map((item) => ({
      title: item.title || "",
      source: item.source || "",
      summary: item.summary || item.description || "",
      url: item.url || item.link || "",
      category: item.category || "",
      publishedAt: item.publishedAt || item.pubDate || item.date || "",
    }));

    const cacheData = { items: normalized };
    setCache(CONFIG.aihot.cacheKey, cacheData);

    return {
      items: normalized,
      lastFetch: Date.now(),
      source: "live",
    };
  }

  // =============================================================================
  // 2. 60s.viki.moe — 平台热搜 / 热榜
  // =============================================================================

  /**
   * 获取单个平台的热搜
   *
   * @param {string} platform - 平台标识: douyin|weibo|xiaohongshu|bili|toutiao
   * @param {boolean} [force=false] - 强制刷新
   * @returns {Promise<{items:Array, lastFetch:number, update_time:string}|{error:string}>}
   */
  /**
   * 通过 Deepseek 生成小红书热搜（60s API 暂无小红书接口）
   */
  async function fetchXiaohongshuHotTopics(force = false) {
    const cacheKey = `${CONFIG.hotTopics.cachePrefix}_xiaohongshu`;

    if (!force) {
      const cached = getCache(cacheKey, CONFIG.hotTopics.cacheTTL);
      if (cached && Array.isArray(cached.items)) {
        return {
          items: cached.items,
          lastFetch: cached._ts,
          update_time: "AI 生成",
          source: "cache",
        };
      }
    }

    const systemPrompt = `你是一位小红书内容运营专家。请生成当前小红书平台上 20 条热门搜索话题，格式为严格的 JSON 数组。

每个元素结构：
{
  "title": "话题标题（不带#号）",
  "heat": 1234567,
  "url": "https://www.xiaohongshu.com/search_result?keyword=URL编码后的关键词"
}

heat 为 50万-500万之间的整数。输出纯 JSON 数组，不要 markdown 代码块。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请生成当前小红书热门搜索话题榜。" },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) text = arrMatch[0];

      const items = JSON.parse(text);
      const normalized = (Array.isArray(items) ? items : []).map((item, idx) => ({
        title: item.title || "",
        url: item.url || `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(item.title || "")}`,
        heat: item.heat || 0,
        rank: idx + 1,
      }));

      const cacheData = { items: normalized, update_time: "AI 生成" };
      setCache(cacheKey, cacheData);

      return {
        items: normalized,
        lastFetch: Date.now(),
        update_time: "AI 生成",
        source: "live",
      };
    } catch {
      return makeError("PARSE_ERROR", null, "小红书热搜生成失败");
    }
  }

  async function fetchHotTopics(platform, force = false) {
    const platformKey = platform.toLowerCase();

    if (!CONFIG.hotTopics.platforms.includes(platformKey)) {
      return makeError(
        "INVALID_PLATFORM",
        null,
        `不支持的平台: ${platform}。支持: ${CONFIG.hotTopics.platforms.join(", ")}`,
      );
    }

    // 小红书无官方 API，使用 AI 生成
    if (platformKey === "xiaohongshu") {
      return fetchXiaohongshuHotTopics(force);
    }

    const cacheKey = `${CONFIG.hotTopics.cachePrefix}_${platformKey}`;

    // 1. 检查缓存
    if (!force) {
      const cached = getCache(cacheKey, CONFIG.hotTopics.cacheTTL);
      if (cached && Array.isArray(cached.items)) {
        return {
          items: cached.items,
          lastFetch: cached._ts,
          update_time: cached.update_time || "",
          source: "cache",
        };
      }
    }

    // 2. 路径映射
    const pathMap = {
      douyin: "/douyin",
      weibo: "/weibo",
      toutiao: "/toutiao",
      bili: "/bili",
    };

    const apiUrl = `${CONFIG.hotTopics.baseUrl}${pathMap[platformKey]}`;

    // 3. 请求
    const resp = await fetchWithFallback(apiUrl);

    if (!resp) {
      const stale = getCache(cacheKey, Infinity);
      if (stale && Array.isArray(stale.items)) {
        return {
          items: stale.items,
          lastFetch: stale._ts,
          update_time: stale.update_time || "",
          source: "cache-stale",
        };
      }
      return makeError("NETWORK_ERROR", null, `获取${platformKey}热搜失败`);
    }

    if (!resp.ok) {
      return makeError("API_ERROR", resp.status, `服务器返回 ${resp.status}`);
    }

    let json;
    try {
      json = await resp.json();
    } catch {
      return makeError("PARSE_ERROR", null, "响应数据格式错误");
    }

    // 返回结构: { data: [...], update_time: "2025-08-07 10:00:00" }
    const items = Array.isArray(json?.data) ? json.data : [];
    const updateTime = json?.update_time || "";

    const normalized = items.map((item, idx) => ({
      title: item.title || "",
      url: item.url || item.link || "",
      heat: item["热度"] || item.heat || item.hot_value || 0,
      rank: item.rank || idx + 1,
    }));

    const cacheData = { items: normalized, update_time: updateTime };
    setCache(cacheKey, cacheData);

    return {
      items: normalized,
      lastFetch: Date.now(),
      update_time: updateTime,
      source: "live",
    };
  }

  /**
   * 同时获取抖音和微博热搜（用户最常关注的平台）
   *
   * @param {boolean} [force=false]
   * @returns {Promise<{douyin:object, weibo:object}>}
   */
  async function fetchAllHotTopics(force = false) {
    const [douyin, weibo] = await Promise.allSettled([
      fetchHotTopics("douyin", force),
      fetchHotTopics("weibo", force),
    ]);

    return {
      douyin:
        douyin.status === "fulfilled"
          ? douyin.value
          : makeError("NETWORK_ERROR", null, "抖音数据获取失败"),
      weibo:
        weibo.status === "fulfilled"
          ? weibo.value
          : makeError("NETWORK_ERROR", null, "微博数据获取失败"),
    };
  }

  /**
   * 使用 Deepseek 生成垂直领域热点趋势（生活 / AI）
   *
   * @param {string} category - 'life' 生活热点 | 'ai' AI热点
   * @param {boolean} [force=false] - 强制刷新
   * @returns {Promise<{trends:Array, source:string}|{error:string}>}
   */
  async function fetchAIHotTopics(category, force = false) {
    const cacheKey = `${CONFIG.aiHotTopics.cachePrefix}_${category}`;

    if (!force) {
      const cached = getCache(cacheKey, CONFIG.aiHotTopics.cacheTTL);
      if (cached && Array.isArray(cached.trends)) {
        return { trends: cached.trends, source: "cache" };
      }
    }

    const isLife = category === "life";
    const fieldName = isLife ? "生活" : "AI";
    const platforms = ["抖音", "小红书", "B站"];

    const systemPrompt = isLife
      ? `你是一位资深的社媒趋势分析师，专注于生活与AI领域。
请基于当前${platforms.join("、")}平台的公开热门内容，生活领域生成 4-6 个热点趋势卡片。

每个趋势卡片需包含：
1. **title**：趋势主题标题（简短有力，10字以内）
2. **tag**：标签/口号（右侧彩色标签，8字以内）
3. **tagColor**：标签背景色，使用柔和的十六进制色值，如 #D4A5FF、#FFD66B、#A0E8AF、#FFB6C1
4. **summary**：一句话趋势解读（30字以内）
5. **stats**：该趋势下的关键数据/洞察，2-3个，每个包含 label（指标名）、value（数值）、desc（补充说明）
6. **topics**：3-5个相关热门话题/Hashtag，每个包含 hashtag（带#号）、heat（热度，如"393.9万"）、platform（抖音/小红书/B站）、period（如"2024年春季"）

请以严格 JSON 格式返回，结构如下：
{
  "trends": [
    {
      "title": "...",
      "tag": "...",
      "tagColor": "#...",
      "summary": "...",
      "stats": [{"label": "...", "value": "...", "desc": "..."}],
      "topics": [{"hashtag": "#...", "heat": "...", "platform": "...", "period": "..."}]
    }
  ]
}

输出纯 JSON，不要 markdown 代码块标记。数值不可合理估算，需为真实数据。`
      : `你是一位资深的社媒趋势分析师，专注于AI领域。
请基于当前${platforms.join("、")}平台的公开热门内容，AI生成 4-6 个热点趋势卡片。

每个趋势卡片需包含：
1. **title**：趋势主题标题（简短有力，10字以内）
2. **tag**：标签/口号（右侧彩色标签，8字以内）
3. **tagColor**：标签背景色，使用柔和的十六进制色值，如 #D4A5FF、#FFD66B、#A0E8AF、#FFB6C1
4. **summary**：一句话趋势解读（30字以内）
5. **stats**：该趋势下的关键数据/洞察，2-3个，每个包含 label（指标名）、value（数值）、desc（补充说明）
6. **topics**：3-5个相关热门话题/Hashtag，每个包含 hashtag（带#号）、heat（热度，如"393.9万"）、platform（抖音/小红书/B站）、period（如"2024年春季"）

请以严格 JSON 格式返回，结构如下：
{
  "trends": [
    {
      "title": "...",
      "tag": "...",
      "tagColor": "#...",
      "summary": "...",
      "stats": [{"label": "...", "value": "...", "desc": "..."}],
      "topics": [{"hashtag": "#...", "heat": "...", "platform": "...", "period": "..."}]
    }
  ]
}

输出纯 JSON，不要 markdown 代码块标记。数值不可合理估算，需为真实数据。`;

    const userMsg = `请生成当前${platforms.join("、")}平台上${fieldName}类的热门趋势卡片，要求信息丰富、数据具体、便于内容创作者参考。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];

      const parsed = JSON.parse(text);
      const trends = Array.isArray(parsed.trends) ? parsed.trends : [];

      // 数据校验与补全
      const validTrends = trends
        .filter((t) => t.title)
        .map((t) => ({
          title: t.title || "未命名趋势",
          tag: t.tag || "",
          tagColor: t.tagColor || "#D4A5FF",
          summary: t.summary || "",
          stats: Array.isArray(t.stats) ? t.stats : [],
          topics: Array.isArray(t.topics) ? t.topics : [],
        }));

      setCache(cacheKey, { trends: validTrends });
      return { trends: validTrends, source: "live" };
    } catch (err) {
      return makeError("PARSE_ERROR", null, "AI 热点解析失败");
    }
  }

  // =============================================================================
  // 2b. 真实 AI 每日热点 — 聚合抓取（GitHub / AI门户 / 社媒），非 AI 生成趋势
  // =============================================================================

  /**
   * 抓取真实 AI 每日热点：并行聚合 Aihot(AI门户) + GitHub Trending + Hacker News(社媒)
   * 去重、按时间倒序，截取 6-10 条
   *
   * @param {boolean} [force=false] - 强制刷新（忽略缓存）
   * @returns {Promise<{items:Array, source:string}|{error:string}>}
   *   items: [{ title, url, summary, source, category, publishedAt, metric }]
   */
  async function fetchRealAIHotNews(force = false) {
    const cacheKey = CONFIG.realAIHot.cacheKey;
    if (!force) {
      const cached = getCache(cacheKey, CONFIG.realAIHot.cacheTTL);
      if (cached && Array.isArray(cached.items) && cached.items.length) {
        return { items: cached.items, source: "cache" };
      }
    }

    // 真实行业源（GitHub / AI门户 / 社媒）与平台 AI 热点（抖音 / B站 / 小红书）并行抓取
    const [realSettled, platformItems] = await Promise.all([
      Promise.allSettled([
        fetchAihotRealItems(),
        fetchGitHubTrending(),
        fetchHackerNewsAI(),
      ]),
      fetchPlatformAIHotTopics(),
    ]);

    let realItems = [];
    realSettled.forEach((r) => {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        realItems = realItems.concat(r.value);
      }
    });

    const platItems = Array.isArray(platformItems) ? platformItems : [];

    // 去重（按 url 或 title 归一化）
    const seen = new Set();
    const all = realItems.concat(platItems).filter((it) => {
      const key = (it.url || it.title || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 按时间倒序，无时间字段（平台热点）排后面
    all.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() || 0 : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() || 0 : 0;
      return tb - ta;
    });

    // 保证平台 AI 热点（抖音/B站/小红书）一定出现：真实源条数 + 最多 6 条平台热点
    const cap = realItems.length + Math.min(platItems.length, 6);
    const items = all.slice(0, cap);

    if (items.length === 0) {
      return { items: [], source: "empty", error: "NO_DATA", message: "暂时未能抓取到真实热点，请稍后刷新重试" };
    }

    setCache(cacheKey, { items, _ts: Date.now() });
    return { items, source: "live" };
  }

  // 今日 AI 热点概要——由 Deepseek 汇总真实 AI 资讯（含 Agent/Skill/实用工具），输出概要报告
  async function generateAIHotSummary(items, force = false) {
    if (!force) {
      const cached = Store.getAIHotSummary();
      if (cached) return { data: cached, source: "cache" };
    }

    const settings = Store.getSettings();
    if (!settings.deepseekApiKey) {
      return { error: "NO_KEY", message: "请先在设置中配置 Deepseek API Key 以生成今日 AI 热点概要" };
    }

    const newsText = (items || []).slice(0, 12).map((n, i) =>
      `${i + 1}. [${n.source || "资讯"}] ${n.title}${n.summary ? "：" + n.summary.slice(0, 100) : ""}`,
    ).join("\n");

    const systemPrompt = `你是一位 AI 行业资讯分析师，擅长把零散的 AI 热点资讯汇总成一份清晰的"今日 AI 热点概要"报告，重点覆盖：AI 整体动态、AI Agent / Skill（智能体 / 技能）相关进展、以及实用的 AI 工具 / 效率工具。

要求：
- 输出纯 JSON，不要包含 markdown 代码块标记。
- 语言口语化、面向短视频创作者（普通人视角），信息密度高、不啰嗦。
- 字段（均为字符串或字符串数组）：
  "summary"（string）：今日 AI 热点总体概述，2-3 句
  "highlights"（array of string）：今日最值得关注的 AI 热点要点，3-5 条，每条一句话
  "agents"（array of string）：与 AI Agent / Skill / 智能体相关的动态，或值得做的选题角度，2-4 条
  "tools"（array of string）：实用的 AI 工具 / 效率工具推荐或动向，2-4 条
  "insight"（string）：给普通创作者（抖音 / 小红书）的选题启发，1-2 句`;

    const userMsg = `以下是从 GitHub、AI 门户、Hacker News、抖音、B站、小红书抓取的今日真实 AI 热点资讯：\n\n${newsText}\n\n请基于以上真实资讯，输出今日 AI 热点概要报告（重点覆盖 AI 动态、Agent/Skill、实用工具）。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      { temperature: 0.4 },
    );

    if (result.error) return result;

    try {
      let text = (result.content || "").trim();
      const md = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (md) text = md[1].trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];
      const data = JSON.parse(text);
      Store.saveAIHotSummary(data);
      return { data, source: "live" };
    } catch {
      return { error: "PARSE_ERROR", message: "概要生成结果解析失败，请刷新重试" };
    }
  }

  // 平台 AI 热点关键词（用于从平台热搜中筛选 AI 相关内容）
  const AI_TOPIC_KEYWORDS = [
    "AI", "人工智能", "大模型", "DeepSeek", "deepseek", "Deepseek", "GPT", "ChatGPT",
    "Claude", "豆包", "文心", "通义", "千问", "即梦", "可灵", "Sora", "Stable Diffusion",
    "Midjourney", "AI绘画", "AI写作", "智能体", "Agent", "机器人", "算力", "纳米AI",
    "秘塔", "Kimi", "智谱", "GLM", "Perplexity", "Runway", "AI视频", "文生视频",
    "图生视频", "AI配音", "数字人", "AI换脸", "开源大模型", "具身智能", "自动驾驶",
    "Copilot", "Gemini", "Llama", "Qwen", "混元", "元宝", "Suno", "闪剪", "剪映",
    "AI音乐", "AI助理", "AI工具", "提示词", "Prompt", "工作流", "AI助手", "生成式", "AIGC",
    "Codex", "codex", "gpt", "WorkBuddy", "workbuddy", "Skill", "skill", "提示词工程", "AI Agent",
  ];

  function formatHeatLocal(h) {
    if (!h) return "";
    const n = typeof h === "string" ? parseInt(h, 10) : h;
    if (isNaN(n)) return String(h);
    if (n >= 100000000) return (n / 100000000).toFixed(1) + "亿";
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    return String(n);
  }

  // 子源 4：平台 AI 热点——基于抖音/B站/小红书真实热搜，由 AI 标注 AI 角度，保证抖音必有
  async function fetchPlatformAIHotTopics() {
    const targets = [
      { key: "douyin", label: "抖音", required: true },
      { key: "bili", label: "B站" },
      { key: "xiaohongshu", label: "小红书" },
    ];

    const settled = await Promise.allSettled(targets.map((t) => fetchHotTopics(t.key, false)));
    const realLists = {};
    settled.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value && !r.value.error) {
        realLists[targets[i].key] = {
          label: targets[i].label,
          items: (r.value.items || []).slice(0, 25)
            .map((it) => ({
              title: it.title || "",
              heat: formatHeatLocal(it.heat || it["热度"] || 0),
            }))
            .filter((it) => it.title),
        };
      }
    });

    // 抖音真实热搜是必选项；拿不到则平台热点整体缺失
    if (!realLists.douyin || realLists.douyin.items.length === 0) {
      return [];
    }

    const listText = Object.entries(realLists)
      .map(
        ([, v]) =>
          `【${v.label}】\n` +
          v.items.map((it, idx) => `${idx + 1}. ${it.title}${it.heat ? `（热度 ${it.heat}）` : ""}`).join("\n"),
      )
      .join("\n\n");

    const prompt = `以下是抖音、B站、小红书平台今天的【真实热搜榜单】（已含热度，绝对真实，不要编造）：

${listText}

请从中筛选与 AI / 人工智能 / 大模型 / AI工具 / AI内容创作 相关的热点；尤其注意：标题中包含以下任一词的，也应视为 AI 相关（含大小写变体）：Codex、codex、GPT、gpt、ChatGPT、WorkBuddy、workbuddy、Skill、skill、AI Agent、智能体、提示词工程、Copilot。同时为每条写一句「AI角度解读」（20字内，说明它和 AI 有什么关系或能做什么）。
硬性要求：
- 抖音至少返回 1 条。若当天抖音热搜几乎没有强 AI 内容，也请挑 1 条最贴近「科技/工具/效率/数字生活」的，并如实把它标记为「平台趋势」(isAI=false)；其余 AI 相关内容标 isAI=true。
- B站、小红书同理，能筛到 AI 相关就返回，筛不到可不返回。
- 每条返回字段：platform（抖音/B站/小红书）、title（真实热搜原标题，原样）、heat（真实热度，无则空字符串）、summary（AI角度解读或趋势说明）、isAI（true/false）。
以严格 JSON 数组返回，例如：
[{"platform":"抖音","title":"...","heat":"1234万","summary":"...","isAI":true}]`;

    try {
      const r = await aiChat(
        [
          {
            role: "system",
            content: "你是社媒热点分析师，只基于给定的真实热搜数据作答，严禁编造标题或热度。",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.3 },
      );
      if (r.error) return buildFallbackPlatformItems(realLists);
      let text = (r.content || "").trim();
      const md = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (md) text = md[1].trim();
      const arr = JSON.parse(text);
      if (!Array.isArray(arr) || arr.length === 0) return buildFallbackPlatformItems(realLists);
      return arr
        .filter((x) => x && x.title)
        .map((x) => {
          const key = x.platform === "B站" ? "bili" : x.platform === "小红书" ? "xiaohongshu" : "douyin";
          return {
            title: x.title,
            url: "",
            summary: x.summary || "",
            source: x.platform || "抖音",
            platform: key,
            category: x.isAI ? "platform-ai" : "platform-trend",
            publishedAt: null,
            metric: x.heat || "",
            tag: x.isAI ? "AI热点" : "平台趋势",
          };
        });
    } catch {
      return buildFallbackPlatformItems(realLists);
    }
  }

  // AI 调用失败时的兜底：直接用真实抖音热搜 TOP3，标记为平台趋势，保证抖音出现
  function buildFallbackPlatformItems(realLists) {
    return (realLists.douyin?.items || []).slice(0, 3).map((it) => ({
      title: it.title,
      url: "",
      summary: "抖音实时热搜（AI 角度待刷新）",
      source: "抖音",
      platform: "douyin",
      category: "platform-trend",
      publishedAt: null,
      metric: it.heat || "",
      tag: "平台趋势",
    }));
  }

  // feigua 公开行业文章（真实可抓，用于竞品刷新的真实信号）
  async function fetchFeiguaArticles() {
    try {
      const resp = await fetchWithFallback("https://dy.feigua.cn/Article2/");
      if (!resp || !resp.ok) return [];
      const html = await resp.text();
      const titles = [];
      const re = /Detail\?id=\d+[^>]*>\s*<img[^>]*>\s*<p>([^<]{4,60})<\/p>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const t = m[1].replace(/\s+/g, " ").trim();
        if (t && !titles.includes(t)) titles.push(t);
      }
      return titles.slice(0, 15);
    } catch {
      return [];
    }
  }

  // 子源 1：Aihot 真实 AI 资讯（AI 门户）
  async function fetchAihotRealItems() {
    try {
      const r = await fetchAINews(false);
      if (r.error || !Array.isArray(r.items)) return [];
      return r.items.map((it) => ({
        title: it.title || "",
        url: it.url || it.sourceUrl || "",
        summary: it.summary || it.description || "",
        source: it.source || "AI资讯",
        category: it.category || "industry",
        publishedAt: it.publishedAt || it.createdAt || null,
      }));
    } catch {
      return [];
    }
  }

  // 子源 2：GitHub 每日热门仓库（真实代码热榜）
  async function fetchGitHubTrending() {
    try {
      const sinceDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const url = `${CONFIG.realAIHot.githubUrl}?q=created:>${sinceDate}&sort=stars&order=desc&per_page=8`;
      const resp = await fetchWithFallback(url);
      if (!resp || !resp.ok) return [];
      const json = await resp.json();
      const arr = Array.isArray(json.items) ? json.items : [];
      return arr.map((r) => ({
        title: r.full_name || r.name || "",
        url: r.html_url || "",
        summary: r.description || "",
        source: "GitHub",
        category: "github",
        publishedAt: r.created_at || null,
        metric: r.stargazers_count != null ? `${r.stargazers_count} ★` : "",
      }));
    } catch {
      return [];
    }
  }

  // 子源 3：Hacker News AI 相关（社媒/科技真实讨论）
  async function fetchHackerNewsAI() {
    try {
      const url = `${CONFIG.realAIHot.hnUrl}?query=AI&tags=story&hitsPerPage=10`;
      const resp = await fetchWithFallback(url);
      if (!resp || !resp.ok) return [];
      const json = await resp.json();
      const hits = Array.isArray(json.hits) ? json.hits : [];
      return hits
        .filter((h) => h && h.title)
        .map((h) => ({
          title: h.title,
          url: h.url || (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : ""),
          summary: h.story_text ? String(h.story_text).replace(/<[^>]+>/g, "").slice(0, 140) : "",
          source: "Hacker News",
          category: "social",
          publishedAt: h.created_at || null,
          metric: h.points != null ? `${h.points} 分` : "",
        }));
    } catch {
      return [];
    }
  }

  /**
   * 为竞品博主推断最新选题方向（基于当前平台热点，非真实抓取）
   *
   * @param {Array<{name:string, style:string}>} bloggers
   * @param {string} hotText - 当前平台热点文本
   * @returns {Promise<{topics:Object, usage:object}|{error:string}>}
   */
  async function generateCompetitorTopics(bloggers, realSignal) {
    const bloggersText = (bloggers || []).map(b => `- ${b.name}：${b.style || ''}`).join('\n');

    const systemPrompt = `你是竞品监测助手，擅长基于当前真实平台热点与行业动态，为不同风格的 AI 科普博主推断他们最可能产出的"最新选题方向"。
要求：
- 为每位博主生成 3-5 个最新选题方向，必须贴合该博主的内容风格
- 选题要结合当前真实热点/行业动态，但允许重复同类内容，只需侧重点或切入角度不同即可
- 每个选题是一句简短的选题名（15字以内），口语化、像抖音标题
以纯 JSON 返回，key 为博主名，value 为选题名字符串数组：
{ "xuan酱": ["选题1","选题2","选题3"], "不一书": ["..."] }`;

    const userMsg = `以下是需要推断最新选题方向的博主及其风格：
${bloggersText}

【真实信号·飞瓜公开行业文章（AI/营销趋势）】
${(realSignal && realSignal.feiguaArticles && realSignal.feiguaArticles.length) ? realSignal.feiguaArticles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '（无）'}

【真实信号·抖音/B站/小红书 AI 相关热搜】
${(realSignal && realSignal.platformHot && realSignal.platformHot.length) ? realSignal.platformHot.map((t, i) => `${i + 1}. ${t}`).join('\n') : '（无）'}

请基于以上真实信号，为每位博主生成最新选题方向。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];
      const topics = JSON.parse(text);
      return { topics: topics && typeof topics === "object" ? topics : {}, usage: result.usage };
    } catch {
      return { topics: {}, error: "PARSE_ERROR", message: "AI 返回格式异常，请重试" };
    }
  }

  // =============================================================================
  // 3. Deepseek API — AI 对话 + 一人MCN 功能
  // =============================================================================

  /**
   * 从 localStorage 读取 Deepseek 配置
   * @returns {{apiKey:string, apiUrl:string, model:string}}
   */
  function getDeepseekSettings() {
    try {
      // 优先从 Store 的设置中读取（设置页统一保存到 xl_settings）
      if (typeof Store !== "undefined" && Store.getSettings) {
        const storeSettings = Store.getSettings();
        if (storeSettings.deepseekApiKey) {
          return {
            apiKey: storeSettings.deepseekApiKey,
            apiUrl: storeSettings.deepseekApiUrl || CONFIG.deepseek.defaultUrl,
            model: storeSettings.deepseekModel || CONFIG.deepseek.defaultModel,
          };
        }
      }

      // 兼容旧方案：从独立的 xl_deepseek_settings 读取
      const raw = localStorage.getItem(CONFIG.deepseek.settingsKey);
      const settings = raw ? JSON.parse(raw) : {};
      return {
        apiKey: settings.apiKey || "",
        apiUrl: settings.apiUrl || CONFIG.deepseek.defaultUrl,
        model: settings.model || CONFIG.deepseek.defaultModel,
      };
    } catch {
      return {
        apiKey: "",
        apiUrl: CONFIG.deepseek.defaultUrl,
        model: CONFIG.deepseek.defaultModel,
      };
    }
  }

  /**
   * 调用 Deepseek Chat Completions API
   *
   * @param {Array} messages - [{role, content}]
   * @param {object} [options]
   * @param {number} [options.temperature]
   * @param {boolean} [options.stream=false]
   * @param {Function} [options.onChunk] - 流式回调 (chunkText: string) => void
   * @returns {Promise<{content:string, usage:object}|{error:string}>}
   */
  async function aiChat(messages, options = {}) {
    const { temperature, stream = false, onChunk } = options;
    const settings = getDeepseekSettings();

    if (!settings.apiKey) {
      return makeError("NO_API_KEY", null, "请先在设置中配置 Deepseek API Key");
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return makeError("INVALID_PARAMS", null, "messages 不能为空");
    }

    const body = {
      model: settings.model,
      messages: messages,
      stream: stream,
    };
    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    const fetchOptions = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    };

    // ===== 流式模式 =====
    if (stream && onChunk) {
      // 流式请求不走 CORS proxy（proxy 通常不支持 SSE）
      try {
        const resp = await fetch(
          `${settings.apiUrl}${CONFIG.deepseek.chatEndpoint}`,
          fetchOptions,
        );

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          let errMsg = `API 返回 ${resp.status}`;
          if (resp.status === 401) errMsg = "API Key 无效";
          if (resp.status === 402) errMsg = "账户余额不足";
          if (resp.status === 429) errMsg = "请求频率过高，请稍后重试";
          if (errText) {
            try {
              const ej = JSON.parse(errText);
              if (ej.error?.message) errMsg = ej.error.message;
            } catch { /* ignore */ }
          }
          return makeError("API_ERROR", resp.status, errMsg);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n").filter((l) => l.trim());

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            if (data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                onChunk(fullContent); // 累积内容回调
              }
            } catch {
              // 跳过解析失败的行
            }
          }
        }

        return { content: fullContent, usage: null };
      } catch (err) {
        if (err instanceof TypeError && err.message === "Failed to fetch") {
          return makeError("NETWORK_ERROR", null, "无法连接 Deepseek API，请检查网络或 API 地址");
        }
        return makeError("NETWORK_ERROR", null, err.message || "请求异常");
      }
    }

    // ===== 非流式模式 =====
    const resp = await fetchWithFallback(
      `${settings.apiUrl}${CONFIG.deepseek.chatEndpoint}`,
      fetchOptions,
    );

    if (!resp) {
      return makeError("NETWORK_ERROR", null, "无法连接 Deepseek API，请检查网络或 API 地址");
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      let errMsg = `API 返回 ${resp.status}`;
      if (resp.status === 401) errMsg = "API Key 无效，请在设置中检查";
      if (resp.status === 402) errMsg = "账户余额不足，请充值";
      if (resp.status === 429) errMsg = "请求频率过高，请稍后重试";
      if (resp.status === 500) errMsg = "服务器内部错误，请稍后重试";
      if (errText) {
        try {
          const ej = JSON.parse(errText);
          if (ej.error?.message) errMsg = ej.error.message;
        } catch { /* ignore */ }
      }
      return makeError("API_ERROR", resp.status, errMsg);
    }

    let json;
    try {
      json = await resp.json();
    } catch {
      return makeError("PARSE_ERROR", null, "AI 响应格式错误");
    }

    const content = json.choices?.[0]?.message?.content || "";
    const usage = json.usage || null;

    return { content, usage };
  }

  // =============================================================================
  // 3a. MCN 功能 — 选题策划
  // =============================================================================

  /**
   * 生成选题建议
   *
   * @param {string} field - 垂直领域 e.g. "AI技术", "职场", "科技"
   * @param {string} platform - 平台 e.g. "小红书", "抖音", "视频号"
   * @param {number} [count=5] - 选题数量
   * @returns {Promise<{topics:Array}|{error:string}>}
   */
  async function generateTopics(field, platform, count = 5) {
    const systemPrompt = `你是一位资深的${platform}内容运营专家，专注于${field}领域。
请根据当前热门趋势，生成${count}个有爆发潜力的选题。

对每个选题提供：
1. **选题标题**：吸引人的标题
2. **选题说明**：为什么这个选题有潜力（2-3句话）
3. **引爆点评分**：1-10分
4. **差异化角度**：与同类选题不同的切入角度
5. **受众人群**：核心目标受众画像
6. **竞品参考**：类似的竞品选题及改进方向

请以严格的 JSON 数组格式返回，每个元素的结构为：
{
  "title": "选题标题",
  "description": "选题说明",
  "score": 8,
  "angles": ["角度1", "角度2"],
  "audience": "受众描述",
  "competitor": "竞品参考"
}

输出纯 JSON 数组，不包含 markdown 代码块标记。`;

    const userMsg = `请为${platform}平台，在"${field}"领域，生成${count}个选题建议。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    // 解析返回的 JSON
    try {
      // 尝试提取 JSON 数组（处理可能的 markdown 包裹）
      let text = result.content.trim();
      // 移除可能的 ```json ... ``` 包裹
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      // 查找 JSON 数组
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) text = arrMatch[0];

      const topics = JSON.parse(text);
      return { topics: Array.isArray(topics) ? topics : [], usage: result.usage };
    } catch {
      return {
        topics: [],
        raw: result.content,
        usage: result.usage,
        error: "PARSE_ERROR",
        message: "AI 返回的选题格式异常，请重试",
      };
    }
  }

  // =============================================================================
  // 3a2. 今日灵感 — 结合热点 + AI资讯 + 用户灵感
  // =============================================================================

  /**
   * 根据抖音热点、AI资讯和用户灵感生成今日选题灵感
   *
   * @param {Array} userInspirations - 用户灵感记录 [{title, text, desc, tags}]
   * @param {Array} hotTopics - 抖音热搜 [{title, heat}]
   * @param {Array} aiNews - AI资讯 [{title, summary, category}]
   * @param {number} [count=4] - 生成数量
   * @returns {Promise<{topics:Array}|{error:string}>}
   */
  async function generateTodayInspiration(userInspirations = [], hotTopics = [], aiNews = [], aiHotTopics = [], competitorRef = {}, count = 4) {
    const inspirationText = userInspirations.length > 0
      ? userInspirations.map((i, idx) => `${idx + 1}. ${i.title || ''}${i.text ? '：' + i.text : ''}${i.desc ? '（' + i.desc + '）' : ''}`).join('\n')
      : '（暂无用户灵感记录）';

    const hotText = hotTopics.length > 0
      ? hotTopics.slice(0, 15).map((h, idx) => `${idx + 1}. ${h.title}${h.heat ? ' [热度' + h.heat + ']' : ''}`).join('\n')
      : '（未获取到热点数据）';

    const newsText = aiNews.length > 0
      ? aiNews.slice(0, 10).map((n, idx) => `${idx + 1}. ${n.title}${n.summary ? '：' + n.summary.slice(0, 80) : ''}`).join('\n')
      : '（未获取到AI资讯）';

    const aiHotText = aiHotTopics.length > 0
      ? aiHotTopics.slice(0, 10).map((n, idx) => `${idx + 1}. [${n.source || 'AI'}] ${n.title}${n.summary ? '：' + n.summary.slice(0, 80) : ''}`).join('\n')
      : '（未获取到AI热点）';

    let competitorText = '（暂无竞品参考数据，可在「平台热点 - 竞品参考」中刷新生成最新方向，或粘贴真实历史选题）';
    if (competitorRef && (competitorRef.latest || competitorRef.real)) {
      const latestMap = competitorRef.latest || {};
      const realMap = competitorRef.real || {};
      const names = [...new Set([...Object.keys(latestMap), ...Object.keys(realMap)])];
      if (names.length) {
        competitorText = names.map((name) => {
          const latest = latestMap[name] || [];
          const real = realMap[name] || [];
          let block = `- ${name}`;
          if (real.length) block += `\n    真实历史选题：${real.join('；')}`;
          if (latest.length) block += `\n    最新选题方向：${latest.join('；')}`;
          return block;
        }).join('\n');
      }
    }

    const systemPrompt = `你是一位面向普通人的 AI 应用科普选题专家，擅长将平台热点、AI行业动态、竞品博主选题风格和创作者个人灵感结合，输出可直接拍摄的短视频选题。

必须结合平台热点、AI热点、竞品参考与用户灵感来产出选题。参考来源要求（务必综合参考，不可只依赖单一来源）：
- 平台热点（抖音热搜）：捕捉当下大众注意力；
- AI热点（抖音/B站/小红书等平台真实的 AI 相关热门内容）：优先从中提炼普通人能上手的选题；
- 竞品参考（竞品博主的真实历史选题与最新选题方向）：直接借鉴其中可复用的选题角度与平台打法；
- 用户灵感记录：尊重创作者自身积累的方向与素材。

优先选择普通人0编程基础的ai易用性、普通人如何把ai应用在日常工作处理和生活的角度、输出3-4个选题。
每个选题需有明确的抖音平台适配性（节奏快、前3秒抓人、可引发互动）。
输出字段：title（选题名）、opening（开场钩子）、summary（内容概要）、ending（结尾）、keywords（关键词）

【竞品博主参考风格】
以下抖音博主均以"教学 + AI Agent / Skill 实用知识科普"见长，选题风格可作参考（不涉及具体抄袭，仅借鉴选题角度与表达方式）：
- xuan酱：偏实操演示、手把手教学，选题小而具体
- 不一书：偏体系化知识梳理，适合把复杂概念讲明白
- 西门聪明蛋XD：偏轻松幽默的科普口吻，把工具讲得像段子
- 老陈是小凳：偏场景化应用，从真实工作/生活痛点切入
- 不喝九：偏"搭建个人工作台/效率工具"的实用分享
请参考以上博主的选题角度（教学向、实用向、普通人0门槛），产出只需略有新意即可；允许重复同样类型的内容，只要侧重点或切入角度不同即可。

输出为纯 JSON 数组，每个元素格式如下：
{
  "title": "选题名",
  "opening": "开场钩子",
  "summary": "内容概要",
  "ending": "结尾",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

输出纯 JSON 数组，不要包含 markdown 代码块标记、解释文字或多余内容。`;

    const userMsg = `请结合以下信息，生成 ${count} 个今日选题灵感。优先从普通人0编程基础的AI易用性、普通人如何把AI应用在日常工作处理和生活的角度出发。

【竞品博主参考风格】（抖音，做教学 + AI Agent / Skill 实用知识科普的博主，供你借鉴选题角度）
- xuan酱、不一书、西门聪明蛋XD、老陈是小凳、不喝九

【当前抖音热点 TOP15】
${hotText}

【今日 AI 资讯 TOP10】
${newsText}

【AI热点（平台真实 AI 热门内容）】
${aiHotText}

【竞品参考（真实历史选题 + 最新选题方向）】
${competitorText}

【用户灵感记录】
${inspirationText}

请综合参考以上 AI热点、竞品参考、用户灵感与平台热点，生成贴合真实爆款角度的今日选题。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) text = arrMatch[0];

      const topics = JSON.parse(text);
      return { topics: Array.isArray(topics) ? topics : [], usage: result.usage };
    } catch {
      return {
        topics: [],
        raw: result.content,
        usage: result.usage,
        error: "PARSE_ERROR",
        message: "AI 返回的灵感格式异常，请重试",
      };
    }
  }

  // =============================================================================
  // 3b. MCN 功能 — 内容写作
  // =============================================================================

  /**
   * 根据结构化信息生成平台爆款内容脚本
   *
   * 仿照「零一数科·视频号爆款文案生成（体验版）」技能的生成逻辑与格式：
   * 5 字段信息收集 → 脚本类型选型 → 结构化生成(Hook/中段/CTA，每段含 visual+dialogue) → 合规质检 → 结构化 JSON 输出
   *
   * @param {Object} params
   * @param {string} params.topic - 选题标题/描述（必填）
   * @param {string} params.platform - 目标平台（小红书/抖音/视频号/公众号/知乎/B站）
   * @param {string} params.purpose - 创作目的（带货/种草/涨粉/品牌曝光/引流/内容种草）
   * @param {string} params.industry - 行业/领域（必填）
   * @param {string} params.audience - 目标受众（必填）
   * @param {string} [params.product] - 产品名+卖点（可选）
   * @returns {Promise<{title:string, structure:Object, fullText:string, content:string, tags:string[], script_type:string, duration_sec:number}|{error:string}>}
   */
  async function generateContent({ topic, platform, purpose, industry, audience, product }) {
    // 平台内容规格
    const specs = {
      "小红书": "图文笔记，300-800字，分段落，使用 emoji 增强可读性，末尾加 3-5 个话题标签；visual 字段写「配图与排版建议」，dialogue 字段写「该模块正文文案」",
      "抖音": "200-400字口播脚本，口语化，节奏快，前3秒抓人，有引导互动",
      "视频号": "400-600字口播脚本，温和叙事风格，适合中青年，有知识增量",
      "公众号": "图文长文，1000-2000字，结构清晰（引言-正文-总结），有深度；visual 写「配图与排版建议」，dialogue 写「该模块正文文案」",
      "知乎": "图文回答，800-1500字，论证充分，有数据/案例支撑，专业性强；visual 写「配图与排版建议」，dialogue 写「该模块正文文案」",
      "B站": "视频脚本格式，300-600字，活泼有趣，适合年轻人口味",
    };

    const spec = specs[platform] || specs["小红书"];

    const systemPrompt = `你是一位专业的短视频与图文内容脚本创作专家，尤其擅长面向普通人的 AI 应用科普内容。请严格遵循「零一数科·视频号爆款文案生成」的生成逻辑与格式来产出内容。

【Step 1 · 信息确认】
已收集信息：
- 创作目的：${purpose || "（未指定，请按种草/涨粉型合理拟定）"}
- 行业/领域：${industry || "（未指定）"}
- 目标受众：${audience || "（未指定）"}
- 选题：${topic}
- 产品/卖点：${product || "（无，纯种草/涨粉型）"}
- 发布平台：${platform}
- 平台格式要求：${spec}

【Step 2 · 脚本类型选型】
依据创作目的与选题，从 6 类中选择最贴合的一种，给出 script_type（英文枚举）：
- pain_point 痛点解决型（解决明确痛点/功能性）
- scene 场景植入型（日常高频/生活化）
- drama 剧情种草型（情感/关系共鸣）
- testimonial 口播种草型（需专家背书/教育市场）
- unboxing 开箱测评型（新品/效果可量化）
- tutorial 教程/制作型（教程/制作/对比）

【Step 3 · 结构化生成】
按「Hook段 → 中段（若干）→ CTA段」结构生成：
- Hook段：3 秒内抓住注意力（痛点提问/反常识/冲突/共鸣等）。
- 中段：按所选脚本类型组织，痛点型/场景型等 ≤5 段，教程型 ≤7 段；每段 section 命名实际功能（如「痛点放大」「产品出场」「效果展示」），禁止写「中段1/中段2」占位符。
- CTA段：自然的转化引导（关注/收藏/购买/点赞等）。
每一段必须分别给出 visual（画面/配图/排版建议）与 dialogue（台词/正文文案），两字段不得合并；时间轴用秒且自洽连续（hook.start_time="0"，各段首尾相接，cta.end_time=duration_sec）。
图文平台（小红书/公众号/知乎）：visual 写「配图与排版建议」，dialogue 写「该模块正文文案」，时间轴可保留示意或省略。

【Step 4 · 合规质检】
- 极限词（最/第一/绝对/100%/封神/绝了/OMG 等）自动替换；
- 医疗或未经证实的功效宣称改写或删除；
- 口语化自然度：短句 ≤15 字，用「...」标停顿，无书面连接词（此外/因此/综上），无广告腔。

【输出格式】
以纯 JSON 返回（不要包含 markdown 代码块标记）：
{
  "title": "脚本标题，≤15字、无标点",
  "duration_sec": 120,
  "script_type": "pain_point",
  "campaign_types": ["short_video_seeding"],
  "structure": {
    "hook": { "index":1, "section":"Hook段", "time_range":"0-43s", "start_time":"0", "end_time":"43", "function":"抓注意力", "type":"痛点提问", "visual":"...", "dialogue":"...", "note":"设计意图" },
    "body": { "segments": [ { "index":2, "section":"痛点放大", "time_range":"43-90s", "start_time":"43", "end_time":"90", "function":"痛点放大", "type":"—", "visual":"...", "dialogue":"...", "info_density":"high", "visual_switch":"固定机位单人镜头", "note":"..." } ] },
    "cta": { "index":99, "section":"CTA段", "time_range":"120-138s", "start_time":"120", "end_time":"138", "function":"转化引导", "type":"关注", "visual":"...", "dialogue":"...", "note":"自然度评价" },
    "rhythm": { "info_switch_interval":"30-45s", "emotion_curve":"担忧→安心", "energy_level":"medium" },
    "structure_summary": "一句话串联各段功能",
    "rhythm_evidence": "节奏证据",
    "product_conversion": null,
    "tags": ["标签1","标签2"]
  },
  "fullText": "将各段 dialogue 依次拼接的口播/正文全文，便于一键复制"
}

脚本必须基于真实信息、有爆款逻辑，禁止产出平庸内容。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请基于以上信息，生成一条具备爆款潜质的内容脚本（${platform}）。` },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];

      const data = JSON.parse(text);
      const structure = data.structure || null;
      const fullText = data.fullText || (structure ? [structure.hook?.dialogue, ...(structure.body?.segments || []).map(s => s.dialogue), structure.cta?.dialogue].filter(Boolean).join("\n\n") : "");
      return {
        title: data.title || topic,
        structure,
        fullText,
        content: fullText || result.content || "",
        tags: Array.isArray(structure?.tags) ? structure.tags : (Array.isArray(data.tags) ? data.tags : []),
        script_type: data.script_type || "",
        duration_sec: data.duration_sec || 0,
        usage: result.usage,
      };
    } catch {
      return {
        title: topic,
        content: result.content || "",
        tags: [],
        usage: result.usage,
        error: "PARSE_ERROR",
        message: "AI 返回的内容格式异常，已保留原始文本",
      };
    }
  }

  // =============================================================================
  // 3c. MCN 功能 — 标题优化
  // =============================================================================

  /**
   * 为选题生成多个优化标题
   *
   * @param {string} topic - 选题
   * @param {string} platform - 目标平台
   * @param {number} [count=10] - 标题数量
   * @returns {Promise<{titles:Array<{title:string, formula:string, score:number}>}|{error:string}>}
   */
  async function optimizeTitles(topic, platform, count = 10) {
    const systemPrompt = `你是一位专业的${platform}标题优化专家，精通各类标题公式。

请为选题生成${count}个标题变体，每个标题使用不同的爆款标题公式。

可用的标题公式（每个标题必须使用不同的公式）：
1. 数字列举法：用具体数字增加可信度
2. 疑问悬念法：用问句制造好奇
3. 反常识法：打破常规认知
4. 利益承诺法：直接告诉读者看完能获得什么
5. 痛点共鸣法：精准戳中目标用户的痛点
6. 对比冲突法：制造对立对比
7. 情感共鸣法：用情绪关键词引发共鸣
8. 热点借势法：蹭热点吸引关注
9. 故事开头法：用一句话吊起胃口
10. 权威背书法：引用权威数据/研究
11. 场景代入法：描述具体使用场景
12. 总结盘点法：合集/大盘点

要求：
- 每个标题 15-30 字
- 标题之间有明显差异
- 评分基于点击吸引力（1-10分）
- 标注使用的公式名称

以 JSON 数组格式返回：
[{"title": "...", "formula": "公式名", "score": 8}, ...]

输出纯 JSON 数组，不包含 markdown 代码块标记。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `选题：${topic}\n平台：${platform}\n生成${count}个标题。`,
        },
      ],
      { temperature: CONFIG.deepseek.creativeTemp },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) text = arrMatch[0];

      const titles = JSON.parse(text);
      return {
        titles: Array.isArray(titles) ? titles : [],
        usage: result.usage,
      };
    } catch {
      return {
        titles: [],
        raw: result.content,
        usage: result.usage,
        error: "PARSE_ERROR",
        message: "AI 返回的标题格式异常，请重试",
      };
    }
  }

  // =============================================================================
  // 3d. 爆款拆解 — Deepseek AI 视频分析
  // =============================================================================

  /**
   * 获取当前天气（基于 Open-Meteo 免费 API，杭州）
   * @returns {Promise<{temperature:number, weather:string}|{error:string}>}
   */
  async function getWeather() {
    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=30.25&longitude=120.17&current=temperature_2m,weather_code&timezone=Asia%2FShanghai";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Weather API error");
      const data = await response.json();
      const code = data?.current?.weather_code;
      const temperature = data?.current?.temperature_2m;

      const weatherMap = {
        0: "晴", 1: "多云", 2: "多云", 3: "阴",
        45: "雾", 48: "雾",
        51: "小雨", 53: "小雨", 55: "中雨",
        56: "冻雨", 57: "冻雨",
        61: "小雨", 63: "中雨", 65: "大雨",
        66: "冻雨", 67: "冻雨",
        71: "小雪", 73: "中雪", 75: "大雪",
        77: "雪粒",
        80: "阵雨", 81: "阵雨", 82: "雷阵雨",
        85: "阵雪", 86: "阵雪",
        95: "雷雨", 96: "雷雹", 99: "雷雹",
      };

      return {
        temperature: temperature ?? "--",
        weather: weatherMap[code] || "多云",
        raw: data,
      };
    } catch (e) {
      return { error: true, message: e.message || "天气获取失败" };
    }
  }

  /**
   * AI 爆款视频拆解分析
   *
   * 用户输入视频信息（标题、文案/脚本、平台等），由 Deepseek 进行结构化拆解：
   * 结构分段、爆款归因、六维评分、可借鉴策略
   *
   * @param {object} videoInfo
   * @param {string} videoInfo.title - 视频标题
   * @param {string} videoInfo.script - 视频文案/脚本/口播内容
   * @param {string} videoInfo.platform - 发布平台
   * @param {string} [videoInfo.description] - 补充描述
   * @param {string} [videoInfo.url] - 视频链接（仅用于记录）
   * @returns {Promise<{analysis:object}|{error:string}>}
   */
  async function analyzeVideo(videoInfo) {
    const { title, script, platform, description, url } = videoInfo;

    if (!title && !script) {
      return makeError("INVALID_PARAMS", null, "请至少填写视频标题或文案");
    }

    const systemPrompt = `你是一位专业的短视频爆款拆解分析师，擅长从结构、内容、情绪、流量等维度对爆款视频进行深度逆向工程。

请对以下视频信息进行结构化拆解分析，严格按照 JSON 格式输出。

分析框架：

1. **结构分段**：将视频内容按时间线拆分为若干段落，标注每段的时长占比、内容类型（如hook/引入/正文/转折/结尾/CTA）、核心功能
2. **爆款归因**：分析该视频能火的核心原因（至少3条），如情绪共鸣、信息差、节奏设计、选题精准等
3. **六维评分**：从以下六个维度打分（1-10分），并给出评分理由
   - 选题度：选题是否有热度和需求
   - 钩子力：开头3秒的抓人程度
   - 结构力：内容结构的完整性和节奏感
   - 情绪力：情绪调动和共鸣能力
   - 信息量：提供的有价值信息密度
   - 互动性：引发评论/点赞/转发的潜力
4. **可借鉴策略**：提炼3-5条可复用的创作策略，每条包含策略名称、具体做法、适用场景
5. **改进建议**：如果这个视频有不足，指出可以优化的点
6. **总评**：综合评价（一段话）

以严格 JSON 格式返回（不要 markdown 代码块标记）：
{
  "segments": [
    {"index": 1, "name": "段落名称", "duration": "0-3秒", "type": "hook", "function": "核心功能描述"}
  ],
  "viralFactors": [
    {"factor": "归因名称", "explanation": "详细解释"}
  ],
  "scores": {
    "topic": {"score": 8, "reason": "评分理由"},
    "hook": {"score": 7, "reason": "评分理由"},
    "structure": {"score": 8, "reason": "评分理由"},
    "emotion": {"score": 9, "reason": "评分理由"},
    "info": {"score": 7, "reason": "评分理由"},
    "interaction": {"score": 8, "reason": "评分理由"}
  },
  "overallScore": 8.0,
  "strategies": [
    {"name": "策略名称", "method": "具体做法", "scenario": "适用场景"}
  ],
  "improvements": ["改进点1", "改进点2"],
  "summary": "总评一段话"
}`;

    const userContent = `请拆解分析以下${platform || "短视频"}视频：

【标题】${title || "无"}

【文案/脚本】
${script || "无"}

${description ? `【补充描述】${description}` : ""}

请进行完整的爆款拆解分析。`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { temperature: 0.3 },
    );

    if (result.error) return result;

    // 解析返回的 JSON
    try {
      let text = result.content.trim();
      // 移除可能的 ```json ... ``` 包裹
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      // 查找 JSON 对象
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];

      const analysis = JSON.parse(text);
      return { analysis, usage: result.usage, raw: result.content };
    } catch {
      return {
        analysis: null,
        raw: result.content,
        usage: result.usage,
        error: "PARSE_ERROR",
        message: "AI 返回的拆解结果格式异常，已保留原始文本",
      };
    }
  }

  /**
   * 生成周度数据报告
   *
   * @param {Object} params
   * @param {Array} params.videos - 视频数据数组
   * @param {Object} params.aggregates - 汇总统计
   * @param {string} [params.period] - 报告周期，如"2026-08-01 ~ 2026-08-07"
   * @returns {Promise<{report?:Object, raw?:string, error?:string, message?:string}>}
   */
  async function generateWeeklyReport(params) {
    const { videos, aggregates, period } = params || {};

    if (!videos || videos.length === 0) {
      return makeError("INVALID_PARAMS", null, "本周没有视频数据，无法生成报告");
    }

    const videoListText = videos
      .map((v, idx) => {
        return `【视频${idx + 1}】${v.title}
发布日期：${v.publishDate || "未知"} | 时长：${v.duration || 0}秒
播放量：${v.views} | 点赞：${v.likes} | 评论：${v.comments} | 分享：${v.shares} | 收藏：${v.favorites}
完播率：${v.completionRate}% | 5s完播率：${v.completion5sRate}% | 2s跳出率：${v.bounce2sRate}%
平均播放时长：${v.avgDuration}秒 | 平均播放占比：${v.avgPlayRatio}% | 不感兴趣率：${v.notInterestedRate}%
吸粉：${v.followGained} (${v.followGainRate}%) | 脱粉：${v.followLost} (${v.followLossRate}%)
${v.notes ? "备注：" + v.notes : ""}`;
      })
      .join("\n\n");

    const aggregateText = Object.entries(aggregates || {})
      .map(([k, v]) => {
        const labels = {
          views: "播放量", likes: "点赞量", comments: "评论量", shares: "分享量",
          favorites: "收藏量", completionRate: "完播率", completion5sRate: "5s完播率",
          bounce2sRate: "2s跳出率", avgDuration: "平均播放时长", avgPlayRatio: "平均播放占比",
          notInterestedRate: "不感兴趣率", followGained: "吸粉量", followLost: "脱粉量",
          followGainRate: "吸粉率", followLossRate: "脱粉率",
        };
        return `${labels[k] || k}：合计 ${Math.round(v.sum)}，均值 ${v.avg.toFixed(2)}，最高 ${v.max}`;
      })
      .join("\n");

    const systemPrompt = `你是一位资深的短视频运营数据分析师，专精于抖音/小红书等平台的账号数据诊断与增长策略。

你的任务是基于创作者近一周的视频数据，产出一份专业的《周度数据诊断报告》，帮助创作者：
1. 看清本周整体表现
2. 发现表现最好和最差的视频，提炼规律
3. 找出数据反映的真实问题
4. 给出下周的优化方向和行动清单

报告风格：先讲结论，再讲数据佐证，最后给可执行建议。专业但不冷冰冰，要像一位懂行的运营导师在和创作者对话。`;

    const userContent = `请基于以下数据生成周度数据诊断报告：

【报告周期】${period || "近 7 天"}
【视频数量】${videos.length} 条

【本周汇总数据】
${aggregateText}

【每条视频明细】
${videoListText}

---

请严格按照以下 JSON 结构输出（不要用 markdown 代码块标记）：

{
  "overview": {
    "highlight": "本周一句话总结（最好/最差表现、整体水平评估）",
    "totalViews": "总播放量",
    "totalLikes": "总点赞量",
    "totalFollowGained": "总吸粉数",
    "avgCompletionRate": "平均完播率",
    "performanceLevel": "整体表现评级（优秀/良好/一般/需改进）"
  },
  "bestVideo": {
    "title": "表现最好视频的标题",
    "reason": "为什么表现好（3-5条数据维度分析）"
  },
  "worstVideo": {
    "title": "表现最差视频的标题",
    "diagnosis": "问题诊断（为什么表现差）"
  },
  "patterns": [
    {"pattern": "发现的规律/趋势", "explanation": "规律解释与数据支撑"}
  ],
  "problems": [
    {"problem": "核心问题", "impact": "影响程度", "rootCause": "可能的原因"}
  ],
  "nextWeekActions": [
    {"action": "行动项", "reason": "为什么做", "expectedOutcome": "预期结果"}
  ],
  "keyInsight": "本周最重要的一个洞察（一段话）"
}`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { temperature: 0.4 },
    );

    if (result.error) return result;

    try {
      let text = result.content.trim();
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) text = mdMatch[1].trim();
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];

      const report = JSON.parse(text);
      return { report, usage: result.usage, raw: result.content };
    } catch {
      return {
        report: null,
        raw: result.content,
        usage: result.usage,
        error: "PARSE_ERROR",
        message: "AI 返回的报告格式异常，已保留原始文本",
      };
    }
  }

  // =============================================================================
  // 3.5 爆款视频拆解分析
  // =============================================================================

  /**
   * 使用 Deepseek API 直接分析视频素材，生成结构化拆解报告
   * 替代 Skill 复制粘贴工作流，在页面内直接生成报告
   */
  async function analyzeVideoDecomp(params) {
    const { videoTitle, videoUrl, script, platform, goal, data, desc } = params || {};

    if (!videoTitle) {
      return makeError("INVALID_PARAMS", null, "请填写视频标题");
    }

    const dataText = Object.entries(data || {})
      .map(([k, v]) => {
        const labels = {
          spend: "消耗（元）", impressions: "曝光量", ctr: "CTR（%）",
          cvr: "CVR（%）", roi: "ROI", completionRate: "完播率（%）",
        };
        return `- ${labels[k] || k}：${v}`;
      })
      .join("\n") || "（未提供投放数据）";

    const systemPrompt = `你是一位资深的短视频爆款素材分析师，专精于抖音、小红书、视频号等平台的短视频内容拆解与优化。

你的任务是基于用户提供的视频信息，产出一份专业的《爆款素材拆解报告》，帮助创作者：
1. 理解视频的结构分段和每段功能
2. 评估黄金3秒钩子的有效性
3. 分析脚本结构与节奏
4. 识别卖点可视化手法
5. 评估CTA结尾策略
6. 判断节奏风格
7. 结合投放数据分析流量成因
8. 给出可执行的优化建议

报告要求：
- 使用 Markdown 格式输出
- 结构清晰，每部分有明确的标题
- 分析要有深度，不要泛泛而谈
- 建议要具体可执行，不要空洞的口号
- 如果某些信息缺失，基于已有信息做合理推断并标注`;

    const userContent = `请对以下视频进行深度拆解分析：

【视频标题】${videoTitle}
【视频路径/链接】${videoUrl || "（未提供）"}
【发布平台】${platform || "抖音"}
【目标定位】${goal || "请帮我判断适合直播间引流还是挂车成交"}

【口播文案/字幕/脚本】
${script || "（未提供口播文案，请基于标题和投放数据进行推断分析）"}

【投放数据】
${dataText}

【补充描述】
${desc || "（无）"}

---

请按以下结构输出 Markdown 格式的拆解报告：

## 一、视频概览
- 视频标题、平台、目标定位的简要说明
- 一句话总结视频的核心策略

## 二、结构分段拆解
将视频按时间线拆解为若干段落（开头钩子→内容展开→高潮→结尾CTA），每段包含：
- 时间区间（估算）
- 段落名称
- 功能说明
- 关键手法

## 三、黄金3秒钩子分析
- 钩子类型（悬念/冲突/利益点/情绪共鸣/视觉冲击）
- 有效性评估
- 改进建议

## 四、脚本结构与节奏
- 整体结构分析
- 节奏快慢变化
- 信息密度评估

## 五、卖点可视化
- 核心卖点识别
- 可视化手法分析
- 效果评估

## 六、CTA结尾分析
- CTA类型（引导关注/引导购买/引导评论/引导进入直播间）
- 转化路径设计
- 改进建议

## 七、六维评分
请从以下六个维度评分（1-10分），并简要说明理由：
1. 选题度
2. 钩子力
3. 结构力
4. 情绪力
5. 信息量
6. 互动性

## 八、流量成因与优化建议
- 结合投放数据分析流量表现
- 至少3条可执行的优化建议
- 适合的优化方向（直播间引流/挂车成交）`;

    const result = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      { temperature: 0.5 },
    );

    if (result.error) return result;

    return {
      report: result.content,
      usage: result.usage,
      raw: result.content,
    };
  }

  // =============================================================================
  // 4. 连接测试
  // =============================================================================

  /**
   * 测试 Deepseek API 连接
   *
   * @param {string} apiKey - API Key
   * @param {string} [apiUrl] - 自定义 API 地址
   * @returns {Promise<{success:boolean, message:string, model?:string}>}
   */
  async function testDeepseekConnection(apiKey, apiUrl) {
    if (!apiKey) {
      return { success: false, message: "API Key 不能为空" };
    }

    const baseUrl = apiUrl || CONFIG.deepseek.defaultUrl;
    const body = {
      model: CONFIG.deepseek.defaultModel,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
    };

    try {
      const resp = await fetch(
        `${baseUrl}${CONFIG.deepseek.chatEndpoint}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (resp.ok) {
        const json = await resp.json();
        return {
          success: true,
          message: "连接成功",
          model: json.model || CONFIG.deepseek.defaultModel,
        };
      }

      if (resp.status === 401) {
        return { success: false, message: "API Key 无效，请检查" };
      }
      if (resp.status === 402) {
        return { success: false, message: "账户余额不足" };
      }
      return {
        success: false,
        message: `连接失败 (HTTP ${resp.status})`,
      };
    } catch {
      return {
        success: false,
        message: "无法连接到 API 服务器，请检查地址和网络",
      };
    }
  }

  // =============================================================================
  // 5. Settings Helper
  // =============================================================================

  /**
   * 保存 Deepseek 设置
   * @param {{apiKey:string, apiUrl?:string, model?:string}} settings
   */
  function saveDeepseekSettings(settings) {
    localStorage.setItem(
      CONFIG.deepseek.settingsKey,
      JSON.stringify({
        apiKey: settings.apiKey || "",
        apiUrl: settings.apiUrl || CONFIG.deepseek.defaultUrl,
        model: settings.model || CONFIG.deepseek.defaultModel,
      }),
    );
  }

  /**
   * 清除所有缓存
   */
  function clearAllCache() {
    localStorage.removeItem(CONFIG.aihot.cacheKey);
    CONFIG.hotTopics.platforms.forEach((p) => {
      localStorage.removeItem(`${CONFIG.hotTopics.cachePrefix}_${p}`);
    });
  }

  // =============================================================================
  // Public API
  // =============================================================================

  return {
    // 配置
    CONFIG,

    // AI 新闻
    fetchAINews,

    // 热搜
    fetchHotTopics,
    fetchAllHotTopics,
    fetchAIHotTopics,
    fetchRealAIHotNews,
    generateAIHotSummary,
    fetchPlatformAIHotTopics,
    fetchFeiguaArticles,
    generateCompetitorTopics,

    // AI 对话
    aiChat,
    testDeepseekConnection,

    // MCN 功能
    generateTopics,
    generateTodayInspiration,
    generateContent,
    optimizeTitles,

    // 天气
    getWeather,

    // 爆款拆解
    analyzeVideo,

    // 数据看板
    generateWeeklyReport,
    analyzeVideoDecomp,

    // 设置管理
    getDeepseekSettings,
    saveDeepseekSettings,
    clearAllCache,

    // 工具函数
    formatTimeAgo,
    formatHeatScore,

    // CORS 回退 (供外部调试)
    fetchWithFallback,
  };
})();

// =============================================================================
// 导出（兼容多种环境）
// =============================================================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = API;
}
if (typeof window !== "undefined") {
  window.API = API;
}
