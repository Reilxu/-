/**
 * store.js
 * localStorage-based data layer for personal AI workspace.
 * Manages all data persistence for the app via browser localStorage.
 */

const Store = {
  KEYS: {
    today: 'xl_today',
    content: 'xl_content',
    topics: 'xl_topics',
    materials: 'xl_materials',
    inbox: 'xl_inbox',
    links: 'xl_links',
    settings: 'xl_settings',
    aiChat: 'xl_ai_chat',
    aiNews: 'xl_ai_news',
    hotTopics: 'xl_hot_topics',
    decomp: 'xl_decomp',
    mcnOutput: 'xl_mcn_output',
    videos: 'xl_videos',
    reports: 'xl_reports',
    alerts: 'xl_alerts',
    habits: 'xl_habits',
    checkins: 'xl_checkins',
    pomodoro: 'xl_pomodoro',
    habitNotes: 'xl_habit_notes',
    candyBalls: 'xl_candy_balls',
    rewardItems: 'xl_reward_items',
    redemptions: 'xl_redemptions',
  },

  // 需要同步到云端的 bucket（排除纯缓存类 aiNews / hotTopics）
  SYNC_BUCKETS: [
    'xl_today', 'xl_content', 'xl_topics', 'xl_materials',
    'xl_inbox', 'xl_links', 'xl_ai_chat', 'xl_decomp',
    'xl_mcn_output', 'xl_videos', 'xl_reports', 'xl_alerts',
    'xl_habits', 'xl_checkins', 'xl_pomodoro', 'xl_habit_notes',
    'xl_candy_balls', 'xl_reward_items', 'xl_redemptions'
  ],

  // 云端登录态（由 auth.js 通过 setCloudUser 设置）
  cloudUser: null,
  _cloudReady: false,

  // 当前是否已登录云端（Supabase 可用 + 有会话）
  isCloud() {
    return !!(this._cloudReady && this.cloudUser && window.SBData);
  },

  setCloudUser(user) {
    this.cloudUser = user || null;
    this._cloudReady = !!user;
  },

  // ---------- Generic methods ----------

  /**
   * Initialize with seed data if no data exists.
   * Also backfill demo data for modules that are empty.
   */
  init() {
    const hasData = localStorage.getItem(this.KEYS.today);
    if (!hasData) {
      this.seedData();
      return;
    }
    // Backfill demo data for any empty module so users can preview UI.
    this.backfillDemoData();
  },

  /**
   * Backfill demo data for empty modules without overwriting existing data.
   */
  backfillDemoData() {
    if (this.get(this.KEYS.videos).length === 0) {
      this.set(this.KEYS.videos, this._seedVideos());
    }
    if (this.get(this.KEYS.content).length === 0) {
      this.set(this.KEYS.content, this._seedContentItems());
    }
    if (this.get(this.KEYS.topics).length === 0) {
      this.set(this.KEYS.topics, this._seedTopics());
    }
    if (this.get(this.KEYS.decomp).length === 0) {
      this.set(this.KEYS.decomp, this._seedDecompRecords());
    }
    if (this.get(this.KEYS.reports).length === 0) {
      this.set(this.KEYS.reports, this._seedReports());
    }
    if (this.get(this.KEYS.inbox).length === 0) {
      this.set(this.KEYS.inbox, this._seedInspirations());
    }
    // Cache-based demo data
    const today = this.localDateStr();
    const inspirationCache = this.getObject('xl_today_inspiration_cache');
    if (!inspirationCache || !inspirationCache.date || inspirationCache.topics?.length === 0) {
      this.setObject('xl_today_inspiration_cache', { date: today, topics: this._seedTodayInspirations() });
    }
    if (this.get(this.KEYS.aiNews).length === 0) {
      this.set(this.KEYS.aiNews, this._seedAINews());
      this.saveAINewsMeta({ lastFetch: new Date().toISOString(), count: 6 });
    }
    if (this.getHotTopics().length === 0) {
      this._seedHotTopicsCache();
    }
  },

  /**
   * Get array from localStorage. Returns [] on error.
   * @param {string} key
   * @returns {Array}
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error('[Store.get] parse error for key:', key, e);
      return [];
    }
  },

  /**
   * Save array to localStorage.
   * @param {string} key
   * @param {Array} data
   */
  set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data || []));
    } catch (e) {
      console.error('[Store.set] save error for key:', key, e);
    }
    if (this._shouldSync(key)) this._pushBucket(key, data || []);
  },

  /**
   * Get object from localStorage. Returns {} on error.
   * @param {string} key
   * @returns {Object}
   */
  getObject(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Store.getObject] parse error for key:', key, e);
      return {};
    }
  },

  /**
   * Save object to localStorage.
   * @param {string} key
   * @param {Object} data
   */
  setObject(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data || {}));
    } catch (e) {
      console.error('[Store.setObject] save error for key:', key, e);
    }
    if (key === this.KEYS.settings && this.isCloud()) {
      window.SBData.saveSettings(data || {}).catch(function (e) {
        console.warn('[Store] 设置同步云端失败:', e);
      });
    }
  },

  /**
   * Generate a unique ID.
   * @returns {string}
   */
  genId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  },

  /**
   * 返回本地时区的 YYYY-MM-DD，避免 toISOString().slice(0,10) 在 UTC+8 晚间跨日的问题。
   * @param {Date|string|number} [d=new Date()]
   * @returns {string}
   */
  localDateStr(d = new Date()) {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // ---------- Today items ----------

  /**
   * Get all today items.
   * @returns {Array}
   */
  getTodayItems() {
    return this.get(this.KEYS.today);
  },

  /**
   * Save (create or update) a today item.
   * @param {Object} item
   * @returns {Object} saved item
   */
  saveTodayItem(item) {
    const items = this.getTodayItems();
    const now = new Date().toISOString();

    if (item.id) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const existing = items[idx];
        // 迁移旧字段到新字段：若表单未传新字段但旧字段存在，则回退保留
        const merged = {
          ...existing,
          ...item,
          startDate: item.startDate || existing.startDate || existing.startTime || '',
          endDate: item.endDate || existing.endDate || existing.endTime || '',
          startTime: item.startDate || item.startTime || existing.startTime || '',
          endTime: item.endDate || item.endTime || existing.endTime || '',
        };
        items[idx] = merged;
        this.set(this.KEYS.today, items);
        return items[idx];
      }
    }

    const newItem = {
      id: item.id || this.genId(),
      title: item.title || '',
      desc: item.desc || '',
      source: item.source || '',
      sourceId: item.sourceId || '',
      priority: item.priority || 'medium',
      done: item.done || false,
      type: item.type || 'task',
      dueDate: item.dueDate || this.localDateStr(),
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      // 兼容旧版 startTime/endTime：编辑保存时会覆盖为新字段
      startTime: item.startDate || item.startTime || '',
      endTime: item.endDate || item.endTime || '',
      createdAt: item.createdAt || now,
      completedAt: item.completedAt || null,
    };
    items.push(newItem);
    this.set(this.KEYS.today, items);
    return newItem;
  },

  /**
   * Delete a today item by id.
   * @param {string} id
   */
  deleteTodayItem(id) {
    const items = this.getTodayItems();
    this.set(this.KEYS.today, items.filter((i) => i.id !== id));
  },

  /**
   * Clear today items by a specific date (dueDate or createdAt fallback).
   * @param {string} dateStr - YYYY-MM-DD
   */
  clearTodayItemsByDate(dateStr) {
    const items = this.getTodayItems();
    this.set(this.KEYS.today, items.filter((i) => {
      const itemDate = i.dueDate || this.localDateStr(i.createdAt);
      return itemDate !== dateStr;
    }));
  },

  /**
   * Clear all today items.
   */
  clearAllTodayItems() {
    this.set(this.KEYS.today, []);
  },

  /**
   * Toggle done state of a today item.
   * @param {string} id
   */
  toggleTodayDone(id) {
    const items = this.getTodayItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items[idx].done = !items[idx].done;
      items[idx].completedAt = items[idx].done ? new Date().toISOString() : null;
      this.set(this.KEYS.today, items);
    }
  },

  /**
   * 提醒 & 动态：按当前数据生成/刷新提醒列表，并保留用户已读状态。
   * 返回最新提醒数组（含 done 字段）。
   * @returns {Array}
   */
  getOrRefreshAlerts() {
    const saved = this.get(this.KEYS.alerts);
    const generated = this._generateDashboardAlerts();
    const savedMap = new Map();
    saved.forEach(a => {
      const id = a.id || this._alertId(a);
      savedMap.set(id, a);
    });

    let changed = false;
    const merged = generated.map(a => {
      const id = a.id || this._alertId(a);
      if (savedMap.has(id)) {
        const s = savedMap.get(id);
        return { ...a, id, done: !!s.done, readAt: s.readAt || null, createdAt: s.createdAt || a.createdAt };
      }
      changed = true;
      return { ...a, id, done: false, readAt: null, createdAt: a.createdAt || new Date().toISOString() };
    });

    // 保留 7 天内仍有效的旧提醒（避免条件变化后立刻消失）
    const mergedMap = new Map(merged.map(a => [a.id, a]));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    saved.forEach(s => {
      const id = s.id || this._alertId(s);
      if (!mergedMap.has(id) && (s.createdAt || '') > weekAgo) {
        merged.push({ ...s, id });
        mergedMap.set(id, merged[merged.length - 1]);
        changed = true;
      }
    });

    if (changed) this.set(this.KEYS.alerts, merged);
    return merged;
  },

  /**
   * 切换提醒已读状态。
   * @param {string} id
   */
  toggleAlertDone(id) {
    const alerts = this.get(this.KEYS.alerts);
    const idx = alerts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      alerts[idx].done = !alerts[idx].done;
      alerts[idx].readAt = alerts[idx].done ? new Date().toISOString() : null;
      this.set(this.KEYS.alerts, alerts);
    }
  },

  /**
   * 清空所有已读提醒。
   */
  clearReadAlerts() {
    const alerts = this.get(this.KEYS.alerts).filter(a => !a.done);
    this.set(this.KEYS.alerts, alerts);
  },

  /**
   * 为提醒生成稳定 ID（按内容哈希，同一异常不重复）。
   * @param {Object} a
   * @returns {string}
   */
  _alertId(a) {
    return 'alert_' + this._hashString((a.title || '') + '|' + (a.desc || '') + '|' + (a.category || 'dashboard'));
  },

  _hashString(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  },

  /**
   * 根据数据看板等模块生成提醒 & 动态列表。
   * 当前来源：视频数据看板异常（播放量/互动数波动超过阈值）。
   * @returns {Array}
   */
  _generateDashboardAlerts() {
    const videos = this.get(this.KEYS.videos);
    if (videos.length === 0) {
      return [{
        type: 'normal',
        category: 'dashboard',
        title: '当前数据正常',
        desc: '暂无数据看板数据，请在数据看板上传视频数据',
        createdAt: new Date().toISOString()
      }];
    }

    const groups = {};
    videos.forEach(v => {
      const date = (v.createdAt || v.publishDate || '').slice(0, 10);
      if (!date) return;
      if (!groups[date]) groups[date] = [];
      groups[date].push(v);
    });

    const dates = Object.keys(groups).sort().reverse();
    if (dates.length < 2) {
      return [{
        type: 'normal',
        category: 'dashboard',
        title: '当前数据正常',
        desc: '数据量不足，暂无法与前次上传进行对照',
        createdAt: new Date().toISOString()
      }];
    }

    const avg = (arr, key) => arr.reduce((sum, v) => sum + (Number(v[key]) || 0), 0) / arr.length;
    const avgInteraction = (arr) => arr.reduce((sum, v) => sum + (Number(v.likes) || 0) + (Number(v.comments) || 0), 0) / arr.length;

    const latest = groups[dates[0]];
    const previous = groups[dates[1]];
    const latestViews = avg(latest, 'views');
    const previousViews = avg(previous, 'views');
    const latestInteractions = avgInteraction(latest);
    const previousInteractions = avgInteraction(previous);
    const viewChange = previousViews === 0 ? 0 : (latestViews - previousViews) / previousViews;
    const interactionChange = previousInteractions === 0 ? 0 : (latestInteractions - previousInteractions) / previousInteractions;
    const viewChangePct = Math.round(viewChange * 100);
    const interactionChangePct = Math.round(interactionChange * 100);

    if (viewChange < -0.2 || Math.abs(interactionChange) > 0.2) {
      let desc = '';
      if (viewChange < -0.2) {
        desc += `最新上传视频平均播放量下降 ${Math.abs(viewChangePct)}%；`;
      }
      if (Math.abs(interactionChange) > 0.2) {
        const direction = interactionChange > 0 ? '上升' : '下降';
        desc += `平均互动数（点赞+评论）${direction} ${Math.abs(interactionChangePct)}%；`;
      }
      return [{
        type: 'alert',
        category: 'dashboard',
        title: '数据看板流量异常',
        desc: desc.slice(0, -1) + '，建议检查内容方向或发布策略',
        createdAt: new Date().toISOString()
      }];
    }

    return [{
      type: 'normal',
      category: 'dashboard',
      title: '当前数据正常',
      desc: `播放量较上次变化 ${viewChangePct >= 0 ? '+' : ''}${viewChangePct}%，互动数变化 ${interactionChangePct >= 0 ? '+' : ''}${interactionChangePct}%`,
      createdAt: new Date().toISOString()
    }];
  },

  // ---------- Content items ----------

  /**
   * Get all content items.
   * @returns {Array}
   */
  getContentItems() {
    return this.get(this.KEYS.content);
  },

  /**
   * Save (create or update) a content item.
   * @param {Object} item
   * @returns {Object} saved item
   */
  saveContentItem(item) {
    const items = this.getContentItems();
    const now = new Date().toISOString();

    if (item.id) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item, updatedAt: now };
        this.set(this.KEYS.content, items);
        return items[idx];
      }
    }

    const newItem = {
      id: item.id || this.genId(),
      title: item.title || '',
      type: item.type || 'idea',
      status: item.status || 'idea',
      platform: item.platform || '',
      content: item.content || '',
      tags: item.tags || [],
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    items.push(newItem);
    this.set(this.KEYS.content, items);
    return newItem;
  },

  /**
   * Delete a content item by id.
   * @param {string} id
   */
  deleteContentItem(id) {
    const items = this.getContentItems();
    this.set(this.KEYS.content, items.filter((i) => i.id !== id));
  },

  /**
   * Get a single content item by id.
   * @param {string} id
   * @returns {Object|null}
   */
  getContentItem(id) {
    const items = this.getContentItems();
    return items.find((i) => i.id === id) || null;
  },

  // ---------- Topics ----------

  /**
   * Get all topics.
   * @returns {Array}
   */
  getTopics() {
    return this.get(this.KEYS.topics);
  },

  /**
   * Save (create or update) a topic.
   * @param {Object} item
   * @returns {Object} saved item
   */
  saveTopic(item) {
    const items = this.getTopics();
    const now = new Date().toISOString();

    if (item.id) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item };
        this.set(this.KEYS.topics, items);
        return items[idx];
      }
    }

    const newItem = {
      id: item.id || this.genId(),
      title: item.title || '',
      desc: item.desc || '',
      score: item.score || 0,
      status: item.status || 'idea',
      tags: item.tags || [],
      angles: item.angles || [],
      createdAt: item.createdAt || now,
    };
    items.push(newItem);
    this.set(this.KEYS.topics, items);
    return newItem;
  },

  /**
   * Delete a topic by id.
   * @param {string} id
   */
  deleteTopic(id) {
    const items = this.getTopics();
    this.set(this.KEYS.topics, items.filter((i) => i.id !== id));
  },

  /**
   * Get a single topic by id.
   * @param {string} id
   * @returns {Object|null}
   */
  getTopic(id) {
    const items = this.getTopics();
    return items.find((i) => i.id === id) || null;
  },

  // ---------- Materials ----------

  /**
   * Get all materials.
   * @returns {Array}
   */
  getMaterials() {
    return this.get(this.KEYS.materials);
  },

  /**
   * Save (create or update) a material.
   * @param {Object} item
   * @returns {Object} saved item
   */
  saveMaterial(item) {
    const items = this.getMaterials();
    const now = new Date().toISOString();

    if (item.id) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item };
        this.set(this.KEYS.materials, items);
        return items[idx];
      }
    }

    const newItem = {
      id: item.id || this.genId(),
      name: item.name || '',
      type: item.type || '',
      desc: item.desc || '',
      tags: item.tags || [],
      createdAt: item.createdAt || now,
    };
    items.push(newItem);
    this.set(this.KEYS.materials, items);
    return newItem;
  },

  /**
   * Delete a material by id.
   * @param {string} id
   */
  deleteMaterial(id) {
    const items = this.getMaterials();
    this.set(this.KEYS.materials, items.filter((i) => i.id !== id));
  },

  /**
   * Get a single material by id.
   * @param {string} id
   * @returns {Object|null}
   */
  getMaterial(id) {
    const items = this.getMaterials();
    return items.find((i) => i.id === id) || null;
  },

  // ---------- User Inspirations (renamed from inbox) ----------

  /**
   * Get all user inspirations (formerly inbox items).
   * @returns {Array}
   */
  getUserInspirations() {
    return this.get(this.KEYS.inbox);
  },

  /**
   * Save (create or update) a user inspiration.
   * @param {Object} item
   * @returns {Object} saved item
   */
  saveUserInspiration(item) {
    const items = this.getUserInspirations();
    const now = new Date().toISOString();

    if (item.id) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item };
        this.set(this.KEYS.inbox, items);
        return items[idx];
      }
    }

    const newItem = {
      id: item.id || this.genId(),
      title: item.title || '',
      text: item.text || '',
      desc: item.desc || '',
      tags: item.tags || [],
      type: item.type || 'idea',
      createdAt: item.createdAt || now,
      processed: item.processed || false,
    };
    items.push(newItem);
    this.set(this.KEYS.inbox, items);
    return newItem;
  },

  /**
   * Delete a user inspiration by id.
   * @param {string} id
   */
  deleteUserInspiration(id) {
    const items = this.getUserInspirations();
    this.set(this.KEYS.inbox, items.filter((i) => i.id !== id));
  },

  /**
   * Get a single user inspiration by id.
   * @param {string} id
   * @returns {Object|null}
   */
  getUserInspiration(id) {
    const items = this.getUserInspirations();
    return items.find((i) => i.id === id) || null;
  },

  // ---------- Inbox (legacy alias for user inspirations) ----------

  getInboxItems() {
    return this.getUserInspirations();
  },

  saveInboxItem(item) {
    return this.saveUserInspiration(item);
  },

  deleteInboxItem(id) {
    this.deleteUserInspiration(id);
  },

  // ---------- Links ----------

  /**
   * Get all links.
   * @returns {Array}
   */
  getLinks() {
    return this.get(this.KEYS.links);
  },

  /**
   * Add a link between two items.
   * @param {string} from - source item id
   * @param {string} to - target item id
   * @param {string} toModule - target module key
   * @returns {Object} created link
   */
  addLink(from, to, toModule) {
    const links = this.getLinks();
    // Avoid duplicate links
    const exists = links.find(
      (l) => l.from === from && l.to === to && l.toModule === toModule
    );
    if (exists) return exists;

    const link = {
      from: from,
      to: to,
      toModule: toModule,
      createdAt: new Date().toISOString(),
    };
    links.push(link);
    this.set(this.KEYS.links, links);
    return link;
  },

  /**
   * Remove a specific link.
   * @param {string} from
   * @param {string} to
   * @param {string} toModule
   */
  removeLink(from, to, toModule) {
    const links = this.getLinks();
    this.set(
      this.KEYS.links,
      links.filter(
        (l) => !(l.from === from && l.to === to && l.toModule === toModule)
      )
    );
  },

  /**
   * Remove all links associated with a given item id (either from or to).
   * @param {string} itemId
   */
  removeLinks(itemId) {
    const links = this.getLinks();
    this.set(
      this.KEYS.links,
      links.filter((l) => l.from !== itemId && l.to !== itemId)
    );
  },

  /**
   * Get all items linked to/from a given item id.
   * @param {string} itemId
   * @returns {Array} linked items with module info
   */
  getLinkedItems(itemId) {
    const links = this.getLinks();
    const result = [];

    links.forEach((l) => {
      if (l.from === itemId) {
        const target = this._lookupItem(l.to, l.toModule);
        if (target) {
          result.push({
            link: l,
            direction: 'out',
            module: l.toModule,
            item: target,
          });
        }
      } else if (l.to === itemId) {
        const target = this._lookupItem(l.from, null);
        if (target) {
          result.push({
            link: l,
            direction: 'in',
            module: l.toModule,
            item: target,
          });
        }
      }
    });

    return result;
  },

  /**
   * Lookup an item by id across modules.
   * @param {string} id
   * @param {string|null} moduleKey - hint for which module to search
   * @returns {Object|null}
   * @private
   */
  _lookupItem(id, moduleKey) {
    const moduleMap = {
      [this.KEYS.today]: this.getTodayItems(),
      [this.KEYS.content]: this.getContentItems(),
      [this.KEYS.topics]: this.getTopics(),
      [this.KEYS.materials]: this.getMaterials(),
      [this.KEYS.inbox]: this.getInboxItems(),
    };

    if (moduleKey && moduleMap[moduleKey]) {
      return moduleMap[moduleKey].find((i) => i.id === id) || null;
    }

    // Search all modules
    for (const items of Object.values(moduleMap)) {
      const found = items.find((i) => i.id === id);
      if (found) return found;
    }
    return null;
  },

  // ---------- AI News cache ----------

  /**
   * Get cached AI news items.
   * @returns {Array}
   */
  getAINews() {
    return this.get(this.KEYS.aiNews);
  },

  /**
   * Save AI news items with timestamp.
   * @param {Array} items
   */
  saveAINews(items) {
    this.set(this.KEYS.aiNews, items || []);
    this.saveAINewsMeta({
      lastFetch: new Date().toISOString(),
      count: (items || []).length,
    });
  },

  /**
   * Get AI news metadata.
   * @returns {Object}
   */
  getAINewsMeta() {
    const meta = this.getObject(this.KEYS.aiNews + '_meta');
    return {
      lastFetch: meta.lastFetch || null,
      count: meta.count || 0,
    };
  },

  /**
   * Save AI news metadata.
   * @param {Object} meta
   */
  saveAINewsMeta(meta) {
    this.setObject(this.KEYS.aiNews + '_meta', {
      lastFetch: meta.lastFetch || null,
      count: meta.count || 0,
    });
  },

  // ---------- Hot Topics cache ----------

  /**
   * Get cached hot topics.
   * @returns {Array}
   */
  getHotTopics() {
    return this.get(this.KEYS.hotTopics);
  },

  /**
   * Save hot topics with timestamp.
   * @param {Array} items
   */
  saveHotTopics(items) {
    this.set(this.KEYS.hotTopics, items || []);
    this.saveHotTopicsMeta({
      lastFetch: new Date().toISOString(),
      count: (items || []).length,
    });
  },

  /**
   * Get hot topics metadata.
   * @returns {Object}
   */
  getHotTopicsMeta() {
    const meta = this.getObject(this.KEYS.hotTopics + '_meta');
    return {
      lastFetch: meta.lastFetch || null,
      count: meta.count || 0,
    };
  },

  /**
   * Save hot topics metadata.
   * @param {Object} meta
   */
  saveHotTopicsMeta(meta) {
    this.setObject(this.KEYS.hotTopics + '_meta', {
      lastFetch: meta.lastFetch || null,
      count: meta.count || 0,
    });
  },

  getCompetitorTopics() {
    const c = this.getObject('xl_competitor_topics_cache');
    if (c && c.data && Date.now() - (c._ts || 0) < 30 * 60 * 1000) return c.data;
    return null;
  },

  saveCompetitorTopics(data) {
    this.setObject('xl_competitor_topics_cache', { data, _ts: Date.now() });
  },

  // 用户手动粘贴的真实博主选题（map: 博主名 -> [标题...]）
  getCompetitorRealTitles() {
    return this.getObject('xl_competitor_real_titles') || {};
  },

  saveCompetitorRealTitles(map) {
    this.setObject('xl_competitor_real_titles', map || {});
  },

  // 本周 AI 热点概要（Deepseek 以周为维度汇总，30min TTL；点右上角刷新会 force 重新抓取+重新生成）
  getAIHotSummary() {
    const c = this.getObject('xl_ai_hot_summary_cache');
    if (c && c.data && Date.now() - (c._ts || 0) < 30 * 60 * 1000) return c.data;
    return null;
  },

  saveAIHotSummary(data) {
    this.setObject('xl_ai_hot_summary_cache', { data, _ts: Date.now() });
  },

  // ---------- Decomposition records ----------

  /**
   * Get all decomposition records.
   * @returns {Array}
   */
  getDecompRecords() {
    return this.get(this.KEYS.decomp);
  },

  /**
   * Save (create or update) a decomposition record.
   * @param {Object} record
   * @returns {Object} saved record
   */
  saveDecompRecord(record) {
    const records = this.getDecompRecords();
    const now = new Date().toISOString();

    if (record.id) {
      const idx = records.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        records[idx] = { ...records[idx], ...record };
        this.set(this.KEYS.decomp, records);
        return records[idx];
      }
    }

    const newRecord = {
      id: record.id || this.genId(),
      videoTitle: record.videoTitle || '',
      videoUrl: record.videoUrl || '',
      script: record.script || '',
      platform: record.platform || '抖音',
      goal: record.goal || '',
      desc: record.desc || '',
      data: record.data || {},
      report: record.report || '',
      analysis: record.analysis || null,
      pointsUsed: record.pointsUsed || 0,
      status: record.status || 'pending',
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now,
    };
    records.push(newRecord);
    this.set(this.KEYS.decomp, records);
    return newRecord;
  },

  /**
   * Delete a decomposition record by id.
   * @param {string} id
   */
  deleteDecompRecord(id) {
    const records = this.getDecompRecords();
    this.set(this.KEYS.decomp, records.filter((r) => r.id !== id));
  },

  // ---------- MCN Output records ----------

  /**
   * Get all MCN output records.
   * @returns {Array}
   */
  getMCNOutputs() {
    return this.get(this.KEYS.mcnOutput);
  },

  /**
   * Save (create or update) an MCN output record.
   * @param {Object} record
   * @returns {Object} saved record
   */
  saveMCNOutput(record) {
    const records = this.getMCNOutputs();
    const now = new Date().toISOString();

    if (record.id) {
      const idx = records.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        records[idx] = { ...records[idx], ...record };
        this.set(this.KEYS.mcnOutput, records);
        return records[idx];
      }
    }

    const newRecord = {
      id: record.id || this.genId(),
      module: record.module || 'topic',
      input: record.input || '',
      output: record.output || '',
      createdAt: record.createdAt || now,
    };
    records.push(newRecord);
    this.set(this.KEYS.mcnOutput, records);
    return newRecord;
  },

  /**
   * Delete an MCN output record by id.
   * @param {string} id
   */
  deleteMCNOutput(id) {
    const records = this.getMCNOutputs();
    this.set(this.KEYS.mcnOutput, records.filter((r) => r.id !== id));
  },

  // ---------- Settings ----------

  /**
   * Default settings.
   * @returns {Object}
   * @private
   */
  _defaultSettings() {
    return {
      userName: '小冷',
      workType: 'AI自媒体',
      deepseekApiKey: '',
      deepseekApiUrl: 'https://api.deepseek.com/v1',
      deepseekModel: 'deepseek-chat',
      lingyiApiKey: '',
      theme: 'light',
    };
  },

  /**
   * Get settings, merged with defaults.
   * @returns {Object}
   */
  getSettings() {
    return { ...this._defaultSettings(), ...this.getObject(this.KEYS.settings) };
  },

  /**
   * Save settings.
   * @param {Object} settings
   */
  saveSettings(settings) {
    const current = this.getSettings();
    const merged = { ...current, ...settings };
    this.setObject(this.KEYS.settings, merged);
  },

  // ---------- AI Chat ----------

  /**
   * Get all AI chat messages.
   * @returns {Array}
   */
  getAIChat() {
    return this.get(this.KEYS.aiChat);
  },

  /**
   * Save an AI chat message.
   * @param {Object} message
   * @returns {Object} saved message
   */
  saveAIMessage(message) {
    const messages = this.getAIChat();

    const newMessage = {
      id: message.id || this.genId(),
      role: message.role || 'user',
      content: message.content || '',
      createdAt: message.createdAt || new Date().toISOString(),
    };
    messages.push(newMessage);
    this.set(this.KEYS.aiChat, messages);
    return newMessage;
  },

  /**
   * Clear all AI chat messages.
   */
  clearAIChat() {
    this.set(this.KEYS.aiChat, []);
  },

  // ---------- Search ----------

  /**
   * Search across all searchable modules (today, content, topics, materials, userInspirations).
   * @param {string} query
   * @returns {Array} results with { module, moduleKey, id, title, snippet }
   */
  searchAll(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const results = [];
    const searchableModules = [
      { key: this.KEYS.today, name: '今日事项', items: this.getTodayItems() },
      { key: this.KEYS.content, name: '内容创作', items: this.getContentItems() },
      { key: this.KEYS.topics, name: '选题', items: this.getTopics() },
      { key: this.KEYS.materials, name: '素材库', items: this.getMaterials() },
      { key: this.KEYS.inbox, name: '用户灵感', items: this.getUserInspirations() },
    ];

    searchableModules.forEach((mod) => {
      mod.items.forEach((item) => {
        const title = (item.title || item.text || item.name || '').toString();
        const snippetSource = [
          title,
          item.desc || '',
          item.content || '',
          (item.tags || []).join(' '),
          (item.angles || []).join(' '),
        ]
          .join(' ')
          .toLowerCase();

        if (
          title.toLowerCase().includes(q) ||
          snippetSource.includes(q)
        ) {
          results.push({
            module: mod.name,
            moduleKey: mod.key,
            id: item.id,
            title: title || '(无标题)',
            snippet: this._buildSnippet(item, q),
          });
        }
      });
    });

    return results;
  },

  /**
   * Build a text snippet from an item for search results.
   * @param {Object} item
   * @param {string} query
   * @returns {string}
   * @private
   */
  _buildSnippet(item, query) {
    const sources = [
      item.title,
      item.text,
      item.name,
      item.desc,
      item.content,
    ].filter((s) => s && typeof s === 'string');

    for (const src of sources) {
      const lower = src.toLowerCase();
      const idx = lower.indexOf(query);
      if (idx >= 0) {
        const start = Math.max(0, idx - 20);
        const end = Math.min(src.length, idx + query.length + 40);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < src.length ? '...' : '';
        return prefix + src.slice(start, end) + suffix;
      }
    }

    // Fallback: first available text field
    for (const src of sources) {
      if (src.length > 60) return src.slice(0, 60) + '...';
      return src;
    }
    return '';
  },

  // ---------- Export / Import ----------

  /**
   * Export all data as a JSON string.
   * @returns {string}
   */
  exportAll() {
    const data = {};
    Object.values(this.KEYS).forEach((key) => {
      data[key] = this.getObject(key);
      // Also export meta keys
      const metaKey = key + '_meta';
      const metaRaw = localStorage.getItem(metaKey);
      if (metaRaw) {
        data[metaKey] = JSON.parse(metaRaw);
      }
    });
    return JSON.stringify(data, null, 2);
  },

  /**
   * Import all data from a JSON string.
   * @param {string} jsonStr
   * @returns {boolean} success
   */
  importAll(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      Object.keys(data).forEach((key) => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
      return true;
    } catch (e) {
      console.error('[Store.importAll] import error:', e);
      return false;
    }
  },

  /**
   * Remove all app data from localStorage.
   */
  clearAll() {
    Object.values(this.KEYS).forEach((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem(key + '_meta');
    });
  },

  // ---------- Videos (数据看板) ----------

  /**
   * Get all video data records.
   * @returns {Array}
   */
  getVideos() {
    return this.get(this.KEYS.videos);
  },

  /**
   * Save (create or update) a video data record.
   * @param {Object} item
   * @returns {Object} saved item
   */
  saveVideo(item) {
    const items = this.getVideos();
    const now = new Date().toISOString();

    if (item.id) {
      const idx = items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item, updatedAt: now };
        this.set(this.KEYS.videos, items);
        return items[idx];
      }
    }

    const newItem = {
      id: item.id || this.genId(),
      title: item.title || '',
      publishDate: item.publishDate || now.slice(0, 10),
      platform: item.platform || '抖音',
      duration: item.duration || 0,
      // 互动数据
      views: Number(item.views) || 0,
      likes: Number(item.likes) || 0,
      comments: Number(item.comments) || 0,
      shares: Number(item.shares) || 0,
      favorites: Number(item.favorites) || 0,
      // 播放质量
      completionRate: Number(item.completionRate) || 0,
      bounce2sRate: Number(item.bounce2sRate) || 0,
      avgDuration: Number(item.avgDuration) || 0,
      completion5sRate: Number(item.completion5sRate) || 0,
      avgPlayRatio: Number(item.avgPlayRatio) || 0,
      notInterestedRate: Number(item.notInterestedRate) || 0,
      // 涨粉数据
      followGained: Number(item.followGained) || 0,
      followLost: Number(item.followLost) || 0,
      followGainRate: Number(item.followGainRate) || 0,
      followLossRate: Number(item.followLossRate) || 0,
      tags: item.tags || [],
      notes: item.notes || '',
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    items.push(newItem);
    this.set(this.KEYS.videos, items);
    return newItem;
  },

  /**
   * Delete a video record by id.
   * @param {string} id
   */
  deleteVideo(id) {
    const items = this.getVideos();
    this.set(this.KEYS.videos, items.filter((i) => i.id !== id));
  },

  /**
   * Get a single video record by id.
   * @param {string} id
   * @returns {Object|null}
   */
  getVideo(id) {
    const items = this.getVideos();
    return items.find((i) => i.id === id) || null;
  },

  /**
   * Bulk save videos (used by CSV import).
   * @param {Array} items
   * @returns {Array} saved items
   */
  bulkSaveVideos(items) {
    const existing = this.getVideos();
    const now = new Date().toISOString();
    const newItems = items.map(item => ({
      id: item.id || this.genId(),
      title: item.title || '',
      publishDate: item.publishDate || now.slice(0, 10),
      platform: item.platform || '抖音',
      duration: Number(item.duration) || 0,
      views: Number(item.views) || 0,
      likes: Number(item.likes) || 0,
      comments: Number(item.comments) || 0,
      shares: Number(item.shares) || 0,
      favorites: Number(item.favorites) || 0,
      completionRate: Number(item.completionRate) || 0,
      bounce2sRate: Number(item.bounce2sRate) || 0,
      avgDuration: Number(item.avgDuration) || 0,
      completion5sRate: Number(item.completion5sRate) || 0,
      avgPlayRatio: Number(item.avgPlayRatio) || 0,
      notInterestedRate: Number(item.notInterestedRate) || 0,
      followGained: Number(item.followGained) || 0,
      followLost: Number(item.followLost) || 0,
      followGainRate: Number(item.followGainRate) || 0,
      followLossRate: Number(item.followLossRate) || 0,
      tags: item.tags || [],
      notes: item.notes || '',
      createdAt: item.createdAt || now,
      updatedAt: now,
    }));
    const merged = [...existing, ...newItems];
    this.set(this.KEYS.videos, merged);
    return newItems;
  },

  /**
   * Compute aggregates for the given videos and dimensions.
   * @param {Array} videos
   * @param {Array} keys
   * @returns {Object} { sum, avg, max, count }
   */
  aggregateVideos(videos, keys) {
    if (!videos || videos.length === 0) {
      return {};
    }
    const result = {};
    keys.forEach((k) => {
      const values = videos.map((v) => Number(v[k]) || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      result[k] = { sum, avg, max, min: Math.min(...values), count: values.length };
    });
    return result;
  },

  // ---------- Reports (AI weekly reports) ----------

  /**
   * Get all saved reports.
   * @returns {Array}
   */
  getReports() {
    return this.get(this.KEYS.reports);
  },

  /**
   * Save a report.
   * @param {Object} item
   */
  saveReport(item) {
    const items = this.getReports();
    const now = new Date().toISOString();
    const newItem = {
      id: item.id || this.genId(),
      type: item.type || 'weekly',
      title: item.title || '',
      period: item.period || '',
      content: item.content || '',
      videoIds: item.videoIds || [],
      stats: item.stats || {},
      createdAt: item.createdAt || now,
    };
    items.unshift(newItem);
    this.set(this.KEYS.reports, items);
    return newItem;
  },

  /**
   * Delete a report by id.
   * @param {string} id
   */
  deleteReport(id) {
    const items = this.getReports();
    this.set(this.KEYS.reports, items.filter((i) => i.id !== id));
  },

  // ---------- Seed data ----------

  /**
   * Initialize with seed data for a pet/AI self-media creator.
   */
  seedData() {
    const now = new Date().toISOString();

    // --- Today items (empty by default; user creates their own) ---
    const todayItems = [];

    // --- Content items ---
    const contentItems = this._seedContentItems();

    // --- Topics ---
    const topics = this._seedTopics();

    // --- Materials (3) ---
    const materials = [
      {
        id: this.genId(),
        name: '猫咪高清空镜素材包',
        type: 'video',
        desc: '日常拍摄的猫咪各种姿态高清素材，可用于混剪',
        tags: ['猫咪', '空镜', '素材'],
        createdAt: now,
      },
      {
        id: this.genId(),
        name: '治愈系BGM合集',
        type: 'audio',
        desc: '适合宠物类视频的背景音乐，轻快温馨风格',
        tags: ['BGM', '音乐', '治愈'],
        createdAt: now,
      },
      {
        id: this.genId(),
        name: '爆款标题词库',
        type: 'text',
        desc: '收集整理的宠物赛道高频爆款标题词汇和句式',
        tags: ['标题', '词库', '爆款'],
        createdAt: now,
      },
    ];

    // --- User inspirations (formerly inbox) ---
    const inboxItems = this._seedInspirations();

    // --- AI chat welcome message (1) ---
    const aiChat = [
      {
        id: this.genId(),
        role: 'bot',
        content:
          '你好，小冷！我是你的AI工作助手。可以帮你写文案、拆解爆款、分析选题、整理素材。有什么我能帮你的吗？',
        createdAt: now,
      },
    ];

    // --- Settings ---
    const settings = this._defaultSettings();

    // Save all
    this.set(this.KEYS.today, todayItems);
    this.set(this.KEYS.content, contentItems);
    this.set(this.KEYS.topics, topics);
    this.set(this.KEYS.materials, materials);
    this.set(this.KEYS.inbox, inboxItems);
    this.set(this.KEYS.links, []);
    this.set(this.KEYS.aiChat, aiChat);
    this.set(this.KEYS.aiNews, []);
    this.set(this.KEYS.hotTopics, []);
    this.set(this.KEYS.decomp, []);
    this.set(this.KEYS.mcnOutput, []);
    this.set(this.KEYS.videos, this._seedVideos());
    this.set(this.KEYS.reports, this._seedReports());
    this.set(this.KEYS.decomp, this._seedDecompRecords());
    this.setObject(this.KEYS.settings, settings);

    // Seed cache-based demo data
    const today = this.localDateStr();
    this.setObject('xl_today_inspiration_cache', { date: today, topics: this._seedTodayInspirations() });
    this.set(this.KEYS.aiNews, this._seedAINews());
    this.saveAINewsMeta({ lastFetch: new Date().toISOString(), count: 6 });
    this._seedHotTopicsCache();
  },

  /**
   * Generate sample video data for the data dashboard demo.
   * @returns {Array}
   */
  _seedVideos() {
    const now = new Date();
    const baseDate = (offsetDays) => {
      const d = new Date(now);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().slice(0, 10);
    };
    const batchTime = (offsetDays) => {
      const d = new Date(now);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString();
    };
    return [
      {
        id: this.genId(),
        title: '猫咪第一次见到雪的呆萌反应',
        publishDate: baseDate(2),
        platform: '抖音',
        duration: 32,
        views: 125000, likes: 8200, comments: 480, shares: 1200, favorites: 3600,
        completionRate: 68, bounce2sRate: 12, avgDuration: 22, completion5sRate: 85,
        avgPlayRatio: 68, notInterestedRate: 3,
        followGained: 320, followLost: 18, followGainRate: 1.2, followLossRate: 0.07,
        tags: ['猫咪', '萌宠', '下雪'],
        notes: '情感共鸣强，前3秒钩子效果好',
        createdAt: batchTime(0),
        updatedAt: batchTime(0),
      },
      {
        id: this.genId(),
        title: '狗子拆家现场实录 主人崩溃',
        publishDate: baseDate(5),
        platform: '抖音',
        duration: 45,
        views: 88000, likes: 5400, comments: 620, shares: 880, favorites: 2100,
        completionRate: 52, bounce2sRate: 18, avgDuration: 23, completion5sRate: 78,
        avgPlayRatio: 52, notInterestedRate: 5,
        followGained: 180, followLost: 22, followGainRate: 0.8, followLossRate: 0.1,
        tags: ['狗狗', '搞笑'],
        notes: '选题好但完播率偏低，内容略长',
        createdAt: batchTime(0),
        updatedAt: batchTime(0),
      },
      {
        id: this.genId(),
        title: '宠物医院日常 萌宠看病名场面',
        publishDate: baseDate(8),
        platform: '抖音',
        duration: 58,
        views: 210000, likes: 15600, comments: 1240, shares: 3200, favorites: 7800,
        completionRate: 71, bounce2sRate: 8, avgDuration: 41, completion5sRate: 92,
        avgPlayRatio: 71, notInterestedRate: 2,
        followGained: 580, followLost: 12, followGainRate: 2.1, followLossRate: 0.04,
        tags: ['萌宠', '医院', '治愈'],
        notes: '爆款！选题共鸣+长内容完播兼顾',
        createdAt: batchTime(0),
        updatedAt: batchTime(0),
      },
      {
        id: this.genId(),
        title: '流浪猫逆袭成胖橘 领养一年后',
        publishDate: baseDate(11),
        platform: '抖音',
        duration: 28,
        views: 156000, likes: 11200, comments: 890, shares: 2100, favorites: 4500,
        completionRate: 74, bounce2sRate: 10, avgDuration: 21, completion5sRate: 88,
        avgPlayRatio: 74, notInterestedRate: 2,
        followGained: 410, followLost: 14, followGainRate: 1.6, followLossRate: 0.05,
        tags: ['流浪猫', '领养', '治愈'],
        notes: '前后对比+故事线完整，互动率高',
        createdAt: batchTime(0),
        updatedAt: batchTime(0),
      },
      {
        id: this.genId(),
        title: '用AI给猫咪写一首歌 结果泪目',
        publishDate: baseDate(14),
        platform: '抖音',
        duration: 41,
        views: 95000, likes: 6800, comments: 520, shares: 1500, favorites: 2800,
        completionRate: 61, bounce2sRate: 14, avgDuration: 25, completion5sRate: 82,
        avgPlayRatio: 61, notInterestedRate: 4,
        followGained: 260, followLost: 19, followGainRate: 1.0, followLossRate: 0.07,
        tags: ['AI', '猫咪', '创意'],
        notes: 'AI+宠物跨界选题，收藏率不错',
        createdAt: batchTime(2),
        updatedAt: batchTime(2),
      },
      {
        id: this.genId(),
        title: '猫狗双全家庭的早晨有多混乱',
        publishDate: baseDate(17),
        platform: '抖音',
        duration: 36,
        views: 72000, likes: 4600, comments: 410, shares: 680, favorites: 1900,
        completionRate: 56, bounce2sRate: 16, avgDuration: 20, completion5sRate: 79,
        avgPlayRatio: 56, notInterestedRate: 4,
        followGained: 150, followLost: 25, followGainRate: 0.7, followLossRate: 0.12,
        tags: ['猫狗双全', '日常'],
        notes: '内容轻松但缺乏高潮，完播率一般',
        createdAt: batchTime(2),
        updatedAt: batchTime(2),
      },
      {
        id: this.genId(),
        title: '铲屎官出差三天 猫咪反应太真实',
        publishDate: baseDate(20),
        platform: '抖音',
        duration: 50,
        views: 185000, likes: 13400, comments: 1100, shares: 2800, favorites: 6200,
        completionRate: 69, bounce2sRate: 11, avgDuration: 35, completion5sRate: 86,
        avgPlayRatio: 69, notInterestedRate: 3,
        followGained: 510, followLost: 16, followGainRate: 1.9, followLossRate: 0.06,
        tags: ['猫咪', '情感', '日常'],
        notes: '情感共鸣强，评论区互动质量高',
        createdAt: batchTime(2),
        updatedAt: batchTime(2),
      },
      {
        id: this.genId(),
        title: '新手养猫第一周 我踩了这些坑',
        publishDate: baseDate(23),
        platform: '抖音',
        duration: 55,
        views: 112000, likes: 7900, comments: 740, shares: 1300, favorites: 5100,
        completionRate: 64, bounce2sRate: 13, avgDuration: 35, completion5sRate: 84,
        avgPlayRatio: 64, notInterestedRate: 3,
        followGained: 340, followLost: 20, followGainRate: 1.3, followLossRate: 0.08,
        tags: ['新手', '养猫', '干货'],
        notes: '干货型内容收藏率高，适合系列化',
        createdAt: batchTime(2),
        updatedAt: batchTime(2),
      },
    ];
  },

  /**
   * Sample content items for preview.
   */
  _seedContentItems() {
    const now = new Date().toISOString();
    return [
      {
        id: this.genId(),
        title: '【猫咪ASMR】沉浸式干饭日常',
        type: 'script',
        status: 'editing',
        platform: '抖音',
        content: '开头：猫咪特写，咀嚼声放大\n中间：慢动作吃饭画面\n结尾：满足地舔爪子，配上"吃饱喝足"字幕',
        tags: ['猫咪', 'ASMR', '治愈'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: this.genId(),
        title: '养猫新手必看的5个误区',
        type: 'script',
        status: 'published',
        platform: '小红书',
        content: '很多新手铲屎官容易犯的5个错误：1.频繁洗澡 2.喂牛奶 3.用人洗发水 4.忽视驱虫 5.过度喂食。附正确做法和避坑清单。',
        tags: ['养猫', '新手', '科普'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: this.genId(),
        title: 'AI工具让自媒体效率翻倍',
        type: 'idea',
        status: 'draft',
        platform: '抖音',
        content: '分享我日常使用的AI工具：DeepSeek写文案、剪映AI剪辑、零一拆解爆款、Notion管理选题。附具体 workflow。',
        tags: ['AI', '效率', '自媒体'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: this.genId(),
        title: '宠物赛道爆款标题模板20条',
        type: 'copy',
        status: 'idea',
        platform: '小红书',
        content: '1. 养猫前没人告诉我这X件事\n2. 猫咪出现这个动作，说明它...\n3. 挑战全网最...的猫\n4. 月入X万的宠物博主都在用...',
        tags: ['标题', '模板', '宠物'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: this.genId(),
        title: '宠物食品广告脚本（猫粮合作）',
        type: 'script',
        status: 'draft',
        platform: '抖音',
        content: '开场：展示猫咪挑食难题\n中段：引入猫粮，成分解读+试吃实拍\n结尾：引导评论区互动"你家猫挑食吗"',
        tags: ['广告', '猫粮', '脚本'],
        createdAt: now,
        updatedAt: now,
      },
    ];
  },

  /**
   * Sample topics for preview.
   */
  _seedTopics() {
    const now = new Date().toISOString();
    return [
      {
        id: this.genId(),
        title: '猫咪情绪解读：尾巴会说话',
        desc: '通过猫咪尾巴的不同姿态解读情绪状态，科普+趣味结合',
        score: 8.5,
        status: 'planning',
        tags: ['猫咪', '科普', '趣味'],
        angles: ['漫画图解风格', '真人配音+猫咪实拍', '互动测试形式'],
        createdAt: now,
      },
      {
        id: this.genId(),
        title: 'AI生成宠物拟人对话视频',
        desc: '用AI工具让宠物开口说话，制作趣味对话短视频',
        score: 9,
        status: 'idea',
        tags: ['AI', '创意', '趣味'],
        angles: ['猫咪吐槽铲屎官', '宠物开会讨论', '猫咪内心独白'],
        createdAt: now,
      },
      {
        id: this.genId(),
        title: '月入过万的宠物自媒体变现路径',
        desc: '拆解宠物赛道的几种主流变现方式及实操经验',
        score: 7.5,
        status: 'done',
        tags: ['变现', '经验', '干货'],
        angles: ['广告接单', '带货分佣', '知识付费'],
        createdAt: now,
      },
      {
        id: this.genId(),
        title: '10款平价猫粮横评',
        desc: '评测10款百元内猫粮，给出性价比排名和成分分析',
        score: 8,
        status: 'idea',
        tags: ['猫粮', '评测', '干货'],
        angles: ['成分对比表格', '试吃反应实拍', '兽医专业点评'],
        createdAt: now,
      },
    ];
  },

  /**
   * Sample user inspirations for preview.
   */
  _seedInspirations() {
    const now = new Date().toISOString();
    return [
      {
        id: this.genId(),
        title: '猫咪为什么喜欢纸箱',
        text: '做一期"猫咪为什么喜欢纸箱"的视频，评论区好多人问',
        desc: '可以从猫咪行为学角度解释，结合趣味实验',
        tags: ['猫咪', '行为', '趣味'],
        type: 'idea',
        createdAt: now,
        processed: false,
      },
      {
        id: this.genId(),
        title: '宠物食品广告合作',
        text: '回复小红书宠物食品广告合作私信',
        desc: '注意确认对方品牌资质和报价区间',
        tags: ['商务', '小红书'],
        type: 'idea',
        createdAt: now,
        processed: false,
      },
      {
        id: this.genId(),
        title: '竞品爆款视频参考',
        text: 'https://www.douyin.com/video/example - 竞品爆款视频参考',
        desc: '分析其开场和节奏，用于后续选题借鉴',
        tags: ['竞品', '抖音'],
        type: 'idea',
        createdAt: now,
        processed: false,
      },
    ];
  },

  /**
   * Sample decomposition records for preview.
   */
  _seedDecompRecords() {
    const now = new Date().toISOString();
    return [
      {
        id: this.genId(),
        videoTitle: '【爆款拆解】猫咪第一次见雪：情绪共鸣+反差萌',
        videoUrl: 'https://www.douyin.com/video/example-snow-cat',
        script: '（画面：窗外飘雪，猫咪蹲在窗台上，瞳孔放大）\n主人：下雪了，你要不要出去看看？\n（门打开，猫咪小心翼翼踩到雪地，瞬间弹起）\n（猫咪在雪地里蹦跳，留下小梅花印）\n主人：你不是怕冷吗？\n（猫咪回头一脸懵）\n字幕：南方的猫第一次见雪。',
        platform: '抖音',
        goal: '挂车成交',
        desc: '32秒，情绪共鸣强，评论区高频词"可爱""想养"',
        data: { spend: 0, impressions: 145000, ctr: 2.8, cvr: 0, roi: 0, completionRate: 68 },
        report: `## 一、视频概览\n- 标题利用"第一次"+"呆萌反应"制造期待，平台抖音，目标定位为情绪共鸣型内容。\n- 核心策略：用猫咪的"反差萌"（高冷→惊恐→好奇）制造情绪起伏。\n\n## 二、结构分段拆解\n1. **0-3秒 钩子**：窗外飘雪+猫咪瞳孔放大，配合主人问话，制造悬念。\n2. **3-12秒 冲突**：门打开，猫咪踩雪瞬间弹起，形成视觉笑点。\n3. **12-25秒 展开**：猫咪在雪地蹦跳留下梅花印，展示可爱行为。\n4. **25-32秒 结尾**：主人吐槽+猫咪懵脸，强化反差萌。\n\n## 三、黄金3秒钩子分析\n- 钩子类型：情绪共鸣+视觉冲击。\n- 有效性：雪天场景本身具有氛围感，猫咪表情特写极具感染力。\n\n## 四、六维评分\n1. 选题度：9/10（季节热点+宠物赛道）\n2. 钩子力：8/10（画面+声音双重吸引）\n3. 结构力：8/10（起承转合清晰）\n4. 情绪力：9/10（萌+反差+温馨）\n5. 信息量：6/10（偏娱乐，信息密度低）\n6. 互动性：8/10（评论区易引发"想养猫"共鸣）\n\n## 五、可借鉴策略\n- **季节热点+宠物反应**：逢节气/天气变化时拍摄宠物第一次体验。\n- **特写+配音吐槽**：用主人配音解释画面，降低理解成本。\n- **结尾留白**：用猫咪表情收尾，适合制作系列内容。`,
        status: 'analyzed',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: this.genId(),
        videoTitle: '【爆款拆解】流浪猫逆袭成胖橘：故事型内容',
        videoUrl: 'https://www.douyin.com/video/example-rescue-cat',
        script: '（黑屏字幕：2023年冬天，我在垃圾桶旁捡到它）\n（画面：瘦骨嶙峋的小猫）\n（转场：一年的猫粮+呵护）\n（画面：现在圆润可爱的橘猫）\n字幕：被爱真的会疯狂长出血肉。',
        platform: '抖音',
        goal: '直播间引流',
        desc: '28秒，前后对比+情感升华，适合领养日/公益活动',
        data: { spend: 800, impressions: 210000, ctr: 3.1, cvr: 1.2, roi: 2.1, completionRate: 74 },
        report: `## 一、视频概览\n- 标题采用"逆袭"关键词，配合前后对比画面，具有强情绪感染力。\n- 核心策略：用时间线叙事+情感金句实现传播。\n\n## 二、结构分段拆解\n1. **0-3秒 背景交代**：黑屏字幕建立故事感。\n2. **3-10秒 困境展示**：瘦小猫画面激发同情心。\n3. **10-20秒 转折成长**：快速展示一年变化。\n4. **20-28秒 情感升华**：金句收尾，引发转发。\n\n## 三、黄金3秒钩子分析\n- 钩子类型：故事悬念+情感共鸣。\n- 有效性：黑屏字幕+"捡到它"迅速建立人物关系和叙事期待。\n\n## 四、六维评分\n1. 选题度：8/10（领养/公益话题 evergreen）\n2. 钩子力：9/10（故事型开头强）\n3. 结构力：8/10（时间线清晰）\n4. 情绪力：9/10（感动+治愈）\n5. 信息量：7/10（传递"领养代替购买"理念）\n6. 互动性：9/10（易引发评论和转发）\n\n## 五、可借鉴策略\n- **前后对比+时间线**：适用于成长、改造、学习等主题。\n- **金句收尾**：一句高共鸣文案提升转发率。\n- **公益属性**：适合品牌合作和直播间引流。`,
        status: 'analyzed',
        createdAt: now,
        updatedAt: now,
      },
    ];
  },

  /**
   * Sample weekly reports for preview.
   */
  _seedReports() {
    const now = new Date().toISOString();
    return [
      {
        id: this.genId(),
        type: 'weekly',
        title: '第32周数据诊断报告',
        period: '2026-08-03 ~ 2026-08-09',
        content: JSON.stringify({
          overview: {
            highlight: '本周发布8条视频，总播放量突破95万，其中《宠物医院日常》单条播放量21万成为本周爆款。整体完播率稳定在64%，吸粉表现良好。',
            totalViews: '95.3万',
            totalLikes: '7.2万',
            totalFollowGained: '2840',
            avgCompletionRate: '64.4%',
            performanceLevel: '优秀',
          },
          bestVideo: {
            title: '宠物医院日常 萌宠看病名场面',
            reason: '1. 选题具有强共鸣：宠物看病是养宠人共同经历；2. 完播率71%为本周最高；3. 5秒完播率92%，说明开头钩子极其有效；4. 评论区互动质量高，引发大量"同款经历"分享。',
          },
          worstVideo: {
            title: '猫狗双全家庭的早晨有多混乱',
            diagnosis: '完播率仅56%，2秒跳出率16%偏高。问题在于内容过于平淡，缺乏明确高潮和记忆点，且标题虽有"混乱"关键词但画面支撑不足。',
          },
          patterns: [
            { pattern: '情绪共鸣型内容表现稳定', explanation: '《见雪》《医院》《出差》三条情感向视频均进入本周TOP3，说明观众对能引发共情的宠物内容偏好明显。' },
            { pattern: '干货型内容收藏率高', explanation: '《新手养猫坑》收藏量5100，占点赞量的64%，说明实用价值内容具有长尾传播潜力。' },
          ],
          problems: [
            { problem: '部分视频前3秒吸引力不足', impact: '中高', rootCause: '日常记录类视频缺少明确的冲突或悬念设计，观众难以快速判断内容价值。' },
          ],
          nextWeekActions: [
            { action: '继续拍摄"第一次体验"系列', reason: '见雪视频验证该选题具有高互动性', expectedOutcome: '预计单条播放量可稳定在10万以上' },
            { action: '将干货内容系列化', reason: '新手养猫坑收藏率高，适合建立账号专业人设', expectedOutcome: '提升粉丝粘性和搜索流量' },
            { action: '优化日常类视频的开头设计', reason: '降低2秒跳出率', expectedOutcome: '将整体完播率提升至68%以上' },
          ],
          keyInsight: '本周数据证明：宠物赛道中，"情绪共鸣+故事线"的内容最容易破圈，而干货型内容则是稳定的涨粉和收藏来源。建议下周采用"3条情绪向+2条干货向"的内容配比。',
        }),
        videoIds: [],
        stats: { videoCount: 8, totalViews: 953000, totalLikes: 72000, followGained: 2840 },
        createdAt: now,
      },
    ];
  },

  /**
   * Sample AI-generated daily inspirations for preview.
   */
  _seedTodayInspirations() {
    return [
      {
        title: '猫咪版《甄嬛传》：后宫争宠日常',
        opening: '画面：两只猫一左一右盯着主人，字幕"陛下，该翻牌子了"',
        summary: '用宫斗剧口吻拍摄多猫家庭的日常，给每只猫设定人设（贵妃、答应、皇后），通过争宠、吃醋、联手等情节制造笑点，结尾引导评论区"你家猫是什么位份"。',
        ending: '点赞过万出续集：猫咪宫斗第二集。',
        keywords: ['多猫家庭', '拟人', '宫斗', '互动'],
      },
      {
        title: '挑战用AI预测我家猫明天的心情',
        opening: '画面：猫咪当前表情特写，字幕"AI说，你明天会生气"',
        summary: '结合AI热点，用手机APP或ChatGPT生成"猫咪明日运势"，拍摄主人根据运势安排一天的活动，制造反差和趣味，适合蹭AI话题热度。',
        ending: '评论区留下你家猫的照片，AI帮你测运势。',
        keywords: ['AI', '预测', '互动', '热点'],
      },
      {
        title: '养猫人才懂的10个崩溃瞬间',
        opening: '画面：凌晨3点，猫在主人生物钟上蹦迪，字幕"哪个养猫人没经历过"',
        summary: '盘点养猫过程中的高频崩溃场景：凌晨跑酷、水杯被推、键盘被踩、窗帘被抓等，用快节奏剪辑+共鸣文案，引发评论区"太真实了"互动。',
        ending: '中了几条？评论区见。',
        keywords: ['养猫', '崩溃', '共鸣', '盘点'],
      },
      {
        title: '给流浪猫拍一组"证件照"',
        opening: '画面：流浪猫被救助后整洁可爱的正面照，字幕"原来被爱真的会发光"',
        summary: '延续流浪猫逆袭选题，拍摄救助前后对比+正式"证件照"，传递领养代替购买理念，公益属性强，易获得平台流量扶持和品牌合作机会。',
        ending: '愿每只流浪猫都能遇到心软的神。',
        keywords: ['流浪猫', '领养', '公益', '对比'],
      },
    ];
  },

  /**
   * Sample AI news items for preview.
   */
  _seedAINews() {
    const now = Date.now();
    return [
      {
        id: 'demo_ai_1',
        title: 'OpenAI 发布新一代多模态模型，支持视频理解',
        source: 'AI科技评论',
        summary: '新模型在视频内容理解、长上下文记忆和复杂推理方面有显著提升，对短视频创作者的内容分析和脚本生成有直接帮助。',
        url: 'https://example.com/ai-news-1',
        category: 'ai-models',
        publishedAt: now - 2 * 60 * 60 * 1000,
      },
      {
        id: 'demo_ai_2',
        title: '剪映上线AI智能剪辑助手，可自动生成口播字幕',
        source: '产品观察',
        summary: '新功能支持根据语音自动生成字幕、智能分段和节奏卡点，宠物类口播视频剪辑效率可提升50%以上。',
        url: 'https://example.com/ai-news-2',
        category: 'ai-products',
        publishedAt: now - 5 * 60 * 60 * 1000,
      },
      {
        id: 'demo_ai_3',
        title: '抖音算法更新：完播率和互动质量权重提升',
        source: '自媒体研究院',
        summary: '最新算法调整中，5秒完播率和评论深度成为核心指标，建议创作者优化前3秒钩子并设计评论区互动话术。',
        url: 'https://example.com/ai-news-3',
        category: 'industry',
        publishedAt: now - 8 * 60 * 60 * 1000,
      },
      {
        id: 'demo_ai_4',
        title: '研究显示：宠物类内容在短视频平台仍处增长期',
        source: '行业报告',
        summary: '2026年上半年宠物赛道内容消费增长23%，其中"救助逆袭""科普干货""拟人对话"三类增速最快。',
        url: 'https://example.com/ai-news-4',
        category: 'paper',
        publishedAt: now - 12 * 60 * 60 * 1000,
      },
      {
        id: 'demo_ai_5',
        title: '一人MCN工作流：如何用AI完成选题到发布',
        source: '创作方法论',
        summary: '从热点监控、选题生成、脚本撰写、封面标题到数据分析，全流程AI工具组合方案，适合个人创作者降本增效。',
        url: 'https://example.com/ai-news-5',
        category: 'tip',
        publishedAt: now - 18 * 60 * 60 * 1000,
      },
      {
        id: 'demo_ai_6',
        title: '小红书宠物赛道爆款标题公式盘点',
        source: '运营笔记',
        summary: '总结20个高互动宠物类标题模板，涵盖悬念型、共鸣型、干货型和反常识型，可直接套用。',
        url: 'https://example.com/ai-news-6',
        category: 'tip',
        publishedAt: now - 22 * 60 * 60 * 1000,
      },
    ];
  },

  /**
   * Seed hot topic caches (platform + AI/pet generated).
   */
  _seedHotTopicsCache() {
    const now = Date.now();
    const platforms = ['douyin', 'weibo', 'xiaohongshu', 'bili', 'toutiao'];
    const platformNames = { douyin: '抖音', weibo: '微博', xiaohongshu: '小红书', bili: 'B站', toutiao: '头条' };
    const sampleTitles = {
      douyin: ['普通人都在用的AI办公神器', '打工人高效摸鱼小技巧', 'AI绘画一键生成头像', '通勤路上听的播客推荐', '周末citywalk路线攻略'],
      weibo: ['今年最火的生活方式', '年轻人开始反向消费', '居家收纳的隐藏技巧', '国产AI工具横评', '健康饮食打卡第30天'],
      xiaohongshu: ['新手必看的效率工具', '平价好物真实测评', '通勤穿搭分享', '小户型收纳技巧', '手机摄影构图教程'],
      bili: ['半年存下第一桶金', '时间管理实操记录', '科普区百大UP主盘点', '数码好物开箱', '治愈向Vlog日常'],
      toutiao: ['普通人一年能存多少钱', 'AI行业新趋势', '常见疾病预防指南', '智能设备选购推荐', '职场技能提升路线'],
    };

    platforms.forEach((p) => {
      const items = (sampleTitles[p] || []).map((title, idx) => ({
        title,
        url: `https://www.example.com/search?q=${encodeURIComponent(title)}`,
        heat: Math.floor(500000 + Math.random() * 4500000),
        rank: idx + 1,
      }));
      localStorage.setItem(`xl_hot_topics_cache_${p}`, JSON.stringify({ items, update_time: 'AI 生成示例', _ts: now }));
    });

    // AI热点缓存
    localStorage.setItem('xl_ai_hot_topics_cache_ai', JSON.stringify({
      trends: [
        {
          title: 'AI办公提效',
          tag: '爆款潜力',
          tagColor: '#D4A5FF',
          summary: '用AI写周报、做PPT、整理会议纪要的内容在抖音和小红书持续走红，互动率高于平均水平3倍。',
          stats: [
            { label: '话题播放量', value: '12.8亿', desc: '抖音+小红书合计' },
            { label: '互动率', value: '8.5%', desc: '高于科技赛道均值' },
          ],
          topics: [
            { hashtag: '#AI办公神器', heat: '393.9万', platform: '抖音', period: '2026年8月' },
            { hashtag: '#打工人AI攻略', heat: '210.5万', platform: '小红书', period: '2026年8月' },
            { hashtag: '#AI效率工具', heat: '156.2万', platform: 'B站', period: '2026年8月' },
          ],
        },
        {
          title: 'AI绘画头像',
          tag: '新工具红利',
          tagColor: '#A0E8AF',
          summary: 'AI绘图工具让普通用户也能生成专属拟人写真、职业照，带动一批"AI写真"内容爆发。',
          stats: [
            { label: '相关笔记', value: '4.2万', desc: '小红书近30天' },
            { label: '平均点赞', value: '1.2万', desc: '头部笔记均值' },
          ],
          topics: [
            { hashtag: '#AI写真头像', heat: '580.1万', platform: '小红书', period: '2026年8月' },
            { hashtag: '#AI绘画教程', heat: '320.7万', platform: '抖音', period: '2026年8月' },
          ],
        },
      ],
      _ts: now,
    }));

    // 生活热点缓存
    localStorage.setItem('xl_ai_hot_topics_cache_life', JSON.stringify({
      trends: [
        {
          title: '反向消费',
          tag: '情感爆款',
          tagColor: '#FFB6C1',
          summary: '年轻人不再盲目追求大牌，转向性价比与情绪价值，"只买对的"成为高传播金句。',
          stats: [
            { label: '周播放量', value: '28.5亿', desc: '抖音单平台' },
            { label: '转发率', value: '6.2%', desc: '高于均值2倍' },
          ],
          topics: [
            { hashtag: '#反向消费', heat: '892.3万', platform: '抖音', period: '2026年8月' },
            { hashtag: '#理性种草', heat: '456.8万', platform: '小红书', period: '2026年8月' },
            { hashtag: '#我的省钱日常', heat: '312.4万', platform: 'B站', period: '2026年8月' },
          ],
        },
        {
          title: '居家收纳干货',
          tag: '长尾需求',
          tagColor: '#FFD66B',
          summary: '小户型收纳、桌面整理等实用科普内容搜索量上升，收藏率表现突出。',
          stats: [
            { label: '搜索增速', value: '+34%', desc: '近7天环比' },
            { label: '收藏率', value: '18.5%', desc: '远高于娱乐内容' },
          ],
          topics: [
            { hashtag: '#收纳避坑', heat: '267.5万', platform: '抖音', period: '2026年8月' },
            { hashtag: '#小户型改造', heat: '198.3万', platform: '小红书', period: '2026年8月' },
          ],
        },
      ],
      _ts: now,
    }));
  },

  // ---------- 云端同步（Supabase，仅 anon key + RLS）----------

  _shouldSync(key) {
    return this.SYNC_BUCKETS.indexOf(key) >= 0 && this.isCloud();
  },

  // 单 bucket 后台异步推送（fire-and-forget，不阻塞 UI）
  _pushBucket(key, items) {
    if (!window.SBData) return;
    window.SBData.upsertAll(key, items).catch(function (e) {
      console.warn('[Store] 云端同步失败 bucket=' + key + ':', e);
    });
  },

  /**
   * 登录后同步：以云端为权威，首次把本地数据上传。
   * 规则：云端空且本地有 → 上传本地；云端有 → 下载覆盖本地。
   */
  async syncAfterLogin() {
    if (!this.isCloud()) return;
    for (let i = 0; i < this.SYNC_BUCKETS.length; i++) {
      const key = this.SYNC_BUCKETS[i];
      try {
        const local = this.get(key);
        const cloud = await window.SBData.list(key);
        if (cloud.length === 0 && local.length > 0) {
          await window.SBData.upsertAll(key, local);
        } else if (cloud.length > 0) {
          this.set(key, cloud);
        }
      } catch (e) {
        console.warn('[Store] syncAfterLogin bucket=' + key + ' 失败:', e);
      }
    }
    // settings
    try {
      const cloud = await window.SBData.getSettings();
      if (cloud && Object.keys(cloud).length) {
        this.setObject(this.KEYS.settings, cloud);
      } else {
        await window.SBData.saveSettings(this.getObject(this.KEYS.settings));
      }
    } catch (e) {
      console.warn('[Store] settings 同步失败:', e);
    }
  },

  // 强制把本地全部数据上传云端（手动触发 / 首次迁移）
  async pushAllToCloud() {
    if (!this.isCloud()) return false;
    for (let i = 0; i < this.SYNC_BUCKETS.length; i++) {
      const key = this.SYNC_BUCKETS[i];
      try { await window.SBData.upsertAll(key, this.get(key)); } catch (e) { /* ignore */ }
    }
    try { await window.SBData.saveSettings(this.getObject(this.KEYS.settings)); } catch (e) {}
    return true;
  },

  // 从云端拉取全部覆盖本地（换设备 / 换号后）
  async pullFromCloud() {
    if (!this.isCloud()) return;
    for (let i = 0; i < this.SYNC_BUCKETS.length; i++) {
      const key = this.SYNC_BUCKETS[i];
      try {
        const cloud = await window.SBData.list(key);
        this.set(key, cloud);
      } catch (e) { /* ignore */ }
    }
    try {
      const cloud = await window.SBData.getSettings();
      if (cloud) this.setObject(this.KEYS.settings, cloud);
    } catch (e) {}
  },

  // 别名：首次迁移本地数据到云端
  migrateLocalToSupabase() { return this.pushAllToCloud(); },

};

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
if (typeof window !== 'undefined') {
  window.Store = Store;
}
