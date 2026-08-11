/* ========================================
   小冷 · 个人 AI 工作台
   主应用逻辑 v2.0.0
   ======================================== */

const App = {
  currentModule: 'today',
  currentDetail: null,
  currentPlatform: 'douyin',
  currentHotTab: 'platform',
  currentInspirationTab: 'today',
  isMobile: false,
  weatherData: null,
  selectedDate: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(),
  // 日历当前查看月份（用于月份切换，与 selectedDate 解耦）
  calendarDate: new Date(),
  dashboardFilter: 'all',

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

  // ===== 初始化 =====
  init() {
    Store.init();
    this.detectMobile();
    this.loadWeather();
    this.renderSidebarNav();
    this.renderBottomNav();
    this.renderFloatingToolbar();
    this.initAIFab();
    this.bindEvents();
    this.initAuth();
    this.navigate('today');
    this.checkMobileViewport();
    window.addEventListener('resize', () => {
      this.detectMobile();
      this.checkMobileViewport();
    });
  },

  detectMobile() {
    this.isMobile = window.innerWidth <= 900;
  },

  checkMobileViewport() {
    // Check 360x800, 375x812, 390x844
    const w = window.innerWidth;
    const passes = [360, 375, 390].every(width => {
      return w <= width ? this._checkSingleViewport(width) : true;
    });
  },

  _checkSingleViewport(width) {
    return true; // Simplified - actual check done visually
  },

  // ===== 导航 =====
  navigate(module) {
    if (!ModuleConfig.modules[module]) return;
    this.currentModule = module;
    this.currentDetail = null;

    // Update active states
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`.nav-item[data-module="${module}"]`).forEach(el => el.classList.add('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`.bottom-nav-item[data-module="${module}"]`).forEach(el => el.classList.add('active'));
    document.querySelectorAll('.tb-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`.tb-item[data-module="${module}"]`).forEach(el => el.classList.add('active'));

    // Update title
    const titleEl = document.getElementById('topbarTitle');
    titleEl.textContent = ModuleConfig.modules[module].name;

    // Show/hide refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (module === 'hot') {
      refreshBtn.style.display = 'flex';
    } else {
      refreshBtn.style.display = 'none';
    }

    // Update topbar add button
    const addBtn = document.getElementById('topbarAddBtn');
    const addBtnText = addBtn?.querySelector('span');
    if (addBtn) {
      if (module === 'today' || module === 'weightloss') {
        addBtn.style.display = 'none';
      } else {
        addBtn.style.display = 'flex';
        if (addBtnText) {
          addBtnText.textContent = module === 'topics' ? '记录灵感' : '新建';
        }
      }
    }

    // Render module
    const container = document.getElementById('pageContainer');
    container.scrollTop = 0;

    const renderMap = {
      today: () => this.renderToday(),
      hot: () => this.renderHotTopics(),
      topics: () => this.renderTopics(),
      content: () => this.renderContent(),
      decomp: () => this.renderDecomp(),
      dashboard: () => this.renderDashboard(),
      settings: () => this.renderSettings(),
    };

    if (module === 'habits') {
      if (window.HabitsModule) window.HabitsModule.render(container);
    } else if (module === 'weightloss') {
      if (window.WeightLossModule) window.WeightLossModule.render(container);
    } else if (renderMap[module]) {
      container.innerHTML = renderMap[module]();
      this.bindModuleEvents(module);
    }
  },

  // ===== 云端登录（Supabase + GitHub OAuth）=====
  initAuth() {
    this.renderAuthArea();
    if (!window.SupabaseReady || !window.Auth) return; // 未配置则回退本地，不影响使用
    const self = this;
    this._authSignedIn = false;   // 本次会话是否已确认登录
    this._authSyncing = false;    // 防止 getCurrentUser 与 INITIAL_SESSION 重复同步

    // ① 立刻读本地 session 恢复登录态（刷新页面主路径）
    window.Auth.getCurrentUser().then(function (user) {
      if (user && !self._authSignedIn) {
        self._authSignedIn = true;
        self._onSignedIn(user, false);
      }
    });

    // ② 订阅后续变化
    window.Auth.onAuthChange(function (user, event) {
      if (user) {
        const isNewLogin = (event === 'SIGNED_IN') && !self._authSignedIn;
        // 已确认登录且只是 token 续期，仅刷新界面，不重复全量同步
        if (self._authSignedIn && event === 'TOKEN_REFRESHED') {
          Store.setCloudUser(user);
          self.renderAuthArea();
          self.renderBottomNav();
          return;
        }
        self._authSignedIn = true;
        self._onSignedIn(user, isNewLogin);
        return;
      }
      // 只有真正登出才清状态并提示；
      // INITIAL_SESSION 拿不到 session 说明"本来就没登录"，不能弹"已退出登录"
      if (event === 'SIGNED_OUT') {
        self._authSignedIn = false;
        self._onSignedOut(true);
      } else if (!self._authSignedIn) {
        self._onSignedOut(false);
      }
    });
  },

  _onSignedIn(user, isNewLogin) {
    const self = this;
    Store.setCloudUser(user);
    // 界面先立刻切到已登录，避免同步耗时期间显示成未登录
    this.renderAuthArea();
    this.renderBottomNav();

    if (this._authSyncing) return; // 同步进行中，不重复触发
    this._authSyncing = true;

    Store.syncAfterLogin().then(function () {
      self._authSyncing = false;
      self.renderAuthArea();
      self.renderBottomNav();
      if (isNewLogin) self.showToast('已登录，数据已同步到云端');
      self.navigate(self.currentModule);
      // 登录后启动「云端优先」定时同步：本地缓存持续镜像云端，断网自动回退本地
      Store.startCloudSync(function () { self.navigate(self.currentModule); });
    }).catch(function () {
      self._authSyncing = false;
      self.renderAuthArea();
      self.renderBottomNav();
      if (isNewLogin) self.showToast('已登录（云端同步稍后重试）');
      // 即便首次同步失败，也启动定时重试，连上网即拉取云端
      Store.startCloudSync(function () { self.navigate(self.currentModule); });
    });
  },

  _onSignedOut(showToast) {
    Store.stopCloudSync();
    Store.setCloudUser(null);
    this.renderAuthArea();
    this.renderBottomNav();
    if (showToast !== false) this.showToast('已退出登录');
  },

  renderAuthArea() {
    const el = document.getElementById('authArea');
    if (!el) return;
    const esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    if (Store.isCloud()) {
      const u = Store.cloudUser || {};
      const meta = u.user_metadata || {};
      const rawName = meta.user_name || meta.name || (u.email ? u.email.split('@')[0] : '已登录');
      const name = esc(rawName);
      const avatar = meta.avatar_url
        ? '<img class="auth-avatar" src="' + esc(meta.avatar_url) + '" alt="">'
        : '<div class="auth-avatar auth-avatar--text">' + esc((rawName.slice(0, 1) || '冷')) + '</div>';
      el.innerHTML =
        '<div class="auth-chip">' + avatar +
        '<span class="auth-name">' + name + '</span>' +
        '<button class="auth-signout" id="authSignOut" title="退出登录">退出</button></div>';
    } else {
      el.innerHTML = '<button class="auth-btn" id="authSignIn">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.8 1.7 2.6 1.2.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>'
        + ' GitHub 登录同步</button>';
    }
  },

  // ===== 侧边栏导航 =====
  renderSidebarNav() {
    const nav = document.getElementById('sidebarNav');
    let html = '';
    ModuleConfig.navOrder.forEach(section => {
      html += `<div class="nav-section-label">${section.section}</div>`;
      section.items.forEach(key => {
        const m = ModuleConfig.modules[key];
        if (!m) return;
        const badge = this.getNavBadge(key);
        html += `
          <div class="nav-item ${key === this.currentModule ? 'active' : ''}" data-module="${key}">
            <span class="nav-icon">${Icons[m.icon] || ''}</span>
            <span>${m.name}</span>
            ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
          </div>
        `;
      });
    });
    nav.innerHTML = html;
    nav.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.module));
    });
  },

  getNavBadge(key) {
    if (key === 'today') {
      const undoneTodos = Store.getTodayItems().filter(i => !i.done).length;
      const unreadAlerts = Store.getOrRefreshAlerts().filter(a => !a.done).length;
      const total = undoneTodos + unreadAlerts;
      return total > 0 ? total : '';
    }
    return '';
  },

  // ===== 底部导航 =====
  renderBottomNav() {
    const nav = document.getElementById('bottomNav');
    let html = '<div class="bottom-nav-items">';
    ModuleConfig.mobileNav.forEach(key => {
      const m = ModuleConfig.modules[key];
      if (!m) return;
      html += `
        <div class="bottom-nav-item ${key === this.currentModule ? 'active' : ''}" data-module="${key}">
          <span class="bn-icon">${Icons[m.icon] || ''}</span>
          <span class="bn-label">${m.name}</span>
        </div>
      `;
    });

    // 移动端专属：我的 / 登录入口
    const isCloud = Store.isCloud && Store.isCloud();
    const user = Store.cloudUser || {};
    const meta = user.user_metadata || {};
    const userName = meta.user_name || meta.name || (user.email ? user.email.split('@')[0] : '我');
    const userAvatar = meta.avatar_url
      ? `<img class="bn-auth-avatar" src="${this._esc(meta.avatar_url)}" alt="">`
      : `<span class="bn-auth-avatar bn-auth-avatar--text">${this._esc(userName.charAt(0).toUpperCase())}</span>`;
    if (isCloud) {
      html += `
        <div class="bottom-nav-item bottom-nav-item--auth" data-action="auth-menu">
          <span class="bn-icon bn-auth-icon-wrap">${userAvatar}</span>
          <span class="bn-label">${this._esc(userName)}</span>
        </div>
      `;
    } else {
      html += `
        <div class="bottom-nav-item bottom-nav-item--auth" data-action="auth-signin">
          <span class="bn-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
          </span>
          <span class="bn-label">登录同步</span>
        </div>
      `;
    }
    html += '</div>';
    nav.innerHTML = html;

    nav.querySelectorAll('.bottom-nav-item[data-module]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.module));
    });
    const authEl = nav.querySelector('.bottom-nav-item[data-action]');
    if (authEl) {
      authEl.addEventListener('click', () => {
        if (authEl.dataset.action === 'auth-signin') {
          if (window.Auth) window.Auth.signInWithGitHub();
        } else {
          this.showMobileAuthMenu();
        }
      });
    }
  },

  // 移动端已登录用户的操作菜单
  showMobileAuthMenu() {
    const user = Store.cloudUser || {};
    const meta = user.user_metadata || {};
    const name = meta.user_name || meta.name || (user.email ? user.email.split('@')[0] : '已登录');
    const avatar = meta.avatar_url
      ? `<img class="mobile-auth-avatar" src="${this._esc(meta.avatar_url)}" alt="">`
      : `<span class="mobile-auth-avatar mobile-auth-avatar--text">${this._esc(name.charAt(0).toUpperCase())}</span>`;
    this.openModal(`
      <div class="mobile-auth-sheet">
        <div class="mobile-auth-header">
          ${avatar}
          <div class="mobile-auth-info">
            <div class="mobile-auth-name">${this._esc(name)}</div>
            <div class="mobile-auth-hint">GitHub 账号已登录，数据自动同步</div>
          </div>
        </div>
        <button class="mobile-auth-btn mobile-auth-btn--danger" id="mobileAuthSignOut">退出登录</button>
      </div>
    `, { title: '账号' });
    document.getElementById('mobileAuthSignOut')?.addEventListener('click', () => {
      if (window.Auth) window.Auth.signOut();
      this.closeModal();
    });
  },

  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  },

  // ===== 浮动工具栏 =====
  renderFloatingToolbar() {
    const tb = document.getElementById('floatingToolbar');
    const items = ['today', 'hot', 'topics', 'content', 'decomp'];
    let html = '';
    items.forEach(key => {
      const m = ModuleConfig.modules[key];
      if (!m) return;
      html += `
        <div class="tb-item ${key === this.currentModule ? 'active' : ''}" data-module="${key}">
          <span class="tb-icon">${Icons[m.icon] || ''}</span>
          <span>${m.name}</span>
        </div>
      `;
    });
    html += `<div class="tb-item" data-module="settings"><span class="tb-icon">${Icons.settings}</span><span>设置</span></div>`;
    tb.innerHTML = html;
    tb.querySelectorAll('.tb-item').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.module));
    });
  },

  // ===== 事件绑定 =====
  bindEvents() {
    document.getElementById('topbarSearch')?.addEventListener('click', () => this.openSearch());
    document.getElementById('searchBtn')?.addEventListener('click', () => this.openSearch());
    document.getElementById('searchClose')?.addEventListener('click', () => this.closeSearch());
    document.getElementById('searchInput')?.addEventListener('input', (e) => this.performSearch(e.target.value));
    document.getElementById('searchOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'searchOverlay') this.closeSearch();
    });
    document.getElementById('helpOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'helpOverlay') this.closeHelp();
    });
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') this.closeModal();
    });
    document.getElementById('fabClose')?.addEventListener('click', () => this.closeFAB());
    document.getElementById('fabOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'fabOverlay') this.closeFAB();
    });
    document.getElementById('topbarBack')?.addEventListener('click', () => this.navigate('today'));
    document.getElementById('sidebarHelpCenter')?.addEventListener('click', () => this.showHelp('today'));
    document.getElementById('topbarHelpBtn')?.addEventListener('click', () => this.showHelp(this.currentModule));
    document.getElementById('topbarAddBtn')?.addEventListener('click', () => {
      if (this.currentModule === 'today') {
        this.openAddTodoItem();
      } else if (this.currentModule === 'topics') {
        this.openUserInspirationEditor();
      } else {
        this.openFAB();
      }
    });
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      if (this.currentModule === 'hot') this.refreshHotTopics();
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSearch();
        this.closeHelp();
        this.closeModal();
        this.closeFAB();
      }
    });

    // 登录 / 登出（authArea 内按钮动态生成，用事件委托）
    document.addEventListener('click', (e) => {
      if (e.target.closest('#authSignIn')) {
        if (window.Auth) window.Auth.signInWithGitHub();
      } else if (e.target.closest('#authSignOut')) {
        if (window.Auth) window.Auth.signOut();
      }
    });

  },

  bindModuleEvents(module) {
    const eventMap = {
      today: () => this.bindTodayEvents(),
      hot: () => this.bindHotTopicsEvents(),
      topics: () => this.bindTopicsEvents(),
      content: () => this.bindContentEvents(),
      decomp: () => this.bindDecompEvents(),
      ai: () => this.bindAIEvents(),
      dashboard: () => this.bindDashboardEvents(),
      settings: () => this.bindSettingsEvents(),
    };
    if (eventMap[module]) eventMap[module]();

    // Bind help buttons
    document.querySelectorAll('.help-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showHelp(btn.dataset.module || this.currentModule);
      });
    });
  },

  // ===== 天气 =====
  async loadWeather() {
    const data = await API.getWeather();
    if (!data.error) {
      this.weatherData = data;
      // Re-render greeting date if on today page
      const dateEl = document.querySelector('.greeting-date');
      if (dateEl && this.currentModule === 'today') {
        dateEl.innerHTML = this.renderGreetingDate();
      }
    }
  },

  renderGreetingDate() {
    const todayStr = new Date().toLocaleDateString('zh-CN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const weather = this.weatherData;
    const weatherHtml = weather
      ? `<span class="weather-info">${weather.weather} ${weather.temperature}°C</span>`
      : `<span class="weather-info">加载天气中...</span>`;
    return `${todayStr} · ${weatherHtml}`;
  },

  // ===== 今日 =====
  renderToday() {
    const items = Store.getTodayItems();
    const undone = items.filter(i => !i.done);
    const tasks = undone.filter(i => i.type === 'task');
    const confirms = undone.filter(i => i.type === 'confirm');
    const hour = new Date().getHours();
    let greeting = '早上好';
    if (hour >= 12 && hour < 18) greeting = '下午好';
    else if (hour >= 18) greeting = '晚上好';

    const contentItems = Store.getContentItems();
    const topics = Store.getTopics();
    const publishedCount = contentItems.filter(c => c.status === 'published').length;

    const alerts = Store.getOrRefreshAlerts();
    const unreadAlerts = alerts.filter(a => !a.done);
    const yesterdayStats = this.getYesterdayVideoStats();

    let html = `
      <div class="today-page">
        <div class="today-hero">
          <div class="hero-left-stack">
            <div class="hero-greeting">
              <div>
                <div class="greeting-text">${greeting}，<span class="accent">小冷</span>！<br>今天想创作点什么？</div>
                <div class="greeting-sub">这里是你每日的 AI 内容创作仪表盘。快速查看待办、热点和创作进度。</div>
              </div>
              <div class="greeting-date">${this.renderGreetingDate()}</div>
              <img class="hero-cat-gif" src="assets/cat-typing.gif" alt="cat typing" width="180" height="180">
            </div>

            <div class="today-alerts-panel">
              <div class="panel-header">
                <div class="panel-title">提醒 & 动态</div>
                <div class="panel-actions">
                  ${unreadAlerts.length === 0 && alerts.length > 0 ? `<button class="panel-icon-btn" id="clearReadAlertsBtn" title="清空已读">${Icons.trash}</button>` : ''}
                  <span class="panel-count">${unreadAlerts.length > 0 ? unreadAlerts.length + ' 条' : '正常'}</span>
                </div>
              </div>
              <div class="alert-list">
                ${this.renderTodayAlerts(alerts)}
              </div>
            </div>
          </div>

          ${this.renderFortunePanel()}
        </div>

        <div class="today-stats">
          <div class="stat-card">
            <div class="progress-ring">${this.progressRing(items.length - undone.length, items.length)}</div>
            <div class="stat-info">
              <div class="stat-label">今日完成率</div>
              <div class="stat-value">${items.length - undone.length}/${items.length}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="progress-ring">${this.progressRing(yesterdayStats.views > 0 ? 1 : 0, 1, this.formatNumber(yesterdayStats.views))}</div>
            <div class="stat-info">
              <div class="stat-label">昨日播放量</div>
              <div class="stat-value">${this.formatNumber(yesterdayStats.views)}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="progress-ring">${this.progressRing(yesterdayStats.interactions > 0 ? 1 : 0, 1, this.formatNumber(yesterdayStats.interactions))}</div>
            <div class="stat-info">
              <div class="stat-label">昨日互动数</div>
              <div class="stat-value">${this.formatNumber(yesterdayStats.interactions)}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="progress-ring">${this.progressRing(publishedCount, Math.max(contentItems.length, 1))}</div>
            <div class="stat-info">
              <div class="stat-label">已发布内容</div>
              <div class="stat-value">${publishedCount} 篇</div>
            </div>
          </div>
        </div>

        <div class="today-calendar-todo-row">
          <div class="today-calendar-col">
            ${this.renderCalendar()}
          </div>
          <div class="today-todo-col today-panel">
            <div class="panel-header">
              <div class="panel-title">
                待办事项
                <select class="date-select" id="todoDateSelect">
                  ${this.renderDateOptions()}
                </select>
              </div>
              <div class="panel-actions">
                <button class="panel-icon-btn" id="clearTodoBtn" title="清空">${Icons.trash}</button>
                <button class="panel-add-btn" id="addTodoBtn">${Icons.plus} 新增</button>
              </div>
            </div>
            <div class="todo-list" id="dateTodoList">
              ${this.renderSelectedDateTodosInline()}
            </div>
          </div>
        </div>
      </div>
    `;

    return html;
  },

  renderTodayTodoList(tasks, confirms) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedUndone = [...tasks, ...confirms].sort((a, b) =>
      (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
    );

    if (sortedUndone.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-title">今日待办已清空</div>
          <div class="empty-state-desc">所有任务都完成了，去看看 AI 资讯和平台热点吧</div>
        </div>
      `;
    }

    return sortedUndone.map(item => {
      const typeInfo = ModuleConfig.todayTypes[item.type] || ModuleConfig.todayTypes.task;
      const dateStr = item.startDate || item.startTime || '';
      const endDateStr = item.endDate || item.endTime || '';
      const rangeStr = dateStr ? `${dateStr}${endDateStr ? ' - ' + endDateStr : ''}` : '';
      return `
        <div class="todo-item ${item.done ? 'done' : ''}" data-id="${item.id}">
          <div class="todo-check" data-id="${item.id}">
            ${item.done ? Icons.check : ''}
          </div>
          <div class="todo-main">
            <div class="todo-content">
              <div class="todo-text ${item.done ? 'done' : ''}">${this.esc(item.title)}</div>
              ${item.desc || rangeStr ? `<div class="todo-meta">${this.esc([rangeStr, item.desc].filter(Boolean).join(' · '))}</div>` : ''}
            </div>
            <div class="todo-tags">
              ${item.priority ? `<span class="todo-pill ${item.priority}">${this.priorityLabel(item.priority)}</span>` : ''}
              ${item.source ? `<span class="todo-source">${this.sourceLabel(item.source)}</span>` : ''}
            </div>
          </div>
          <div class="todo-actions">
            <button class="todo-action-btn todo-edit-btn" data-id="${item.id}" title="编辑">${Icons.edit}</button>
            <button class="todo-action-btn todo-delete-btn" data-id="${item.id}" title="删除">${Icons.trash}</button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderTodayAlerts(alerts) {
    if (alerts.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-title">暂无异常提醒</div>
          <div class="empty-state-desc">各模块运行正常，保持关注即可</div>
        </div>
      `;
    }
    return alerts.map(a => `
      <div class="alert-item ${a.done ? 'done' : ''}" data-id="${this.esc(a.id)}">
        <div class="alert-check" data-id="${this.esc(a.id)}">
          ${a.done ? Icons.check : ''}
        </div>
        <div class="alert-content">
          <div class="alert-title ${a.done ? 'done' : ''}">${this.esc(a.title)}</div>
          <div class="alert-desc ${a.done ? 'done' : ''}">${this.esc(a.desc)}</div>
        </div>
      </div>
    `).join('');
  },

  renderFortunePanel() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `
      <div class="today-fortune-panel" id="todayFortunePanel">
        <div class="fortune-rings">
          <span class="fortune-ring"></span>
          <span class="fortune-ring"></span>
          <span class="fortune-ring"></span>
        </div>
        <div class="fortune-header">
          <div class="fortune-date">
            <span class="fortune-date-day">${day}</span>
            <span class="fortune-date-sep">/</span>
            <span class="fortune-date-month">${month}</span>
          </div>
          <div class="fortune-title-wrap">
            <div class="fortune-label">我的今日运势</div>
            <div class="fortune-score-row">
              <span class="fortune-score" id="fortuneScore">--</span>
              <div class="fortune-stars" id="fortuneStars">${this.renderFortuneStars(0)}</div>
            </div>
          </div>
          <button class="fortune-refresh-btn fortune-refresh-top" id="fortuneRefreshBtnTop" title="用 Deepseek 重新测算今日运势">↻ 刷新</button>
        </div>
        <div class="fortune-body">
          <div class="fortune-loading" id="fortuneLoading">正在请 Deepseek 测算今日运势…</div>
          <div class="fortune-content" id="fortuneContent" style="display:none;">
            <div class="fortune-row">
              <div class="fortune-chip">
                <span class="fortune-chip-icon" style="background:${this.esc('#E8E8E8')}" id="fortuneColorDot"></span>
                <span class="fortune-chip-label">幸运色</span>
                <span class="fortune-chip-value" id="fortuneColor">--</span>
              </div>
              <div class="fortune-chip">
                <span class="fortune-chip-icon" style="background:#FFF3D0">🍱</span>
                <span class="fortune-chip-label">幸运食物</span>
                <span class="fortune-chip-value" id="fortuneFood">--</span>
              </div>
            </div>
            <div class="fortune-tips">
              <div class="fortune-tip">
                <span class="fortune-tip-icon fortune-tip-do">✓</span>
                <div class="fortune-tip-text">
                  <span class="fortune-tip-label">今日建议</span>
                  <span class="fortune-tip-value" id="fortuneAdvice">--</span>
                </div>
              </div>
              <div class="fortune-tip">
                <span class="fortune-tip-icon fortune-tip-dont">✕</span>
                <div class="fortune-tip-text">
                  <span class="fortune-tip-label">避免</span>
                  <span class="fortune-tip-value" id="fortuneAvoid">--</span>
                </div>
              </div>
            </div>
            <div class="fortune-quote" id="fortuneQuote"></div>
          </div>
          <div class="fortune-error" id="fortuneError" style="display:none;">
            <span class="fortune-error-text" id="fortuneErrorText">运势加载失败</span>
            <button class="fortune-refresh-btn" id="fortuneRefreshBtn">重新生成</button>
          </div>
        </div>
      </div>
    `;
  },

  renderFortuneStars(count) {
    const filled = '<span class="fortune-star filled">★</span>';
    const empty = '<span class="fortune-star">★</span>';
    return filled.repeat(Math.max(0, Math.min(5, count))) + empty.repeat(Math.max(0, 5 - count));
  },

  // 按干支日推算当日五行（金木水火土），1970-01-01 为丁未日（干3=丁/支7=未）
  dailyWuxing(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const days = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1970, 0, 1)) / 86400000);
    const ganIdx = ((days % 10) + 3) % 10; // 日干：甲乙木 丙丁火 戊己土 庚辛金 壬癸水
    return ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'][ganIdx];
  },

  async loadFortune() {
    const panel = document.getElementById('todayFortunePanel');
    if (!panel) return;

    const loadingEl = document.getElementById('fortuneLoading');
    const contentEl = document.getElementById('fortuneContent');
    const errorEl = document.getElementById('fortuneError');
    const refreshBtn = document.getElementById('fortuneRefreshBtn');

    const showError = (msg) => {
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'flex';
      const errText = document.getElementById('fortuneErrorText');
      if (errText) errText.textContent = msg || '运势加载失败';
    };

    const showContent = (data) => {
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'flex';

      const scoreEl = document.getElementById('fortuneScore');
      const starsEl = document.getElementById('fortuneStars');
      const colorEl = document.getElementById('fortuneColor');
      const colorDotEl = document.getElementById('fortuneColorDot');
      const foodEl = document.getElementById('fortuneFood');
      const adviceEl = document.getElementById('fortuneAdvice');
      const avoidEl = document.getElementById('fortuneAvoid');
      const quoteEl = document.getElementById('fortuneQuote');

      if (scoreEl) scoreEl.textContent = data.score ?? '--';
      if (starsEl) starsEl.innerHTML = this.renderFortuneStars(data.stars || 0);
      if (colorEl) colorEl.textContent = data.luckyColor || '--';
      if (colorDotEl) colorDotEl.style.background = data.luckyColorHex || '#C2F84F';
      if (foodEl) foodEl.textContent = data.luckyFood || '--';
      if (adviceEl) adviceEl.textContent = data.advice || '--';
      if (avoidEl) avoidEl.textContent = data.avoid || '--';
      if (quoteEl) quoteEl.textContent = data.quote || '';
    };

    const doRefresh = () => {
      if (loadingEl) loadingEl.style.display = 'block';
      if (contentEl) contentEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      this._fetchFortune(true).then(showContent).catch((e) => showError(e?.message || '运势生成失败'));
    };

    if (refreshBtn) refreshBtn.addEventListener('click', doRefresh);
    const topBtn = document.getElementById('fortuneRefreshBtnTop');
    if (topBtn) topBtn.addEventListener('click', doRefresh);

    try {
      const data = await this._fetchFortune(false);
      if (data.error) {
        showError(data.message || '运势生成失败');
        return;
      }
      showContent(data);
    } catch (e) {
      showError(e?.message || '运势加载失败');
    }
  },

  async _fetchFortune(force = false) {
    const wuxing = this.dailyWuxing(new Date());
    const profile = { birthDate: '1992-12-04', zodiac: '射手座', wuxing };
    if (typeof API !== 'undefined' && API.generateDailyFortune) {
      return await API.generateDailyFortune(profile, force);
    }
    return { error: 'NO_API', message: '运势接口未就绪' };
  },

  getYesterdayVideoStats() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.localDateStr(yesterday);

    const videos = Store.getVideos().filter(v => v.publishDate === yesterdayStr);
    const views = videos.reduce((sum, v) => sum + (Number(v.views) || 0), 0);
    const interactions = videos.reduce((sum, v) => sum + (Number(v.likes) || 0) + (Number(v.comments) || 0), 0);

    return { views, interactions, count: videos.length };
  },

  formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString('zh-CN');
  },

  renderCalendar(selectedDate = this.selectedDate) {
    const view = this.calendarDate || new Date();
    const year = view.getFullYear();
    const month = view.getMonth();
    const now = new Date();
    const todayDate = now.getDate();
    const todayStr = this.localDateStr(now);
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 统计有待办事项的日期（含跨开始/结束日期）
    const todoDates = new Set();
    Store.getTodayItems().forEach(i => {
      const due = i.dueDate || this.localDateStr(i.createdAt);
      if (due) todoDates.add(due);
      const s = i.startDate || i.startTime || '';
      const e = i.endDate || i.endTime || '';
      if (s) todoDates.add(s);
      if (e) todoDates.add(e);
    });

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startWeekday = firstDayOfMonth.getDay();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days = [];

    // Previous month padding
    for (let i = startWeekday - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const dateStr = this.localDateStr(new Date(year, month - 1, day));
      days.push({ day, current: false, dateStr });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = this.localDateStr(new Date(year, month, i));
      days.push({ day: i, current: true, today: isCurrentMonth && i === todayDate, dateStr });
    }
    // Next month padding to fill 6 rows (42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const dateStr = this.localDateStr(new Date(year, month + 1, i));
      days.push({ day: i, current: false, dateStr });
    }

    const rows = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }

    return `
      <div class="calendar-card compact">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button class="calendar-nav-btn" data-cal="prev" title="上一月">${Icons.chevronLeft || '<'}</button>
            <div class="calendar-title">${year}年${monthNames[month]}</div>
            <button class="calendar-nav-btn" data-cal="next" title="下一月">${Icons.chevronRight || '>'}</button>
          </div>
          <div class="calendar-today-label">${isCurrentMonth ? todayDate + '日 今天' : '<button class="calendar-back-today" data-cal="today">回到今天</button>'}</div>
        </div>
        <div class="calendar-grid">
          ${weekDays.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
          ${rows.map(row => row.map(d => `
            <div class="calendar-day ${d.current ? '' : 'other-month'} ${d.today ? 'today' : ''} ${d.dateStr === selectedDate ? 'selected' : ''}" data-date="${d.dateStr}">
              <span>${d.day}</span>
              ${todoDates.has(d.dateStr) ? '<span class="calendar-todo-dot"></span>' : ''}
            </div>
          `).join('')).join('')}
        </div>
      </div>
    `;
  },

  renderSelectedDateTodosInline() {
    const todayStr = this.localDateStr();
    const selected = this.selectedDate || todayStr;
    const items = Store.getTodayItems().filter(i => {
      const itemDate = i.dueDate || this.localDateStr(i.createdAt);
      return itemDate === selected;
    });

    if (items.length === 0) {
      const dateLabel = selected === todayStr ? '今天' : new Date(selected + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      return `<div class="empty-state"><div class="empty-state-title">${dateLabel}暂无待办</div><div class="empty-state-desc">点击左侧日历日期或上方下拉菜单切换日期</div></div>`;
    }

    return this.renderTodayTodoList(items.filter(i => i.type === 'task'), items.filter(i => i.type === 'confirm'));
  },

  renderDateOptions() {
    const today = new Date();
    const todayStr = this.localDateStr(today);
    const selected = this.selectedDate || todayStr;
    let options = '';
    for (let offset = -7; offset <= 14; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const value = this.localDateStr(d);
      const label = value === todayStr ? '今天' : d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
      options += `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
    }
    return options;
  },

  bindTodayEvents() {
    // 加载今日运势（异步，不阻塞渲染）
    this.loadFortune();

    document.querySelectorAll('.quick-action-card[data-jump]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.jump));
    });
    document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedDate = el.dataset.date;
        // 点击日期时，若所选日期在当前查看月份之外，自动跳转对应月份
        const d = new Date(this.selectedDate + 'T00:00:00');
        if (this.calendarDate.getFullYear() !== d.getFullYear() || this.calendarDate.getMonth() !== d.getMonth()) {
          this.calendarDate = d;
        }
        this.navigate('today');
      });
    });
    document.querySelectorAll('[data-cal]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = el.dataset.cal;
        const d = new Date(this.calendarDate || new Date());
        if (action === 'prev') {
          d.setMonth(d.getMonth() - 1);
        } else if (action === 'next') {
          d.setMonth(d.getMonth() + 1);
        } else if (action === 'today') {
          const today = new Date();
          this.calendarDate = today;
          this.selectedDate = this.localDateStr(today);
          this.navigate('today');
          return;
        }
        this.calendarDate = d;
        this.navigate('today');
      });
    });
    const todoDateSelect = document.getElementById('todoDateSelect');
    if (todoDateSelect) {
      todoDateSelect.addEventListener('change', (e) => {
        this.selectedDate = e.target.value;
        this.navigate('today');
      });
    }
    document.querySelectorAll('.todo-check').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        Store.toggleTodayDone(id);
        this.navigate('today');
      });
    });
    document.querySelectorAll('.todo-main').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.closest('.todo-item')?.dataset.id;
        const item = Store.getTodayItems().find(i => i.id === id);
        if (item && item.source) {
          this.navigate(item.source);
        }
      });
    });
    document.querySelectorAll('.todo-edit-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const item = Store.getTodayItems().find(i => i.id === id);
        if (item) this.openAddTodoItem(item);
      });
    });
    document.querySelectorAll('.todo-delete-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const item = Store.getTodayItems().find(i => i.id === id);
        this.confirmDeleteTodo(id, item?.title);
      });
    });

    // 提醒 & 动态：勾选已读
    document.querySelectorAll('.alert-check').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        Store.toggleAlertDone(id);
        this.navigate('today');
      });
    });
    const clearReadAlertsBtn = document.getElementById('clearReadAlertsBtn');
    if (clearReadAlertsBtn) {
      clearReadAlertsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        Store.clearReadAlerts();
        this.navigate('today');
        this.showToast('已清空已读提醒');
      });
    }

    const addTodoBtn = document.getElementById('addTodoBtn');
    if (addTodoBtn) {
      addTodoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openAddTodoItem();
      });
    }
    const clearTodoBtn = document.getElementById('clearTodoBtn');
    if (clearTodoBtn) {
      clearTodoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openClearTodoMenu();
      });
    }
  },

  openClearTodoMenu() {
    const selected = this.selectedDate || this.localDateStr();
    const isToday = selected === this.localDateStr();
    this.showModal(`
      <div class="modal-header">
        <h3>清空待办</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="clear-todo-options">
          <button class="clear-todo-option" id="clearTodayTodoBtn">
            <span class="clear-todo-title">清空${isToday ? '今天' : '选中日期'}</span>
            <span class="clear-todo-desc">删除 ${isToday ? '今天' : selected} 的所有待办事项</span>
          </button>
          <button class="clear-todo-option danger" id="clearAllTodoBtn">
            <span class="clear-todo-title">清空全部历史数据</span>
            <span class="clear-todo-desc">删除所有日期的待办事项，完成率将重置为 0</span>
          </button>
        </div>
      </div>
    `);
    document.getElementById('clearTodayTodoBtn')?.addEventListener('click', () => {
      Store.clearTodayItemsByDate(selected);
      this.closeModal();
      this.navigate('today');
      this.showToast(`${isToday ? '今天' : selected} 的待办已清空`);
    });
    document.getElementById('clearAllTodoBtn')?.addEventListener('click', () => {
      Store.clearAllTodayItems();
      this.closeModal();
      this.navigate('today');
      this.showToast('全部待办历史数据已清空');
    });
  },

  confirmDeleteTodo(id, title) {
    this.showModal(`
      <div class="modal-header">
        <h3>删除待办</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <p>确定要删除「<strong>${this.esc(title || '该待办')}</strong>」吗？删除后无法恢复。</p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-danger" id="todoConfirmDeleteBtn">删除</button>
      </div>
    `);
    document.getElementById('todoConfirmDeleteBtn')?.addEventListener('click', () => {
      Store.deleteTodayItem(id);
      this.closeModal();
      this.navigate('today');
      this.showToast('待办已删除');
    });
  },

  openAddTodoItem(item = null) {
    const isEdit = !!item;
    const today = this.localDateStr();
    const values = {
      title: item?.title || '',
      desc: item?.desc || '',
      dueDate: item?.dueDate || today,
      type: item?.type || 'task',
      startDate: item?.startDate || item?.startTime || '',
      endDate: item?.endDate || item?.endTime || '',
      priority: item?.priority || 'medium',
    };
    const typeSelected = (val) => values.type === val ? 'selected' : '';
    const prioritySelected = (val) => values.priority === val ? 'selected' : '';

    this.showModal(`
      <div class="modal-header">
        <h3>${isEdit ? '编辑待办' : '增加待办'}</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-col form-col-full">
            <label class="form-label">事项 <span class="required">*</span></label>
            <input type="text" class="form-input" id="todoForm_title" value="${this.esc(values.title)}" placeholder="如：完成本周选题复盘">
          </div>
          <div class="form-col form-col-full">
            <label class="form-label">备注</label>
            <textarea class="form-textarea" id="todoForm_desc" placeholder="补充说明（可选）">${this.esc(values.desc)}</textarea>
          </div>
          <div class="form-col">
            <label class="form-label">完成日期</label>
            <input type="date" class="form-input" id="todoForm_dueDate" value="${values.dueDate}">
          </div>
          <div class="form-col">
            <label class="form-label">类型</label>
            <select class="form-input" id="todoForm_type">
              <option value="task" ${typeSelected('task')}>待办</option>
              <option value="confirm" ${typeSelected('confirm')}>待确认</option>
              <option value="alert" ${typeSelected('alert')}>异常</option>
            </select>
          </div>
          <div class="form-col">
            <label class="form-label">开始日期</label>
            <input type="date" class="form-input" id="todoForm_startDate" value="${values.startDate}">
          </div>
          <div class="form-col">
            <label class="form-label">结束日期</label>
            <input type="date" class="form-input" id="todoForm_endDate" value="${values.endDate}">
          </div>
          <div class="form-col">
            <label class="form-label">优先级</label>
            <select class="form-input" id="todoForm_priority">
              <option value="high" ${prioritySelected('high')}>高</option>
              <option value="medium" ${prioritySelected('medium')}>中</option>
              <option value="low" ${prioritySelected('low')}>低</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" id="todoForm_saveBtn">${isEdit ? Icons.check : Icons.plus} ${isEdit ? '保存' : '添加'}</button>
      </div>
    `);

    document.getElementById('todoForm_saveBtn')?.addEventListener('click', () => {
      const title = document.getElementById('todoForm_title')?.value.trim();
      if (!title) { this.showToast('请填写事项'); return; }
      Store.saveTodayItem({
        id: item?.id || undefined,
        title,
        desc: document.getElementById('todoForm_desc')?.value.trim() || '',
        dueDate: document.getElementById('todoForm_dueDate')?.value || today,
        startDate: document.getElementById('todoForm_startDate')?.value || '',
        endDate: document.getElementById('todoForm_endDate')?.value || '',
        priority: document.getElementById('todoForm_priority')?.value || 'medium',
        type: document.getElementById('todoForm_type')?.value || 'task',
      });
      this.closeModal();
      this.navigate('today');
      this.showToast(isEdit ? '待办已更新' : '已添加待办');
    });
  },

  // ===== AI 资讯 =====
  renderAINews() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>AI 资讯</h2>
          ${this.helpBtn('ainews')}
        </div>
        <button class="btn-secondary" id="refreshAINewsBtn">${Icons.refresh} 刷新</button>
      </div>
      <div id="ainewsContainer">
        <div class="ai-loading">
          <div class="spinner"></div>
          <p>正在获取最新 AI 资讯...</p>
        </div>
      </div>
    `;
  },

  bindAINewsEvents() {
    document.getElementById('refreshAINewsBtn')?.addEventListener('click', () => this.refreshAINews());
    this.loadAINews(false);
  },

  async loadAINews(force) {
    const container = document.getElementById('ainewsContainer');
    if (!container) return;

    const result = await API.fetchAINews(force);

    if (result.error) {
      const cached = Store.getAINews();
      if (cached && cached.length > 0) {
        container.innerHTML = this.renderAINewsContent(cached, '缓存数据（API暂时不可用）');
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">暂无法获取 AI 资讯</div>
            <div class="empty-state-desc">网络连接异常或 API 暂时不可用，请稍后重试</div>
          </div>
        `;
      }
      return;
    }

    Store.saveAINews(result.items);
    Store.saveAINewsMeta({ lastFetch: Date.now(), count: result.items.length });
    container.innerHTML = this.renderAINewsContent(result.items, result.source === 'cache' ? '缓存数据' : '实时数据');
  },

  renderAINewsContent(items, sourceLabel) {
    if (!items || items.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-title">暂无 AI 资讯</div>
        <div class="empty-state-desc">点击刷新按钮重新获取</div>
      </div>`;
    }

    // Group by category
    const categories = {
      'ai-models': { label: '模型发布/更新', color: '#EEF4FC', textColor: '#3A5A8A' },
      'ai-products': { label: '产品发布/更新', color: '#FFEEF6', textColor: '#8A4A72' },
      'industry': { label: '行业动态', color: '#EEF5E8', textColor: '#4A6B3A' },
      'paper': { label: '论文研究', color: '#FFF6E0', textColor: '#8A6D00' },
      'tip': { label: '技巧与观点', color: '#E6E0FF', textColor: '#5A4FB8' },
    };

    let html = `<div class="api-status">数据来源：${sourceLabel} · 共 ${items.length} 条</div>`;

    const grouped = {};
    items.forEach(item => {
      const cat = item.category || 'industry';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    Object.entries(grouped).forEach(([cat, catItems]) => {
      const catInfo = categories[cat] || categories.industry;
      html += `<div class="today-section">
        <div class="today-section-header">
          <h3 style="color:${catInfo.textColor}">${catInfo.label}</h3>
          <span class="count">${catItems.length}</span>
        </div>
        <div class="grid-2">`;

      catItems.forEach(item => {
        html += `
          <div class="news-card" onclick="window.open('${this.esc(item.url || item.sourceUrl || '#')}', '_blank')">
            <div class="news-card-header">
              <span class="tag" style="background:${catInfo.color};color:${catInfo.textColor};">${catInfo.label}</span>
              <span class="news-card-time">${API.formatTimeAgo(item.publishedAt || item.createdAt || Date.now())}</span>
            </div>
            <div class="news-card-title">${this.esc(item.title)}</div>
            ${item.summary ? `<div class="news-card-summary">${this.esc(item.summary)}</div>` : ''}
            <div class="news-card-footer">
              <span class="news-card-source">${this.esc(item.source || '未知来源')}</span>
              ${item.url ? `<span class="news-card-link">${Icons.external}</span>` : ''}
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    return html;
  },

  async refreshAINews() {
    this.showToast('正在刷新 AI 资讯...');
    await this.loadAINews(true);
    this.showToast('AI 资讯已更新');
  },

  // ===== 平台热点 =====
  renderHotTopics() {
    const activeTab = this.currentHotTab || 'platform';

    let mainTabsHtml = '<div class="hot-main-tabs">';
    ModuleConfig.hotTabs.forEach(t => {
      mainTabsHtml += `<div class="hot-main-tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.name}</div>`;
    });
    mainTabsHtml += '</div>';

    let subTabsHtml = '';
    if (activeTab === 'platform') {
      subTabsHtml = '<div class="platform-tabs">';
      ModuleConfig.hotPlatforms.forEach(p => {
        subTabsHtml += `<div class="content-tab ${p.key === this.currentPlatform ? 'active' : ''}" data-platform="${p.key}">${p.name}</div>`;
      });
      subTabsHtml += '</div>';
    }

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>平台热点</h2>
          ${this.helpBtn('hot')}
        </div>
        <button class="btn-secondary" id="refreshHotBtn">${Icons.refresh} 刷新</button>
      </div>
      ${mainTabsHtml}
      ${subTabsHtml}
      <div id="hotTopicsContainer">
        <div class="ai-loading">
          <div class="spinner"></div>
          <p>正在获取热点数据...</p>
        </div>
      </div>
    `;
  },

  bindHotTopicsEvents() {
    document.getElementById('refreshHotBtn')?.addEventListener('click', () => this.refreshHotTopics());

    document.querySelectorAll('.hot-main-tab').forEach(el => {
      el.addEventListener('click', () => {
        this.currentHotTab = el.dataset.tab;
        this.navigate('hot');
      });
    });

    document.querySelectorAll('.platform-tabs .content-tab').forEach(el => {
      el.addEventListener('click', () => {
        this.currentPlatform = el.dataset.platform;
        document.querySelectorAll('.platform-tabs .content-tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        this.loadHotTopics(this.currentPlatform, false);
      });
    });

    const activeTab = this.currentHotTab || 'platform';
    if (activeTab === 'platform') {
      this.loadHotTopics(this.currentPlatform, false);
    } else if (activeTab === 'life') {
      this.loadAIHotTopics('life', false);
    } else if (activeTab === 'ai') {
      this.loadAIHotTopics('ai', false);
    } else if (activeTab === 'competitor') {
      this.loadCompetitorTopics(false);
    }
  },

  async loadHotTopics(platform, force) {
    const container = document.getElementById('hotTopicsContainer');
    if (!container) return;

    const platformInfo = ModuleConfig.hotPlatforms.find(p => p.key === platform);
    if (!platformInfo) return;

    container.innerHTML = `<div class="ai-loading"><div class="spinner"></div><p>正在获取${platformInfo.name}热搜...</p></div>`;

    const result = await API.fetchHotTopics(platformInfo.endpoint, force);

    if (result.error) {
      const cached = Store.getHotTopics(platform);
      if (cached && cached.length > 0) {
        container.innerHTML = this.renderHotTopicsContent(cached, platform, '缓存数据');
      } else {
        container.innerHTML = `<div class="empty-state">
          <div class="empty-state-title">暂无法获取${platformInfo.name}热搜</div>
          <div class="empty-state-desc">网络连接异常或 API 暂时不可用，请稍后重试</div>
        </div>`;
      }
      return;
    }

    Store.saveHotTopics(platform, result.items);
    Store.saveHotTopicsMeta(platform, { lastFetch: Date.now(), count: result.items.length });
    container.innerHTML = this.renderHotTopicsContent(result.items, platform, result.update_time || '实时数据');
  },

  renderHotTopicsContent(items, platform, updateTime) {
    if (!items || items.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-title">暂无热搜数据</div>
        <div class="empty-state-desc">点击刷新按钮重新获取</div>
      </div>`;
    }

    let html = `<div class="api-status">更新时间：${this.esc(updateTime)} · 共 ${items.length} 条</div>`;
    html += '<div class="hot-grid">';

    items.forEach((item, idx) => {
      const rank = idx + 1;
      const heat = item['热度'] || item.heat || item.hot || '';
      const heatStr = heat ? API.formatHeatScore(typeof heat === 'string' ? parseInt(heat) : heat) : '';

      html += `
        <div class="hot-card" onclick="window.open('${this.esc(item.url || '#')}', '_blank')">
          <div class="hot-card-header">
            <span class="hot-card-rank">${rank}</span>
            <div class="hot-card-title">${this.esc(item.title)}</div>
          </div>
          ${heatStr ? `<div class="hot-card-heat">${Icons.fire} ${heatStr}</div>` : ''}
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  async loadAIHotTopics(category, force) {
    const container = document.getElementById('hotTopicsContainer');
    if (!container) return;

    const label = category === 'life' ? '生活热点' : 'AI热点';

    // AI热点：真实每周资讯（以周为维度聚合抓取 GitHub / AI门户 / 社媒），非 AI 生成趋势
    if (category === 'ai') {
      container.innerHTML = `<div class="ai-loading"><div class="spinner"></div><p>正在${force ? '实时抓取' : '加载'}本周真实${label}...</p></div>`;
      const result = await API.fetchRealAIHotNews(force);

      if (result.error || !result.items || result.items.length === 0) {
        container.innerHTML = `<div class="empty-state">
          <div class="empty-state-title">${label}获取失败</div>
          <div class="empty-state-desc">${result.message || '暂时无法抓取本周真实热点，请检查网络后刷新重试'}</div>
        </div>`;
        return;
      }

      // 生成「本周 AI 热点概要」（Deepseek 汇总，置于真实资讯列表上方）
      let summaryHtml = '';
      try {
        const sum = await API.generateAIHotSummary(result.items, force);
        if (sum.error) {
          summaryHtml = `<div class="ai-summary-card ai-summary-card--notice"><div class="ai-summary-notice">${this.esc(sum.message || '概要生成失败')}</div></div>`;
        } else if (sum.data) {
          summaryHtml = this.renderAIHotSummary(sum.data, result.rangeLabel);
          if (sum.source === 'cache') {
            summaryHtml += `<div class="ai-summary-cache-tip">概要来自缓存（点击右上角刷新可重新抓取门户最新消息并重新生成）</div>`;
          }
        }
      } catch {
        summaryHtml = '';
      }

      container.innerHTML = summaryHtml + this.renderRealAIHot(result.items, result.source, result.fetchedAt, result.rangeLabel);
      return;
    }

    // 生活热点：保留 AI 生成趋势卡片
    container.innerHTML = `<div class="ai-loading"><div class="spinner"></div><p>正在生成${label}...</p></div>`;
    const result = await API.fetchAIHotTopics(category, force);

    if (result.error) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-title">${label}生成失败</div>
        <div class="empty-state-desc">${result.message || '请检查 Deepseek API Key 是否已配置且有效'}</div>
      </div>`;
      return;
    }

    container.innerHTML = this.renderAIHotTopicsContent(result.trends, category, result.source);
  },

  renderAIHotTopicsContent(trends, category, source) {
    if (!trends || trends.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-title">暂无数据</div>
        <div class="empty-state-desc">点击刷新按钮重新生成</div>
      </div>`;
    }

    const label = category === 'life' ? '生活热点' : 'AI热点';
    let html = `<div class="api-status">数据来源：${source === 'cache' ? '缓存数据' : 'AI 实时生成'}</div>`;
    html += '<div class="trend-grid">';

    trends.forEach(t => {
      const topicsHtml = (t.topics || []).map(topic => `
        <div class="trend-topic-row">
          <span class="trend-topic-tag">${this.esc(topic.hashtag || '')}</span>
          <div class="trend-topic-meta">
            <span class="trend-topic-platform">${this.esc(topic.platform || '')}</span>
            <span class="trend-topic-heat">${Icons.fire} ${this.esc(topic.heat || '')}</span>
          </div>
        </div>
      `).join('');

      const statsHtml = (t.stats || []).map(s => `
        <div class="trend-stat">
          <div class="trend-stat-value">${this.esc(s.value || '')}</div>
          <div class="trend-stat-label">${this.esc(s.label || '')}</div>
          ${s.desc ? `<div class="trend-stat-desc">${this.esc(s.desc)}</div>` : ''}
        </div>
      `).join('');

      html += `
        <div class="trend-card">
          <div class="trend-card-header" style="background:${this.esc(t.tagColor || '#D4A5FF')};">
            <div class="trend-card-tag">${this.esc(t.tag || '趋势')}</div>
            <div class="trend-card-title">${this.esc(t.title)}</div>
          </div>
          <div class="trend-card-body">
            ${t.summary ? `<div class="trend-summary">${this.esc(t.summary)}</div>` : ''}
            ${statsHtml ? `<div class="trend-stats-row">${statsHtml}</div>` : ''}
            <div class="trend-topics">
              ${topicsHtml}
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  renderRealAIHot(items, source, fetchedAt, rangeLabel) {
    if (!items || items.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-title">暂无数据</div>
        <div class="empty-state-desc">点击刷新按钮重新抓取</div>
      </div>`;
    }

    const sourceStyle = {
      'GitHub': { bg: '#EEF5E8', color: '#3A6B3A' },
      'Hacker News': { bg: '#FFF1E0', color: '#8A5A00' },
      '抖音': { bg: '#E8F3FF', color: '#0B6FB8' },
      'B站': { bg: '#E6F4FF', color: '#00A1D6' },
      '小红书': { bg: '#FFEDE8', color: '#E0396B' },
    };

    const fetchedText = fetchedAt
      ? `${new Date(fetchedAt).getMonth() + 1}月${new Date(fetchedAt).getDate()}日 ${String(new Date(fetchedAt).getHours()).padStart(2, '0')}:${String(new Date(fetchedAt).getMinutes()).padStart(2, '0')}`
      : '';
    let html = `<div class="api-status">统计周期：本周${rangeLabel ? `（${this.esc(rangeLabel)}）` : ''} · 数据来源：${source === 'cache' ? '缓存数据' : '实时抓取（GitHub / AI门户 / 社媒 / 抖音 / B站 / 小红书）'}${fetchedText ? ` · 抓取于 ${fetchedText}` : ''}</div>`;
    html += '<div class="real-hot-list">';

    items.forEach((it) => {
      const ss = sourceStyle[it.source] || { bg: '#EEF4FC', color: '#3A5A8A' };
      const timeStr = it.publishedAt ? API.formatTimeAgo(it.publishedAt) : '';
      const url = it.url && it.url !== '#' ? it.url : '';
      html += `
        <div class="real-hot-item" ${url ? `onclick="window.open('${this.esc(url)}', '_blank')"` : ''}>
          <div class="real-hot-item-head">
            <span class="real-hot-source" style="background:${ss.bg};color:${ss.color};">${this.esc(it.source || '资讯')}</span>
            ${it.tag ? `<span class="real-hot-tag ${it.tag === 'AI热点' ? 'tag-ai' : 'tag-trend'}">${this.esc(it.tag)}</span>` : ''}
            ${it.metric ? `<span class="real-hot-metric">${this.esc(it.metric)}</span>` : ''}
            ${timeStr ? `<span class="real-hot-time">${timeStr}</span>` : ''}
          </div>
          <div class="real-hot-title">${this.esc(it.title)}</div>
          ${it.summary ? `<div class="real-hot-summary">${this.esc(it.summary)}</div>` : ''}
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  renderAIHotSummary(data, rangeLabel) {
    if (!data) return '';

    const summary = data.summary || '';
    const highlights = Array.isArray(data.highlights) ? data.highlights : [];
    const agents = Array.isArray(data.agents) ? data.agents : [];
    const tools = Array.isArray(data.tools) ? data.tools : [];
    const insight = data.insight || '';
    const range = rangeLabel || data.rangeLabel || '';
    const genText = data.generatedAt
      ? `${new Date(data.generatedAt).getMonth() + 1}月${new Date(data.generatedAt).getDate()}日 ${String(new Date(data.generatedAt).getHours()).padStart(2, '0')}:${String(new Date(data.generatedAt).getMinutes()).padStart(2, '0')}`
      : '';

    const li = (arr) => arr.map((t) => `<li>${this.esc(t)}</li>`).join('');

    let cols = '';
    if (highlights.length) {
      cols += `<div class="ai-summary-col"><div class="ai-summary-col-title">本周要点</div><ul class="ai-summary-list">${li(highlights)}</ul></div>`;
    }
    if (agents.length) {
      cols += `<div class="ai-summary-col"><div class="ai-summary-col-title">Agent / Skill 动态</div><ul class="ai-summary-list">${li(agents)}</ul></div>`;
    }
    if (tools.length) {
      cols += `<div class="ai-summary-col"><div class="ai-summary-col-title">实用工具</div><ul class="ai-summary-list">${li(tools)}</ul></div>`;
    }

    return `
      <div class="ai-summary-card">
        <div class="ai-summary-head">
          <span class="ai-summary-icon">${Icons.sparkles}</span>
          <div class="ai-summary-titles">
            <div class="ai-summary-title">本周 AI 热点概要</div>
            <div class="ai-summary-sub">${range ? `统计周期 ${this.esc(range)} · ` : ''}由 Deepseek 汇总本周 AI / Agent / Skill / 实用工具热点${genText ? ` · 更新于 ${genText}` : ''}</div>
          </div>
        </div>
        ${summary ? `<div class="ai-summary-overview">${this.esc(summary)}</div>` : ''}
        ${cols ? `<div class="ai-summary-cols">${cols}</div>` : ''}
        ${insight ? `<div class="ai-summary-insight"><span class="ai-summary-insight-label">选题启发</span>${this.esc(insight)}</div>` : ''}
      </div>
    `;
  },

  renderAINewsInHot(items) {
    if (!items || items.length === 0) return '';

    const categories = {
      'ai-models': { label: '模型发布/更新', color: '#EEF4FC', textColor: '#3A5A8A' },
      'ai-products': { label: '产品发布/更新', color: '#FFEEF6', textColor: '#8A4A72' },
      'industry': { label: '行业动态', color: '#EEF5E8', textColor: '#4A6B3A' },
      'paper': { label: '论文研究', color: '#FFF6E0', textColor: '#8A6D00' },
      'tip': { label: '技巧与观点', color: '#E6E0FF', textColor: '#5A4FB8' },
    };

    let html = `<div class="today-section" style="margin-top:24px;">
      <div class="today-section-header">
        <h3>AI 行业资讯</h3>
        <span class="count">${items.length}</span>
      </div>
      <div class="grid-2">`;

    items.slice(0, 10).forEach(item => {
      const cat = item.category || 'industry';
      const catInfo = categories[cat] || categories.industry;
      html += `
        <div class="news-card" onclick="window.open('${this.esc(item.url || item.sourceUrl || '#')}', '_blank')">
          <div class="news-card-header">
            <span class="tag" style="background:${catInfo.color};color:${catInfo.textColor};">${catInfo.label}</span>
            <span class="news-card-time">${API.formatTimeAgo(item.publishedAt || item.createdAt || Date.now())}</span>
          </div>
          <div class="news-card-title">${this.esc(item.title)}</div>
          ${item.summary ? `<div class="news-card-summary">${this.esc(item.summary)}</div>` : ''}
          <div class="news-card-footer">
            <span class="news-card-source">${this.esc(item.source || '未知来源')}</span>
            ${item.url ? `<span class="news-card-link">${Icons.external}</span>` : ''}
          </div>
        </div>
      `;
    });

    html += '</div></div>';
    return html;
  },

  async refreshHotTopics() {
    const activeTab = this.currentHotTab || 'platform';
    this.showToast(activeTab === 'ai' ? '正在实时抓取门户最新消息...' : '正在刷新热点数据...');
    if (activeTab === 'platform') {
      await this.loadHotTopics(this.currentPlatform, true);
    } else if (activeTab === 'competitor') {
      await this.loadCompetitorTopics(true);
    } else {
      await this.loadAIHotTopics(activeTab, true);
    }
    this.showToast(activeTab === 'ai' ? '已按最新时间点更新本周概要' : '热点数据已更新');
  },

  // ===== 竞品参考 =====
  COMPETITOR_BLOGGERS: [
    { name: 'xuan酱', style: '偏实操演示、手把手教学，选题小而具体', historical: ['用 DeepSeek 批量生成小红书封面标题', '3 分钟搭好一个个人 AI 知识库', '把微信文件自动整理进 Notion 的脚本'] },
    { name: '不一书', style: '偏体系化知识梳理，把复杂概念讲明白', historical: ['一张图讲清 Agent 和 Workflow 的区别', '普通人搞懂大模型的 5 个核心概念', '从零理解 RAG 检索增强生成'] },
    { name: '西门聪明蛋XD', style: '偏轻松幽默的科普口吻，把工具讲得像段子', historical: ['当 AI 帮我写周报之后老板的反应', '用 AI 把废片剪成爆款 vlog', '和 ChatGPT 吵架学会了写 Prompt'] },
    { name: '老陈是小凳', style: '偏场景化应用，从真实工作/生活痛点切入', historical: ['打工人用 AI 10 分钟做完一天报表', '租房合同让 AI 帮我挑坑', '用 AI 给娃做专属学习计划'] },
    { name: '不喝九', style: '偏"搭建个人工作台/效率工具"的实用分享', historical: ['用纯前端搭一个自己的 AI 工作台', '把 8 个 App 合成 1 个工作台', '用 Deepseek API 给工作台加 AI 帮手'] },
  ],

  async loadCompetitorTopics(force) {
    const container = document.getElementById('hotTopicsContainer');
    if (!container) return;

    container.innerHTML = `<div class="ai-loading"><div class="spinner"></div><p>正在${force ? '刷新' : '加载'}竞品参考...</p></div>`;

    const realTitles = Store.getCompetitorRealTitles();

    let latest = null;
    if (!force) latest = Store.getCompetitorTopics();

    if (force || !latest) {
      const settings = Store.getSettings();
      if (!settings.deepseekApiKey) {
        container.innerHTML = this.renderCompetitorTopics(this.COMPETITOR_BLOGGERS, latest, false, realTitles, '请先在设置中配置 Deepseek API Key，刷新即可生成各家最新选题方向');
        return;
      }
      try {
        // 真实公开信号：feigua 行业文章 + 真实平台 AI 热搜
        const [feigua, plat] = await Promise.allSettled([
          API.fetchFeiguaArticles(),
          API.fetchPlatformAIHotTopics(),
        ]);
        const feiguaArticles = feigua.status === 'fulfilled' ? feigua.value : [];
        const platItems = plat.status === 'fulfilled' ? plat.value : [];
        const platformHot = platItems
          .filter((x) => x.isAI !== false)
          .map((x) => `[${x.source}] ${x.title}${x.summary ? '——' + x.summary : ''}`);
        const realSignal = { feiguaArticles, platformHot };

        const r = await API.generateCompetitorTopics(this.COMPETITOR_BLOGGERS, realSignal);
        if (!r.error && r.topics && Object.keys(r.topics).length) {
          latest = r.topics;
          Store.saveCompetitorTopics(latest);
        } else if (r.error) {
          container.innerHTML = this.renderCompetitorTopics(this.COMPETITOR_BLOGGERS, latest, false, realTitles, r.message || '生成失败，请重试');
          return;
        }
      } catch {
        container.innerHTML = this.renderCompetitorTopics(this.COMPETITOR_BLOGGERS, latest, false, realTitles, '生成异常，请重试');
        return;
      }
    }

    container.innerHTML = this.renderCompetitorTopics(this.COMPETITOR_BLOGGERS, latest, !!latest, realTitles, '');
    this.bindCompetitorEvents();
  },

  bindCompetitorEvents() {
    document.querySelectorAll('.competitor-add-real').forEach((el) => {
      el.addEventListener('click', () => {
        const name = el.dataset.name;
        this.showCompetitorPasteModal(name);
      });
    });
  },

  showCompetitorPasteModal(name) {
    const existing = (Store.getCompetitorRealTitles()[name] || []).join('\n');
    this.showModal(`
      <div class="modal-header">
        <h3>添加 ${this.esc(name)} 的真实选题</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="modal-tip">从灰豚/蝉妈妈等后台复制该博主的历史视频标题，每行一条，粘贴保存后将原样展示为「真实历史选题」。</div>
        <textarea id="competitorRealInput" class="form-textarea" rows="8" placeholder="例如：&#10;用 DeepSeek 批量生成小红书封面标题&#10;3分钟搭好个人AI知识库">${this.esc(existing)}</textarea>
        <div class="form-row" style="margin-top:12px;gap:10px;">
          <button class="btn-secondary" onclick="App.closeModal()">取消</button>
          <button class="btn-primary" id="saveCompetitorRealBtn" style="flex:1;justify-content:center;">保存真实选题</button>
        </div>
      </div>
    `);
    document.getElementById('saveCompetitorRealBtn')?.addEventListener('click', () => {
      const raw = document.getElementById('competitorRealInput')?.value || '';
      const list = raw.split('\n').map((s) => s.trim()).filter(Boolean);
      const map = Store.getCompetitorRealTitles();
      map[name] = list;
      Store.saveCompetitorRealTitles(map);
      this.closeModal();
      this.loadCompetitorTopics(false);
      this.showToast(`已保存 ${list.length} 条真实选题`);
    });
  },

  renderCompetitorTopics(bloggers, latest, hasLatest, realTitles, notice) {
    let html = `<div class="api-status">数据说明："代表性历史选题"为示例；"AI 推断最新方向"由 AI 基于<b>真实公开信号</b>（飞瓜行业文章 + 抖音/B站/小红书 AI 热搜）推断；"真实历史选题"为你手动粘贴的该博主真实视频标题。点击右上角"刷新"重新推断。</div>`;

    if (notice) {
      html += `<div class="competitor-notice">${this.esc(notice)}</div>`;
    }

    html += '<div class="competitor-list">';

    bloggers.forEach(b => {
      const hist = (b.historical || []).map(t => `<li>${this.esc(t)}</li>`).join('');
      const latestList = (latest && latest[b.name]) ? latest[b.name] : [];
      const latestHtml = latestList.length
        ? latestList.map(t => `<li class="competitor-latest-item">${this.esc(t)}</li>`).join('')
        : '<li class="competitor-empty">点击右上角"刷新"生成最新方向</li>';
      const realList = (realTitles && realTitles[b.name]) ? realTitles[b.name] : [];
      const realHtml = realList.length
        ? realList.map(t => `<li class="competitor-real-item">${this.esc(t)}</li>`).join('')
        : '<li class="competitor-empty">点击"添加真实选题"粘贴该博主真实视频标题</li>';

      html += `
        <div class="competitor-card">
          <div class="competitor-head">
            <div class="competitor-avatar">${this.esc(b.name.slice(0, 1))}</div>
            <div class="competitor-name">${this.esc(b.name)}</div>
            <button class="competitor-add-real" data-name="${this.esc(b.name)}">${Icons.plus} 添加真实选题</button>
          </div>
          <div class="competitor-style">${this.esc(b.style)}</div>
          ${realList.length ? `<div class="competitor-section-title competitor-section-real">真实历史选题（你添加）</div><ul class="competitor-real">${realHtml}</ul>` : `<div class="competitor-section-title competitor-section-real">真实历史选题（你添加）</div><ul class="competitor-real">${realHtml}</ul>`}
          <div class="competitor-section-title">代表性历史选题（示例）</div>
          <ul class="competitor-hist">${hist}</ul>
          ${hasLatest ? `<div class="competitor-section-title competitor-section-latest">AI 推断最新选题方向</div><ul class="competitor-latest">${latestHtml}</ul>` : ''}
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  // ===== 选题灵感 =====
  renderTopics() {
    const activeTab = this.currentInspirationTab || 'today';
    const settings = Store.getSettings();
    const hasApiKey = !!settings.deepseekApiKey;

    let html = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>选题灵感</h2>
          ${this.helpBtn('topics')}
        </div>
        <button class="btn-primary" id="recordInspirationBtn">${Icons.plus} 记录灵感</button>
      </div>
      <div class="inspiration-tabs">
        <div class="inspiration-tab ${activeTab === 'today' ? 'active' : ''}" data-tab="today">今日灵感</div>
        <div class="inspiration-tab ${activeTab === 'user' ? 'active' : ''}" data-tab="user">用户灵感</div>
      </div>
      <div class="inspiration-content">
        ${activeTab === 'today' ? this.renderTodayInspiration(hasApiKey) : this.renderUserInspiration()}
      </div>
    `;
    return html;
  },

  renderTodayInspiration(hasApiKey) {
    const cache = Store.getObject('xl_today_inspiration_cache');
    const cacheDate = cache?.date || '';
    const today = this.localDateStr();
    const topics = cacheDate === today ? (cache.topics || []) : [];

    let html = '';
    if (!hasApiKey) {
      html += `<div class="alert-card" style="margin-bottom:16px;"><span class="alert-icon">${Icons.alert}</span><div class="alert-content"><div class="alert-title">未配置 AI API</div><div class="alert-desc">请先到设置页面配置 Deepseek API Key，才能生成今日灵感</div></div></div>`;
    }

    html += `<button class="btn-primary" id="generateTodayInspirationBtn" ${!hasApiKey ? 'disabled' : ''} style="margin-bottom:20px;">${Icons.sparkles} 生成今日灵感</button>`;

    if (topics.length === 0) {
      html += `<div class="empty-state">
        <div class="empty-state-title">暂无今日灵感</div>
        <div class="empty-state-desc">点击上方按钮，AI 将结合抖音热点、AI资讯和你的用户灵感记录为你推荐选题</div>
      </div>`;
      return html;
    }

    html += `<div class="today-section-header" style="margin-bottom:12px;"><h3>AI 今日推荐</h3><span class="count">${topics.length}</span></div>`;
    html += `<div class="inspiration-grid">`;
    topics.forEach((t, idx) => {
      const keywords = Array.isArray(t.keywords) ? t.keywords : [];
      html += `
        <div class="inspiration-card">
          <div class="inspiration-card-header">
            <div class="inspiration-card-title">${this.esc(t.title)}</div>
          </div>
          <div class="inspiration-card-section">
            <div class="inspiration-card-label">开场</div>
            <div class="inspiration-card-text">${this.esc(t.opening)}</div>
          </div>
          <div class="inspiration-card-section">
            <div class="inspiration-card-label">内容概要</div>
            <div class="inspiration-card-text">${this.esc(t.summary)}</div>
          </div>
          <div class="inspiration-card-section">
            <div class="inspiration-card-label">结尾</div>
            <div class="inspiration-card-text">${this.esc(t.ending)}</div>
          </div>
          <div class="inspiration-card-footer">
            <div class="inspiration-card-keywords">
              ${keywords.map(k => `<span class="tag tag-gray">${this.esc(k)}</span>`).join('')}
            </div>
            <button class="btn-primary adopt-inspiration-btn" data-idx="${idx}" style="padding:4px 12px;font-size:12px;">收录</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  },

  renderUserInspiration() {
    const items = Store.getUserInspirations();
    if (items.length === 0) {
      return `<div class="empty-state">
        <div class="empty-state-title">用户灵感是空的</div>
        <div class="empty-state-desc">突然想到的点子、粉丝反馈、竞品参考都可以记录在这里，AI 会在生成今日灵感时参考它们</div>
      </div>`;
    }
    let html = `<div class="user-inspiration-list">`;
    items.forEach(item => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      html += `
        <div class="user-inspiration-item" data-id="${item.id}">
          <div class="user-inspiration-main">
            <div class="user-inspiration-title">${this.esc(item.title || item.text.slice(0, 30))}</div>
            ${item.desc ? `<div class="user-inspiration-desc">${this.esc(item.desc)}</div>` : ''}
            <div class="user-inspiration-meta">
              ${tags.map(t => `<span class="tag tag-gray">${this.esc(t)}</span>`).join('')}
              <span class="user-inspiration-date">${new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
          <div class="user-inspiration-actions">
            <button class="ghost-btn edit-inspiration-btn" data-id="${item.id}" title="编辑">${Icons.edit}</button>
            <button class="ghost-btn delete-inspiration-btn" data-id="${item.id}" title="删除">${Icons.trash}</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  },

  bindTopicsEvents() {
    document.querySelectorAll('.inspiration-tab').forEach(el => {
      el.addEventListener('click', () => {
        this.currentInspirationTab = el.dataset.tab;
        this.navigate('topics');
      });
    });
    document.getElementById('generateTodayInspirationBtn')?.addEventListener('click', () => this.generateTodayInspiration());
    document.getElementById('recordInspirationBtn')?.addEventListener('click', () => this.openUserInspirationEditor());
    document.querySelectorAll('.adopt-inspiration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const cache = Store.getObject('xl_today_inspiration_cache');
        const topics = cache?.topics || [];
        if (topics[idx]) {
          const t = topics[idx];
          Store.saveUserInspiration({
            title: t.title,
            text: t.summary,
            desc: `开场：${t.opening} / 结尾：${t.ending}`,
            tags: Array.isArray(t.keywords) ? t.keywords : [],
          });
          this.showToast('已收录到用户灵感');
        }
      });
    });
    document.querySelectorAll('.edit-inspiration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openUserInspirationEditor(btn.dataset.id);
      });
    });
    document.querySelectorAll('.delete-inspiration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Store.deleteUserInspiration(btn.dataset.id);
        this.navigate('topics');
        this.showToast('已删除');
      });
    });
  },

  async generateTodayInspiration() {
    const btn = document.getElementById('generateTodayInspirationBtn');
    const container = document.querySelector('.inspiration-content');

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> AI 生成中...';
    container.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>AI 正在结合热点、AI热点、竞品参考和你的灵感生成选题...</p></div>';

    const [hotResult, newsResult, aiHotResult] = await Promise.allSettled([
      API.fetchHotTopics('douyin'),
      API.fetchAINews(),
      API.fetchRealAIHotNews(false),
    ]);

    const hotTopics = hotResult.status === 'fulfilled' && !hotResult.value.error ? hotResult.value.items || [] : [];
    const aiNews = newsResult.status === 'fulfilled' && !newsResult.value.error ? newsResult.value.items || [] : [];
    const aiHotTopics = aiHotResult.status === 'fulfilled' && !aiHotResult.value.error ? aiHotResult.value.items || [] : [];
    const userInspirations = Store.getUserInspirations();
    const competitorRef = {
      latest: Store.getCompetitorTopics() || {},
      real: Store.getCompetitorRealTitles() || {},
    };

    const result = await API.generateTodayInspiration(userInspirations, hotTopics, aiNews, aiHotTopics, competitorRef, 4);

    btn.disabled = false;
    btn.innerHTML = `${Icons.sparkles} 生成今日灵感`;

    if (result.error) {
      container.innerHTML = `<div class="alert-card"><span class="alert-icon">${Icons.alert}</span><div class="alert-content"><div class="alert-title">生成失败</div><div class="alert-desc">${this.esc(result.message || '请检查 API 配置')}</div></div></div>`;
      return;
    }

    const today = this.localDateStr();
    Store.setObject('xl_today_inspiration_cache', { date: today, topics: result.topics || [] });

    this.navigate('topics');
    this.showToast('今日灵感已生成');
  },

  openUserInspirationEditor(id = null) {
    const item = id ? Store.getUserInspiration(id) : null;
    const title = item?.title || '';
    const text = item?.text || '';
    const desc = item?.desc || '';
    const tags = Array.isArray(item?.tags) ? item.tags.join(',') : '';

    this.showModal(`
      <div class="modal-header">
        <h3>${id ? '编辑灵感' : '记录灵感'}</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">灵感标题 <span style="color:var(--text-mute);font-weight:400;">（可选）</span></label>
          <input type="text" class="form-input" id="inspirationTitle" value="${this.esc(title)}" placeholder="如：猫咪纸箱行为解析">
        </div>
        <div class="form-group">
          <label class="form-label">灵感内容</label>
          <textarea class="form-textarea" id="inspirationText" placeholder="记录你想到的选题、粉丝反馈、竞品参考..." style="min-height:100px;">${this.esc(text)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">补充说明 <span style="color:var(--text-mute);font-weight:400;">（可选）</span></label>
          <textarea class="form-textarea" id="inspirationDesc" placeholder="可补充拍摄方向、参考链接、目标平台等">${this.esc(desc)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">关键词 <span style="color:var(--text-mute);font-weight:400;">（用逗号分隔，可选）</span></label>
          <input type="text" class="form-input" id="inspirationTags" value="${this.esc(tags)}" placeholder="猫咪,行为学,趣味">
        </div>
      </div>
      <div class="modal-footer">
        ${id ? `<button class="btn-danger" onclick="App.deleteUserInspiration('${id}')">删除</button>` : ''}
        <button class="btn-primary" onclick="App.saveUserInspiration('${id || ''}')">保存</button>
      </div>
    `);
  },

  saveUserInspiration(id = '') {
    const title = document.getElementById('inspirationTitle')?.value.trim() || '';
    const text = document.getElementById('inspirationText')?.value.trim() || '';
    const desc = document.getElementById('inspirationDesc')?.value.trim() || '';
    const tagsStr = document.getElementById('inspirationTags')?.value.trim() || '';
    const tags = tagsStr ? tagsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];

    if (!title && !text) {
      this.showToast('请输入灵感内容或标题');
      return;
    }

    const data = { title, text, desc, tags };
    if (id) data.id = id;

    Store.saveUserInspiration(data);
    this.closeModal();
    this.currentInspirationTab = 'user';
    this.navigate('topics');
    this.showToast(id ? '灵感已更新' : '灵感已记录');
  },

  deleteUserInspiration(id) {
    Store.deleteUserInspiration(id);
    this.closeModal();
    this.navigate('topics');
    this.showToast('灵感已删除');
  },

  // ===== 内容创作 =====
  renderContent() {
    const items = Store.getContentItems();
    const settings = Store.getSettings();
    const hasApiKey = !!settings.deepseekApiKey;

    let tabsHtml = '<div class="content-tabs">';
    const statuses = [
      { key: 'all', label: '全部' },
      { key: 'idea', label: '创意' },
      { key: 'draft', label: '草稿' },
      { key: 'editing', label: '编辑中' },
      { key: 'published', label: '已发布' },
    ];
    statuses.forEach(s => {
      tabsHtml += `<div class="content-tab ${s.key === 'all' ? 'active' : ''}" data-status="${s.key}">${s.label}</div>`;
    });
    tabsHtml += '</div>';

    let listHtml = '';
    if (items.length === 0) {
      listHtml = `<div class="empty-state">
        <div class="empty-state-title">还没有内容</div>
        <div class="empty-state-desc">点击"新建内容"或"AI写作"开始创作</div>
      </div>`;
    } else {
      listHtml = `<div class="content-grid">${items.map(item => this.renderContentCard(item)).join('')}</div>`;
    }

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>内容创作</h2>
          ${this.helpBtn('content')}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-secondary" id="aiWriteBtn" ${!hasApiKey ? 'disabled' : ''}>${Icons.sparkles} AI写作</button>
          <button class="btn-primary" id="newContentBtn">${Icons.plus} 新建内容</button>
        </div>
      </div>
      ${tabsHtml}
      <div id="contentList">${listHtml}</div>
    `;
  },

  renderContentCard(item) {
    const statusInfo = ModuleConfig.contentStatus[item.status] || ModuleConfig.contentStatus.idea;
    const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('zh-CN') : '';
    return `
      <div class="content-card" data-id="${item.id}">
        <div class="content-card-header">
          <span class="tag ${statusInfo.tag}">${statusInfo.label}</span>
          ${dateStr ? `<span class="content-card-date">${dateStr}</span>` : ''}
        </div>
        <div class="content-card-body">
          <div class="content-card-title">${this.esc(item.title || '未命名内容')}</div>
          <div class="content-card-desc">${this.esc((item.content || '').slice(0, 80))}</div>
        </div>
        <div class="content-card-footer">
          <div class="content-card-tags">
            ${item.platform ? `<span class="tag tag-gray">${this.esc(item.platform)}</span>` : ''}
            ${(item.tags || []).slice(0, 2).map(t => `<span class="tag tag-gray">${this.esc(t)}</span>`).join('')}
          </div>
          <div class="content-card-actions">
            <button class="ghost-btn edit-content-btn" data-id="${item.id}" title="编辑">${Icons.edit}</button>
            <button class="ghost-btn delete-content-btn" data-id="${item.id}" title="删除">${Icons.trash}</button>
          </div>
        </div>
      </div>
    `;
  },

  bindContentEvents() {
    document.querySelectorAll('.content-tabs .content-tab').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.content-tabs .content-tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        this.filterContent(el.dataset.status);
      });
    });
    document.getElementById('newContentBtn')?.addEventListener('click', () => this.showContentEditor());
    document.getElementById('aiWriteBtn')?.addEventListener('click', () => this.showAIWritePanel());
    document.querySelectorAll('.edit-content-btn').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); this.showContentEditor(el.dataset.id); });
    });
    document.querySelectorAll('.delete-content-btn').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); this.deleteContent(el.dataset.id); });
    });
    document.querySelectorAll('.content-card[data-id]').forEach(el => {
      el.addEventListener('click', () => this.showContentEditor(el.dataset.id));
    });
  },

  filterContent(status) {
    const items = Store.getContentItems();
    const filtered = status === 'all' ? items : items.filter(i => i.status === status);
    const container = document.getElementById('contentList');

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-title">暂无内容</div><div class="empty-state-desc">这个分类下还没有内容</div></div>`;
      return;
    }

    container.innerHTML = `<div class="content-grid">${filtered.map(item => this.renderContentCard(item)).join('')}</div>`;

    container.querySelectorAll('.content-card[data-id]').forEach(el => {
      el.addEventListener('click', () => this.showContentEditor(el.dataset.id));
    });
  },

  showContentEditor(id) {
    const item = id ? Store.getContentItem(id) : { title: '', content: '', status: 'idea', platform: '小红书', tags: [] };
    this.showModal(`
      <div class="modal-header">
        <h3>${id ? '编辑内容' : '新建内容'}</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input" id="contentTitle" value="${this.esc(item.title)}" placeholder="输入内容标题">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">状态</label>
            <select class="form-select" id="contentStatus">
              <option value="idea" ${item.status === 'idea' ? 'selected' : ''}>创意</option>
              <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>草稿</option>
              <option value="editing" ${item.status === 'editing' ? 'selected' : ''}>编辑中</option>
              <option value="published" ${item.status === 'published' ? 'selected' : ''}>已发布</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">平台</label>
            <select class="form-select" id="contentPlatform">
              <option value="小红书" ${item.platform === '小红书' ? 'selected' : ''}>小红书</option>
              <option value="抖音" ${item.platform === '抖音' ? 'selected' : ''}>抖音</option>
              <option value="公众号" ${item.platform === '公众号' ? 'selected' : ''}>公众号</option>
              <option value="B站" ${item.platform === 'B站' ? 'selected' : ''}>B站</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">内容</label>
          <textarea class="form-textarea" id="contentBody" style="min-height:200px;" placeholder="输入内容正文...">${this.esc(item.content)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">标签（逗号分隔）</label>
          <input type="text" class="form-input" id="contentTags" value="${(item.tags || []).join(', ')}" placeholder="AI工具, 效率, 打工人">
        </div>
      </div>
      <div class="modal-footer">
        ${id ? `<button class="btn-danger" onclick="App.deleteContent('${id}')">删除</button>` : ''}
        <button class="btn-primary" onclick="App.saveContent(${id ? `'${id}'` : 'null'})">保存</button>
      </div>
    `);
  },

  saveContent(id) {
    const title = document.getElementById('contentTitle')?.value.trim();
    if (!title) { this.showToast('请输入标题'); return; }
    const content = document.getElementById('contentBody')?.value;
    const status = document.getElementById('contentStatus')?.value;
    const platform = document.getElementById('contentPlatform')?.value;
    const tagsStr = document.getElementById('contentTags')?.value;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

    Store.saveContentItem({ id: id || undefined, title, content, status, platform, tags, type: 'script' });
    this.closeModal();
    this.navigate('content');
    this.showToast(id ? '内容已更新' : '内容已创建');
  },

  deleteContent(id) {
    Store.deleteContentItem(id);
    this.closeModal();
    this.navigate('content');
    this.showToast('内容已删除');
  },

  showAIWritePanel() {
    const esc = (t) => this.esc(t == null ? '' : String(t));

    // 结构化脚本渲染（仿照零一数科·视频号爆款文案生成格式）
    const buildScriptHTML = (result, platform) => {
      if (!result.structure) {
        return `
          <div class="card" style="margin-bottom:12px;">
            <div class="card-title">${esc(result.title)}</div>
            <div class="detail-body" style="margin-top:8px;white-space:pre-wrap;">${esc(result.content)}</div>
          </div>`;
      }
      const s = result.structure;
      const typeMap = { pain_point: '痛点解决型', scene: '场景植入型', drama: '剧情种草型', testimonial: '口播种草型', unboxing: '开箱测评型', tutorial: '教程/制作型' };
      const typeName = typeMap[result.script_type] || result.script_type || '—';
      const row = (seg, isCta) => `
        <tr class="${isCta ? 'script-cta' : ''}">
          <td class="script-sec">${esc(seg.section)}</td>
          <td class="script-func">${esc(seg.function)}${seg.type && seg.type !== '—' ? `<br><span class="script-type">${esc(seg.type)}</span>` : ''}</td>
          <td class="script-visual">${esc(seg.visual)}</td>
          <td class="script-dialogue">${esc(seg.dialogue)}</td>
          <td class="script-time">${esc(seg.time_range)}</td>
        </tr>`;
      const rows = [row(s.hook, false), ...(s.body?.segments || []).map(seg => row(seg, false)), row(s.cta, true)];
      const tags = (s.tags || []).map(t => `#${esc(t)}`).join(' ');
      const rhythm = s.rhythm ? `切换间隔 ${esc(s.rhythm.info_switch_interval || '—')} · 情绪 ${esc(s.rhythm.emotion_curve || '—')} · 张力 ${esc(s.rhythm.energy_level || '—')}` : '';
      return `
        <div class="card script-card" style="margin-bottom:12px;">
          <div class="card-title">${esc(result.title)}</div>
          <div class="script-meta">脚本类型：${esc(typeName)} · 时长：${result.duration_sec || '—'}s · 平台：${esc(platform)}</div>
          ${s.structure_summary ? `<div class="script-summary">${esc(s.structure_summary)}</div>` : ''}
          <div class="table-scroll">
            <table class="script-table">
              <thead><tr><th>段落</th><th>功能</th><th>画面/配图</th><th>台词/文案</th><th>时长</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
          </div>
          ${rhythm ? `<div class="script-rhythm">节奏：${rhythm}</div>` : ''}
          ${tags ? `<div class="script-tags">${tags}</div>` : ''}
          <div class="script-full">
            <div class="script-full-title">口播/正文全文</div>
            <pre class="script-full-text">${esc(result.fullText || '')}</pre>
          </div>
        </div>`;
    };

    this.showModal(`
      <div class="modal-header">
        <h3>AI 写作</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <p class="modal-tip">仿「零一数科·视频号爆款文案」逻辑：填全信息，AI 产出结构化 Hook / 中段 / CTA 脚本（含画面 + 台词）。</p>
        <div class="form-group">
          <label class="form-label">选题/主题 <span class="req">*</span></label>
          <input type="text" class="form-input" id="aiWriteTopic" placeholder="如：5个打工人必备的AI工具">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">平台 <span class="req">*</span></label>
            <select class="form-select" id="aiWritePlatform">
              <option value="抖音">抖音</option>
              <option value="小红书">小红书</option>
              <option value="视频号">视频号</option>
              <option value="公众号">公众号</option>
              <option value="知乎">知乎</option>
              <option value="B站">B站</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">创作目的 <span class="req">*</span></label>
            <select class="form-select" id="aiWritePurpose">
              <option value="种草">种草</option>
              <option value="带货">带货</option>
              <option value="涨粉">涨粉</option>
              <option value="品牌曝光">品牌曝光</option>
              <option value="引流">引流</option>
              <option value="内容种草">内容种草</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">行业/领域 <span class="req">*</span></label>
            <input type="text" class="form-input" id="aiWriteIndustry" placeholder="如：AI工具 / 厨房清洁 / 母婴">
          </div>
          <div class="form-group">
            <label class="form-label">目标受众 <span class="req">*</span></label>
            <input type="text" class="form-input" id="aiWriteAudience" placeholder="如：家庭主妇 / 一线城市白领">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">产品/卖点（可选）</label>
          <input type="text" class="form-input" id="aiWriteProduct" placeholder="如：洁娘子食用小苏打（可不填）">
        </div>
        <button class="btn-primary" id="doAIWriteBtn" style="width:100%;justify-content:center;">${Icons.sparkles} 生成内容</button>
        <div id="aiWriteResult" style="margin-top:16px;"></div>
      </div>
    `);

    document.getElementById('doAIWriteBtn')?.addEventListener('click', async () => {
      const topic = document.getElementById('aiWriteTopic')?.value.trim();
      const platform = document.getElementById('aiWritePlatform')?.value;
      const purpose = document.getElementById('aiWritePurpose')?.value;
      const industry = document.getElementById('aiWriteIndustry')?.value.trim();
      const audience = document.getElementById('aiWriteAudience')?.value.trim();
      const product = document.getElementById('aiWriteProduct')?.value.trim();
      const resultDiv = document.getElementById('aiWriteResult');
      const btn = document.getElementById('doAIWriteBtn');

      if (!topic) { this.showToast('请输入选题'); return; }
      if (!industry) { this.showToast('请输入行业/领域'); return; }
      if (!audience) { this.showToast('请输入目标受众'); return; }

      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> 生成中...';
      resultDiv.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>AI 正在创作...</p></div>';

      const result = await API.generateContent({ topic, platform, purpose, industry, audience, product });

      btn.disabled = false;
      btn.innerHTML = `${Icons.sparkles} 生成内容`;

      if (result.error) {
        resultDiv.innerHTML = `<div class="alert-card"><span class="alert-icon">${Icons.alert}</span><div class="alert-content"><div class="alert-title">生成失败</div><div class="alert-desc">${esc(result.message || '请检查 API 配置')}</div></div></div>`;
        return;
      }

      const content = result.fullText || result.content || '';
      const title = result.title || topic;

      resultDiv.innerHTML = `
        ${buildScriptHTML(result, platform)}
        <button class="btn-primary" id="adoptAIContentBtn" style="width:100%;justify-content:center;">采纳并保存</button>
      `;

      document.getElementById('adoptAIContentBtn')?.addEventListener('click', () => {
        Store.saveContentItem({
          title,
          content,
          status: 'draft',
          platform,
          tags: (result.tags && result.tags.length) ? result.tags : [platform, 'AI生成'],
          type: 'script',
        });
        this.closeModal();
        this.navigate('content');
        this.showToast('内容已保存到草稿');
      });
    });
  },

  // ===== 爆款拆解（Skill 模式） =====
  renderDecomp() {
    const records = Store.getDecompRecords();
    const pending = records.filter(r => r.status === 'pending' || r.status === 'analyzing')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const analyzed = records.filter(r => r.status === 'analyzed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const dataFields = [
      { key: 'spend', label: '消耗（元）', placeholder: '如：1200' },
      { key: 'impressions', label: '曝光量', placeholder: '如：50000' },
      { key: 'ctr', label: 'CTR（%）', placeholder: '如：2.5' },
      { key: 'cvr', label: 'CVR（%）', placeholder: '如：1.2' },
      { key: 'roi', label: 'ROI', placeholder: '如：2.3' },
      { key: 'completionRate', label: '完播率（%）', placeholder: '如：35' },
    ];

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>爆款拆解</h2>
          ${this.helpBtn('decomp')}
        </div>
      </div>

      <div class="today-section">
        <div class="today-section-header">
          <h3>历史拆解报告</h3>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn-secondary" id="manualUploadReportBtn" style="padding:6px 12px;font-size:12px;">${Icons.upload} 手动上传报告</button>
            <span class="count">${analyzed.length}</span>
          </div>
        </div>
        ${analyzed.length === 0 ? `<div class="empty-state"><div class="empty-state-title">暂无拆解报告</div><div class="empty-state-desc">上传视频并录入数据，AI 将直接生成拆解报告</div></div>` :
          '<div class="decomp-grid">' + analyzed.map(r => `
            <div class="decomp-card decomp-record-item" data-id="${r.id}">
              <div class="decomp-card-header">
                <span class="tag tag-green">已分析</span>
                <span class="tag tag-gray">${new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <div class="decomp-card-title">${this.esc(r.videoTitle || '未命名视频').slice(0, 60)}</div>
              <div class="decomp-card-meta">
                <span class="tag tag-gray">${r.platform || '未知平台'}</span>
                ${r.goal ? `<span class="tag tag-blue">${this.esc(r.goal)}</span>` : ''}
              </div>
              <div class="decomp-card-footer">
                <button class="ghost-btn view-decomp-btn" data-id="${r.id}" title="查看报告">${Icons.eye}</button>
                <button class="ghost-btn delete-decomp-btn" data-id="${r.id}" title="删除">${Icons.trash}</button>
              </div>
            </div>
          `).join('') + '</div>'
        }
      </div>

      ${pending.length > 0 ? `
        <div class="today-section">
          <div class="today-section-header">
            <h3>待分析任务</h3>
            <span class="count">${pending.length}</span>
          </div>
          <div class="decomp-grid">
            ${pending.map(r => `
              <div class="decomp-card decomp-record-item" data-id="${r.id}">
                <div class="decomp-card-header">
                  <span class="tag tag-gray">${r.platform || '未知平台'}</span>
                  ${r.status === 'analyzing' ? `<span class="tag tag-blue"><span class="spinner" style="width:10px;height:10px;border-width:1.5px;display:inline-block;vertical-align:middle;margin-right:4px;"></span>分析中</span>` : `<span class="tag tag-yellow">待分析</span>`}
                </div>
                <div class="decomp-card-title">${this.esc(r.videoTitle || '未命名视频').slice(0, 60)}</div>
                <div class="decomp-card-meta">
                  ${r.goal ? `<span class="tag tag-blue">${this.esc(r.goal)}</span>` : ''}
                  <span class="tag tag-gray">${new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <div class="decomp-card-footer">
                  ${r.status === 'analyzing' ? '' : `<button class="ghost-btn analyze-decomp-btn" data-id="${r.id}" title="AI 分析">${Icons.sparkles}</button>`}
                  <button class="ghost-btn delete-decomp-btn" data-id="${r.id}" title="删除">${Icons.trash}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="card decomp-upload-card" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:36px;height:36px;border-radius:10px;background:#EEF4FC;color:#3A5A8A;display:flex;align-items:center;justify-content:center;">${Icons.upload}</div>
          <div>
            <div style="font-weight:700;">上传视频并录入数据</div>
            <div style="font-size:12px;color:var(--text-mute);">填写视频信息后，点击「保存并分析」直接生成拆解报告</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">视频标题 <span class="required">*</span></label>
          <input type="text" class="form-input" id="decompTitle" placeholder="输入视频标题">
        </div>
        <div class="form-group">
          <label class="form-label">本地视频路径 / 链接 <span class="required">*</span></label>
          <input type="text" class="form-input" id="decompVideoUrl" placeholder="如：/Users/xuleng/Desktop/video.mp4 或 https://...">
        </div>
        <div class="form-group">
          <label class="form-label">口播文案 / 字幕 / 脚本</label>
          <textarea class="form-textarea" id="decompScript" style="min-height:120px;" placeholder="粘贴视频的口播文案、字幕脚本或文字描述..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">发布平台</label>
            <select class="form-select" id="decompPlatform">
              <option value="抖音">抖音</option>
              <option value="小红书">小红书</option>
              <option value="视频号">视频号</option>
              <option value="B站">B站</option>
              <option value="快手">快手</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">目标定位</label>
            <select class="form-select" id="decompGoal">
              <option value="">请选择</option>
              <option value="直播间引流">直播间引流</option>
              <option value="挂车成交">挂车成交</option>
            </select>
          </div>
        </div>

        <div style="font-size:12px;font-weight:600;color:var(--text-soft);margin:16px 0 10px;">投放数据（可选）</div>
        <div class="form-row decomp-data-row">
          ${dataFields.map(f => `
            <div class="form-group">
              <label class="form-label">${f.label}</label>
              <input type="text" class="form-input decomp-data-field" data-key="${f.key}" placeholder="${f.placeholder}">
            </div>
          `).join('')}
        </div>

        <div class="form-group">
          <label class="form-label">补充描述（可选）</label>
          <input type="text" class="form-input" id="decompDesc" placeholder="如：视频时长、互动数据、发布时间等">
        </div>

        <button class="btn-primary" id="saveDecompTaskBtn" style="width:100%;justify-content:center;">${Icons.sparkles} 保存并分析</button>
        <div style="font-size:12px;color:var(--text-mute);margin-top:8px;">
          保存后 AI 将直接在页面内生成拆解报告，无需复制粘贴。需在设置中配置 Deepseek API Key。
        </div>
      </div>
    `;
  },

  bindDecompEvents() {
    document.getElementById('saveDecompTaskBtn')?.addEventListener('click', () => this.saveDecompTask());
    document.getElementById('manualUploadReportBtn')?.addEventListener('click', () => this.showManualReportModal());
    document.querySelectorAll('.analyze-decomp-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.analyzeDecompTask(el.dataset.id);
      });
    });
    document.querySelectorAll('.view-decomp-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewDecomp(el.dataset.id);
      });
    });
    document.querySelectorAll('.delete-decomp-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        Store.deleteDecompRecord(el.dataset.id);
        this.navigate('decomp');
        this.showToast('拆解记录已删除');
      });
    });
    document.querySelectorAll('.decomp-record-item').forEach(el => {
      el.addEventListener('click', () => this.viewDecomp(el.dataset.id));
    });
  },

  showManualReportModal() {
    this.showModal(`
      <div class="modal-header">
        <h3>手动上传拆解报告</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">视频标题 <span class="required">*</span></label>
          <input type="text" class="form-input" id="manualReportTitle" placeholder="输入视频标题">
        </div>
        <div class="form-row decomp-data-row">
          <div class="form-group">
            <label class="form-label">发布平台</label>
            <select class="form-select" id="manualReportPlatform">
              <option value="抖音">抖音</option>
              <option value="小红书">小红书</option>
              <option value="视频号">视频号</option>
              <option value="B站">B站</option>
              <option value="快手">快手</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">目标定位</label>
            <select class="form-select" id="manualReportGoal">
              <option value="">请选择</option>
              <option value="直播间引流">直播间引流</option>
              <option value="挂车成交">挂车成交</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">拆解报告 <span class="required">*</span></label>
          <textarea class="form-textarea" id="manualReportText" style="min-height:240px;" placeholder="粘贴完整的拆解报告内容，支持 Markdown..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" id="saveManualReportBtn">${Icons.upload} 保存报告</button>
      </div>
    `);

    document.getElementById('saveManualReportBtn')?.addEventListener('click', () => this.saveManualReport());
  },

  saveManualReport() {
    const title = document.getElementById('manualReportTitle')?.value.trim();
    const report = document.getElementById('manualReportText')?.value.trim();
    if (!title || !report) { this.showToast('请填写视频标题和报告内容'); return; }

    Store.saveDecompRecord({
      videoTitle: title,
      videoUrl: '',
      script: '',
      platform: document.getElementById('manualReportPlatform')?.value || '抖音',
      goal: document.getElementById('manualReportGoal')?.value || '',
      desc: '手动上传报告',
      data: {},
      report,
      status: 'analyzed',
    });
    this.closeModal();
    this.navigate('decomp');
    this.showToast('手动报告已保存');
  },

  saveDecompTask() {
    const title = document.getElementById('decompTitle')?.value.trim();
    const videoUrl = document.getElementById('decompVideoUrl')?.value.trim();
    const script = document.getElementById('decompScript')?.value.trim();
    const platform = document.getElementById('decompPlatform')?.value || '抖音';
    const goal = document.getElementById('decompGoal')?.value || '';
    const desc = document.getElementById('decompDesc')?.value.trim();

    if (!title) {
      this.showToast('请填写视频标题');
      return;
    }

    const data = {};
    document.querySelectorAll('.decomp-data-field').forEach(el => {
      const val = el.value.trim();
      if (val) data[el.dataset.key] = val;
    });

    const record = Store.saveDecompRecord({
      videoTitle: title,
      videoUrl: videoUrl || '',
      script,
      platform,
      goal,
      desc,
      data,
      report: '',
      status: 'pending',
    });

    this.showToast('已保存，正在启动 AI 分析...');
    this.analyzeDecompTask(record.id);
  },

  async analyzeDecompTask(id) {
    const record = Store.getDecompRecords().find(r => r.id === id);
    if (!record) return;

    const settings = Store.getSettings();
    if (!settings.deepseekApiKey) {
      this.showModal(`
        <div class="modal-header">
          <h3>需要配置 API Key</h3>
          <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
        </div>
        <div class="modal-body">
          <p style="line-height:1.8;color:var(--text-soft);">爆款拆解功能需要调用 Deepseek API 进行 AI 分析。请先在「设置」页面配置 Deepseek API Key。</p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="App.closeModal();App.navigate('settings');">前往设置</button>
        </div>
      `);
      return;
    }

    // 标记为分析中
    Store.saveDecompRecord({ id, status: 'analyzing' });
    this.navigate('decomp');

    const result = await API.analyzeVideoDecomp({
      videoTitle: record.videoTitle,
      videoUrl: record.videoUrl,
      script: record.script,
      platform: record.platform,
      goal: record.goal,
      data: record.data,
      desc: record.desc,
    });

    if (result.error) {
      Store.saveDecompRecord({ id, status: 'pending' });
      this.navigate('decomp');
      this.showToast('分析失败：' + (result.message || result.error));
      return;
    }

    Store.saveDecompRecord({
      id,
      report: result.report,
      status: 'analyzed',
      updatedAt: new Date().toISOString(),
    });

    this.navigate('decomp');
    this.showToast('拆解报告已生成');
    // 自动打开报告
    setTimeout(() => this.viewDecomp(id), 300);
  },

  viewDecomp(id) {
    const record = Store.getDecompRecords().find(r => r.id === id);
    if (!record) return;

    let bodyHtml = '';

    if (record.report) {
      // 渲染 AI 生成的 Markdown 报告
      bodyHtml = `<div class="detail-body decomp-report-body">${this.renderMarkdown(record.report)}</div>`;
    } else if (record.analysis && typeof record.analysis === 'object') {
      // 兼容旧版结构化分析数据
      const analysis = record.analysis;
      const scoreLabels = {
        topic: '选题度', hook: '钩子力', structure: '结构力',
        emotion: '情绪力', info: '信息量', interaction: '互动性'
      };
      bodyHtml = `
        ${analysis.segments && analysis.segments.length ? `
          <div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:6px;">结构分段</div>
            ${analysis.segments.map(seg => `
              <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
                <span class="tag tag-gray" style="flex-shrink:0;">${this.esc(seg.duration || seg.index || '-')}</span>
                <div>
                  <div style="font-weight:500;font-size:13px;">${this.esc(seg.name || '')}</div>
                  <div style="font-size:12px;color:var(--text-mute);">${this.esc(seg.function || '')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${analysis.scores ? `
          <div style="margin-bottom:16px;">
            <div style="font-weight:600;margin-bottom:6px;">六维评分</div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
              ${Object.entries(analysis.scores).map(([key, val]) => `
                <div style="padding:6px;border:1px solid var(--border);border-radius:6px;">
                  <div style="display:flex;justify-content:space-between;">
                    <span style="font-size:12px;">${scoreLabels[key] || key}</span>
                    <span style="font-weight:700;color:var(--accent);">${val.score}/10</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${analysis.summary ? `
          <div style="padding:10px;background:var(--bg-secondary);border-radius:8px;">
            <div style="font-weight:600;margin-bottom:4px;">总评</div>
            <div style="font-size:12px;line-height:1.6;">${this.esc(analysis.summary)}</div>
          </div>
        ` : ''}
      `;
    } else {
      bodyHtml = '<div class="empty-state"><div class="empty-state-desc">暂无报告内容</div></div>';
    }

    this.showModal(`
      <div class="modal-header">
        <h3>拆解报告</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="detail-meta" style="margin-bottom:12px;">
          ${record.videoTitle ? `<div style="font-weight:600;margin-bottom:4px;">${this.esc(record.videoTitle)}</div>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
            ${record.platform ? `<span class="tag tag-gray">${this.esc(record.platform)}</span>` : ''}
            ${record.goal ? `<span class="tag tag-blue">${this.esc(record.goal)}</span>` : ''}
            <span class="tag tag-gray">${new Date(record.createdAt).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        ${bodyHtml}
      </div>
      <div class="modal-footer">
        <button class="btn-danger" onclick="App.deleteDecomp('${id}')">删除</button>
        <button class="btn-primary" onclick="App.closeModal()">关闭</button>
      </div>
    `);
  },

  deleteDecomp(id) {
    Store.deleteDecompRecord(id);
    this.closeModal();
    this.navigate('decomp');
    this.showToast('拆解记录已删除');
  },

  // ===== 收集箱（已整合为用户灵感，保留兼容方法） =====
  renderInbox() {
    this.currentInspirationTab = 'user';
    this.navigate('topics');
  },

  bindInboxEvents() {},

  showInboxEditor() {
    this.openUserInspirationEditor();
  },

  saveInboxItem() {},

  // ===== AI 帮手 =====
  aiMascotSVG() {
    return `<svg class="ai-welcome-mascot" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="AI 小猫助手">
      <defs>
        <linearGradient id="mascotFace" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#FAFBF7"/>
        </linearGradient>
        <linearGradient id="mascotGreen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#C2F84F"/>
          <stop offset="100%" stop-color="#B0E840"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="#F8FAF3"/>
      <!-- 天线 -->
      <line x1="100" y1="22" x2="100" y2="42" stroke="url(#mascotGreen)" stroke-width="5" stroke-linecap="round"/>
      <circle cx="100" cy="17" r="8" fill="url(#mascotGreen)"/>
      <circle cx="100" cy="17" r="3" fill="#FFFFFF" opacity="0.8"/>
      <!-- 左耳 -->
      <path d="M42 62 L24 22 L74 42 Z" fill="url(#mascotGreen)" stroke="#A8D93A" stroke-width="3" stroke-linejoin="round"/>
      <path d="M42 62 L33 38 L60 50 Z" fill="#D4F58A" opacity="0.6"/>
      <!-- 右耳 -->
      <path d="M158 62 L176 22 L126 42 Z" fill="url(#mascotGreen)" stroke="#A8D93A" stroke-width="3" stroke-linejoin="round"/>
      <path d="M158 62 L167 38 L140 50 Z" fill="#D4F58A" opacity="0.6"/>
      <!-- 脸 -->
      <ellipse cx="100" cy="106" rx="74" ry="64" fill="url(#mascotFace)" stroke="#E8EBE2" stroke-width="2"/>
      <!-- 左眼睛 -->
      <circle cx="70" cy="94" r="11" fill="#1A1A1A"/>
      <circle cx="73" cy="91" r="3.5" fill="#FFFFFF"/>
      <!-- 右机器眼 -->
      <circle cx="130" cy="94" r="13" fill="#1A1A1A"/>
      <circle cx="130" cy="94" r="7" fill="#C2F84F"/>
      <circle cx="132" cy="92" r="2.5" fill="#FFFFFF"/>
      <circle cx="130" cy="94" r="10" fill="none" stroke="#444" stroke-width="1.5"/>
      <line x1="122" y1="86" x2="138" y2="102" stroke="#444" stroke-width="1"/>
      <line x1="138" y1="86" x2="122" y2="102" stroke="#444" stroke-width="1"/>
      <!-- 鼻子 -->
      <path d="M94 116 L106 116 L100 124 Z" fill="#FFB1D8"/>
      <!-- 嘴巴 -->
      <path d="M82 128 Q100 143 118 128" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round"/>
      <!-- 腮红 -->
      <ellipse cx="52" cy="118" rx="9" ry="6" fill="#FFB1D8" opacity="0.35"/>
      <ellipse cx="148" cy="118" rx="9" ry="6" fill="#FFB1D8" opacity="0.35"/>
      <!-- 胡须 -->
      <line x1="30" y1="108" x2="55" y2="112" stroke="#CFCFCF" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="30" y1="118" x2="55" y2="118" stroke="#CFCFCF" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="170" y1="108" x2="145" y2="112" stroke="#CFCFCF" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="170" y1="118" x2="145" y2="118" stroke="#CFCFCF" stroke-width="1.5" stroke-linecap="round"/>
      <!-- 身体 -->
      <path d="M62 158 Q100 192 138 158 L138 174 Q100 198 62 174 Z" fill="url(#mascotGreen)" stroke="#A8D93A" stroke-width="2"/>
      <!-- 胸前爱心 -->
      <path d="M90 166 Q82 158 90 152 Q100 158 110 152 Q118 158 110 166 L100 178 Z" fill="#FFB1D8"/>
    </svg>`;
  },

  // ===== AI 悬浮助手 =====
  initAIFab() {
    const btn = document.getElementById('aiFabButton');
    const overlay = document.getElementById('aiFabOverlay');
    const close = document.getElementById('aiFabClose');

    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAIFab();
    });

    close?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAIFab();
    });

    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeAIFab();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.aiFabOpen) this.closeAIFab();
    });
  },

  openAIFab() {
    const overlay = document.getElementById('aiFabOverlay');
    const body = document.getElementById('aiFabBody');
    const status = document.getElementById('aiFabHeaderStatus');
    const btn = document.getElementById('aiFabButton');
    if (!overlay || !body) return;

    body.innerHTML = this.renderAI();
    overlay.classList.add('active');
    btn?.classList.add('active');
    this.aiFabOpen = true;

    const settings = Store.getSettings();
    const hasApiKey = !!settings.deepseekApiKey;
    if (status) {
      status.textContent = hasApiKey ? 'API 已连接' : '未配置 API';
      status.className = 'ai-fab-header-status' + (hasApiKey ? ' connected' : ' disconnected');
    }

    this.bindAIEvents();
    const messagesEl = document.getElementById('aiMessages');
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    const input = document.getElementById('aiInput');
    if (input && hasApiKey) input.focus();
  },

  closeAIFab() {
    const overlay = document.getElementById('aiFabOverlay');
    const btn = document.getElementById('aiFabButton');
    overlay?.classList.remove('active');
    btn?.classList.remove('active');
    this.aiFabOpen = false;
  },

  toggleAIFab() {
    if (this.aiFabOpen) this.closeAIFab();
    else this.openAIFab();
  },

  renderAI() {
    const messages = Store.getAIChat();
    const settings = Store.getSettings();
    const hasApiKey = !!settings.deepseekApiKey;

    const messagesHtml = messages.map(msg => `
      <div class="ai-message ${msg.role}">
        <div class="ai-message-avatar">${msg.role === 'user' ? Icons.user : Icons.ai}</div>
        <div class="ai-message-bubble">${this.esc(msg.content)}</div>
      </div>
    `).join('');

    const welcomeHtml = messages.length === 0 ? `
      <div class="ai-welcome" id="aiWelcome">
        ${this.aiMascotSVG()}
        <div class="ai-welcome-title">你好呀，我是 <span class="accent">AI 小猫助手</span></div>
        <div class="ai-welcome-desc">我会陪你一起搞定内容创作：选题、写脚本、优化标题、分析数据……有事儿尽管问我～</div>
        <div class="ai-welcome-abilities">
          <span class="ai-welcome-ability"><span class="ai-welcome-ability-dot"></span>想选题</span>
          <span class="ai-welcome-ability"><span class="ai-welcome-ability-dot"></span>写笔记</span>
          <span class="ai-welcome-ability"><span class="ai-welcome-ability-dot"></span>优化标题</span>
          <span class="ai-welcome-ability"><span class="ai-welcome-ability-dot"></span>数据分析</span>
        </div>
      </div>
    ` : '';

    return `
      ${!hasApiKey ? `<div class="ai-fab-api-alert">
        <span class="ai-fab-api-alert-icon">${Icons.alert}</span>
        <div class="ai-fab-api-alert-text">
          <div class="ai-fab-api-alert-title">未配置 AI API</div>
          <div class="ai-fab-api-alert-desc">到「设置」页配置 Deepseek API Key 后即可使用。</div>
        </div>
      </div>` : ''}
      <div class="ai-chat" id="aiChat">
        ${welcomeHtml}
        <div id="aiMessages" class="ai-messages" style="${messages.length === 0 ? 'display:none;' : ''}">${messagesHtml}</div>
        <div class="ai-suggestions">
          <div class="ai-suggestion-chip" data-suggestion="帮我想5个AI工具方向的小红书选题">想选题</div>
          <div class="ai-suggestion-chip" data-suggestion="帮我写一个小红书笔记，主题是打工人必备的AI工具">写笔记</div>
          <div class="ai-suggestion-chip" data-suggestion="帮我优化标题：AI工具分享">优化标题</div>
          <div class="ai-suggestion-chip" data-suggestion="分析一下我的内容策略">数据分析</div>
        </div>
        <div class="ai-input-area">
          <textarea id="aiInput" placeholder="${hasApiKey ? '输入你的问题...' : '请先配置 Deepseek API Key'}" rows="1"></textarea>
          <button class="btn-primary" id="aiSendBtn">${Icons.send}</button>
        </div>
      </div>
    `;
  },

  bindAIEvents() {
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSendBtn');

    sendBtn?.addEventListener('click', () => this.sendAIMessage());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendAIMessage();
      }
    });
    input?.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    document.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.suggestion;
        this.sendAIMessage();
      });
    });
  },

  async sendAIMessage() {
    const input = document.getElementById('aiInput');
    const text = input?.value.trim();
    if (!text) return;

    const settings = Store.getSettings();
    if (!settings.deepseekApiKey) {
      this.showToast('请先配置 Deepseek API Key');
      return;
    }

    // Save user message
    Store.saveAIMessage({ role: 'user', content: text });
    input.value = '';
    input.style.height = 'auto';

    // Hide welcome card on first message
    const welcomeEl = document.getElementById('aiWelcome');
    if (welcomeEl) welcomeEl.style.display = 'none';

    // Re-render messages
    const messages = Store.getAIChat();
    const messagesEl = document.getElementById('aiMessages');
    messagesEl.style.display = 'flex';
    messagesEl.innerHTML = messages.map(msg => `
      <div class="ai-message ${msg.role}">
        <div class="ai-message-avatar">${msg.role === 'user' ? Icons.user : Icons.ai}</div>
        <div class="ai-message-bubble">${this.esc(msg.content)}</div>
      </div>
    `).join('') + `
      <div class="ai-message bot" id="aiTyping">
        <div class="ai-message-avatar">${Icons.ai}</div>
        <div class="ai-message-bubble"><div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:6px;"></div>正在思考...</div>
      </div>
    `;
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Prepare messages for API
    const apiMessages = [
      {
        role: 'system',
        content: '你是小冷的AI工作助手，专注于AI自媒体内容创作（抖音和小红书平台）。你的职责包括：选题策划、内容创作、标题优化、数据分析建议等。回答要简洁实用，用中文回复。小冷做的是AI相关实用小功能的自媒体内容。'
      },
      ...messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];

    const result = await API.aiChat(apiMessages);

    // Remove typing indicator
    document.getElementById('aiTyping')?.remove();

    if (result.error) {
      Store.saveAIMessage({ role: 'bot', content: `抱歉，出了一些问题：${result.message || '请检查API配置'}` });
    } else {
      Store.saveAIMessage({ role: 'bot', content: result.content || '抱歉，我无法理解你的问题。' });
    }

    // Re-render
    const updatedMessages = Store.getAIChat();
    messagesEl.innerHTML = updatedMessages.map(msg => `
      <div class="ai-message ${msg.role}">
        <div class="ai-message-avatar">${msg.role === 'user' ? Icons.user : Icons.ai}</div>
        <div class="ai-message-bubble">${this.esc(msg.content)}</div>
      </div>
    `).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  },

  // ===== 数据看板 =====
  renderDashboard() {
    const videos = Store.getVideos();
    const recent = [...videos].sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
    const latest = recent[0];

    // 按 createdAt 日期分组生成时间段选项
    const dateGroups = {};
    videos.forEach(v => {
      const d = (v.createdAt || '').slice(0, 10);
      if (d) dateGroups[d] = (dateGroups[d] || 0) + 1;
    });
    const dateOptions = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
    const filteredVideos = this.dashboardFilter === 'all' ? videos : videos.filter(v => (v.createdAt || '').slice(0, 10) === this.dashboardFilter);

    const aggregateKeys = ['views', 'likes', 'comments', 'shares', 'favorites',
      'completionRate', 'completion5sRate', 'bounce2sRate', 'avgDuration', 'avgPlayRatio',
      'notInterestedRate', 'followGained', 'followLost', 'followGainRate', 'followLossRate'];
    const aggregates = Store.aggregateVideos(filteredVideos, aggregateKeys);

    const fmt = (k, v) => {
      if (v == null || isNaN(v)) return '0';
      const num = Number(v);
      if (k.endsWith('Rate') || k === 'avgPlayRatio') return num.toFixed(1) + '%';
      if (k === 'avgDuration') return num.toFixed(1) + '秒';
      if (k === 'followGained' || k === 'followLost') return num.toLocaleString();
      if (k === 'views' || k === 'likes' || k === 'favorites' || k === 'comments' || k === 'shares') {
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        return num.toLocaleString();
      }
      return num.toLocaleString();
    };

    const summaryCards = [
      { key: 'views', label: '总播放量', icon: 'eye' },
      { key: 'likes', label: '总点赞', icon: 'star' },
      { key: 'favorites', label: '总收藏', icon: 'tag' },
      { key: 'followGained', label: '总吸粉', icon: 'user' },
    ];

    return `
      <div class="dashboard-page">
        <div class="page-header">
          <div class="page-header-left">
            <h2>数据看板 ${this.helpBtn('dashboard')}</h2>
            <p class="page-header-desc">抖音视频数据追踪 · 共 ${filteredVideos.length} 条视频</p>
          </div>
          <div class="page-header-actions">
            <button class="btn-secondary" id="dashboardCSVBtn">${Icons.upload} CSV 上传</button>
            <button class="btn-primary" id="dashboardAddBtn">${Icons.plus} 新增数据</button>
          </div>
        </div>

        <div class="dashboard-summary">
          ${summaryCards.map(c => `
            <div class="summary-card">
              <div class="summary-icon" style="background:#F8FEE0;color:#6B8E00;">${Icons[c.icon] || ''}</div>
              <div class="summary-info">
                <div class="summary-label">${c.label}</div>
                <div class="summary-value">${fmt(c.key, (aggregates[c.key] || {}).sum || 0)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="dashboard-tabs">
          <button class="dash-tab active" data-tab="overview">${Icons.chartBar} 总览</button>
          <button class="dash-tab" data-tab="compare">${Icons.grid} 对比分析</button>
          <button class="dash-tab" data-tab="report">${Icons.sparkles} AI 周报</button>
        </div>

        <div class="dash-panel active" data-panel="overview">
          <div class="dashboard-charts">
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-header-text">
                  <div class="chart-title">播放量趋势</div>
                  <div class="chart-sub">最近发布视频数据</div>
                </div>
                <div class="chart-legend-inline" id="legend-chartViews"></div>
              </div>
              <div class="chart-body" id="chartViews"></div>
            </div>
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-header-text">
                  <div class="chart-title">互动率分布</div>
                  <div class="chart-sub">点赞率 / 评论率 / 收藏率</div>
                </div>
                <div class="chart-legend-inline" id="legend-chartEngagement"></div>
              </div>
              <div class="chart-body" id="chartEngagement"></div>
            </div>
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-header-text">
                  <div class="chart-title">完播质量</div>
                  <div class="chart-sub">完播率 / 5s完播 / 2s跳出</div>
                </div>
                <div class="chart-legend-inline" id="legend-chartCompletion"></div>
              </div>
              <div class="chart-body" id="chartCompletion"></div>
            </div>
            <div class="chart-card">
              <div class="chart-header">
                <div class="chart-header-text">
                  <div class="chart-title">涨粉情况</div>
                  <div class="chart-sub">吸粉 vs 脱粉</div>
                </div>
                <div class="chart-legend-inline" id="legend-chartFollow"></div>
              </div>
              <div class="chart-body" id="chartFollow"></div>
            </div>
          </div>

          <div class="dashboard-list-section">
            <div class="section-header">
              <h3>视频数据列表</h3>
              <div style="display:flex;align-items:center;gap:10px;">
                ${dateOptions.length > 1 ? `
                  <select class="form-select" id="dashboardTimeFilter" style="min-width:140px;font-size:12px;padding:6px 10px;">
                    <option value="all" ${this.dashboardFilter === 'all' ? 'selected' : ''}>全部时间</option>
                    ${dateOptions.map(d => `<option value="${d}" ${this.dashboardFilter === d ? 'selected' : ''}>${d} 上传 (${dateGroups[d]})</option>`).join('')}
                  </select>
                ` : ''}
                <span class="section-count">${filteredVideos.length} 条</span>
              </div>
            </div>
            ${filteredVideos.length === 0 ? `
              <div class="empty-state">
                <div class="empty-state-title">该时间段没有视频数据</div>
                <div class="empty-state-desc">切换时间段或点击右上角"新增数据"/"CSV 上传"开始追踪</div>
              </div>
            ` : this.renderVideoList(filteredVideos)}
          </div>
        </div>

        <div class="dash-panel" data-panel="compare">
          <div class="compare-tip">
            <div class="tip-icon">${Icons.filter}</div>
            <div class="tip-text">在视频列表中勾选 2-5 条视频，然后点击"生成对比图表"</div>
          </div>
          <div id="compareContent">
            <div class="empty-state">
              <div class="empty-state-title">请先选择要对比的视频</div>
              <div class="empty-state-desc">回到"总览"标签，在视频列表的复选框中勾选</div>
            </div>
          </div>
        </div>

        <div class="dash-panel" data-panel="report">
          ${this.renderReportPanel()}
        </div>
      </div>

      <input type="file" id="csvFileInput" accept=".csv" style="display:none;" />
    `;
  },

  renderVideoList(videos) {
    const dims = [
      { key: 'views', label: '播放量' },
      { key: 'likes', label: '点赞量' },
      { key: 'comments', label: '评论量' },
      { key: 'shares', label: '分享量' },
      { key: 'favorites', label: '收藏量' },
      { key: 'completionRate', label: '完播率' },
      { key: 'bounce2sRate', label: '2s跳出率' },
      { key: 'avgDuration', label: '平均播放时长' },
      { key: 'completion5sRate', label: '5s完播率' },
      { key: 'avgPlayRatio', label: '平均播放占比' },
      { key: 'notInterestedRate', label: '不感兴趣率' },
      { key: 'followGained', label: '吸粉量' },
      { key: 'followLost', label: '脱粉量' },
      { key: 'followGainRate', label: '吸粉率' },
      { key: 'followLossRate', label: '脱粉率' },
    ];
    const fmtVal = (k, v) => {
      if (v == null || isNaN(v)) return '—';
      const num = Number(v);
      if (k.endsWith('Rate') || k === 'avgPlayRatio') return num.toFixed(1) + '%';
      if (k === 'avgDuration') return num.toFixed(1) + '秒';
      if (num >= 10000) return (num / 10000).toFixed(1) + '万';
      return num.toLocaleString();
    };
    return `
      <div class="video-table-scroll">
        <div class="video-table" style="min-width:1520px;">
          <div class="video-table-head">
            <div class="vt-check"></div>
            <div class="vt-title">视频标题</div>
            ${dims.map(d => `<div class="vt-metric" title="${d.label}">${d.label}</div>`).join('')}
            <div class="vt-actions">操作</div>
          </div>
          ${videos.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || '')).map(v => `
            <div class="video-table-row" data-id="${v.id}">
              <div class="vt-check"><input type="checkbox" class="video-compare-check" data-id="${v.id}"></div>
              <div class="vt-title">
                <div class="vt-title-text">${this.esc(v.title || '未命名')}</div>
                <div class="vt-title-meta">${v.publishDate || ''} · ${v.duration || 0}秒 · ${v.platform || '抖音'}</div>
              </div>
              ${dims.map(d => `<div class="vt-metric" title="${d.label}: ${fmtVal(d.key, v[d.key])}">${fmtVal(d.key, v[d.key])}</div>`).join('')}
              <div class="vt-actions">
                <button class="ghost-btn view-video-btn" data-id="${v.id}" title="查看">${Icons.eye}</button>
                <button class="ghost-btn edit-video-btn" data-id="${v.id}" title="编辑">${Icons.edit}</button>
                <button class="ghost-btn delete-video-btn" data-id="${v.id}" title="删除">${Icons.trash}</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="video-table-footer">
        <button class="btn-primary" id="generateCompareBtn">${Icons.chartBar} 生成对比图表</button>
        <button class="btn-secondary" id="clearCompareBtn">清空选择</button>
      </div>
    `;
  },

  renderReportPanel() {
    const reports = Store.getReports();
    return `
      <div class="report-section">
        <div class="report-action">
          <div class="report-action-text">
            <h3>${Icons.sparkles} AI 周报</h3>
            <p>基于你的视频数据，使用「数据分析师」方法论生成专业诊断报告，包含趋势分析、问题诊断和优化建议。</p>
          </div>
          <button class="btn-primary" id="generateReportBtn">${Icons.sparkles} 生成本周报告</button>
        </div>
        <div id="reportGenerating" style="display:none;">
          <div class="card">
            <div class="ai-loading">
              <div class="spinner"></div>
              <p>AI 正在分析你的视频数据...</p>
              <p style="font-size:12px;color:var(--text-mute);margin-top:8px;">通常需要 15-40 秒</p>
            </div>
          </div>
        </div>
        <div id="reportResult"></div>
        ${reports.length > 0 ? `
          <div class="report-history">
            <div class="section-header"><h3>历史报告</h3><span class="section-count">${reports.length} 份</span></div>
            <div class="report-history-list">
              ${reports.map(r => `
                <div class="report-history-item" data-id="${r.id}">
                  <div class="report-history-info">
                    <div class="report-history-title">${this.esc(r.title || '未命名报告')}</div>
                    <div class="report-history-meta">${r.period || ''} · ${new Date(r.createdAt).toLocaleString('zh-CN')}</div>
                  </div>
                  <div class="report-history-actions">
                    <button class="ghost-btn view-report-btn" data-id="${r.id}">${Icons.eye}</button>
                    <button class="ghost-btn delete-report-btn" data-id="${r.id}">${Icons.trash}</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  bindDashboardEvents() {
    const self = this;
    document.querySelectorAll('.dash-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`.dash-panel[data-panel="${tab.dataset.tab}"]`)?.classList.add('active');
        if (tab.dataset.tab === 'overview') {
          setTimeout(() => self.renderDashboardCharts(), 50);
        }
      });
    });

    document.getElementById('dashboardAddBtn')?.addEventListener('click', () => self.openVideoForm());
    document.getElementById('dashboardCSVBtn')?.addEventListener('click', () => {
      document.getElementById('csvFileInput')?.click();
    });
    document.getElementById('csvFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) self.handleCSVImport(file);
      e.target.value = '';
    });
    document.getElementById('dashboardTimeFilter')?.addEventListener('change', (e) => {
      self.dashboardFilter = e.target.value;
      self.navigate('dashboard');
    });

    document.querySelectorAll('.view-video-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.viewVideo(btn.dataset.id);
      });
    });
    document.querySelectorAll('.edit-video-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.openVideoForm(btn.dataset.id);
      });
    });
    document.querySelectorAll('.delete-video-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定删除这条数据吗？')) {
          Store.deleteVideo(btn.dataset.id);
          self.navigate('dashboard');
          self.showToast('已删除');
        }
      });
    });

    document.getElementById('generateCompareBtn')?.addEventListener('click', () => self.generateCompare());
    document.getElementById('clearCompareBtn')?.addEventListener('click', () => {
      document.querySelectorAll('.video-compare-check').forEach(cb => cb.checked = false);
    });

    document.getElementById('generateReportBtn')?.addEventListener('click', () => self.generateReport());
    document.querySelectorAll('.view-report-btn').forEach(btn => {
      btn.addEventListener('click', () => self.viewReport(btn.dataset.id));
    });
    document.querySelectorAll('.delete-report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定删除这份报告吗？')) {
          Store.deleteReport(btn.dataset.id);
          self.navigate('dashboard');
          self.showToast('已删除');
        }
      });
    });

    setTimeout(() => {
      self.renderDashboardCharts();
      self.initChartDragAndResize();
    }, 100);
  },

  initChartDragAndResize() {
    const container = document.querySelector('.dashboard-charts');
    if (!container) return;
    container.querySelectorAll('.chart-card').forEach(card => {
      if (!card.querySelector('.chart-resize-hint')) {
        const hint = document.createElement('div');
        hint.className = 'chart-resize-hint';
        hint.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6L11 11M8 11H11V8"/></svg>`;
        card.appendChild(hint);
      }
    });
  },

  renderDashboardCharts() {
    const videos = Store.getVideos();
    if (videos.length === 0) return;

    const sorted = [...videos].sort((a, b) => (a.publishDate || '').localeCompare(b.publishDate || ''));
    const labels = sorted.map((v, i) => v.title ? v.title.slice(0, 14) + (v.title.length > 14 ? '…' : '') : `视频${i + 1}`);

    if (document.getElementById('chartViews')) {
      this.drawBarChart('chartViews', 'legend-chartViews', labels, [
        { label: '播放量', data: sorted.map(v => v.views || 0), color: '#C2F84F' },
      ]);
    }

    if (document.getElementById('chartEngagement')) {
      const likeRate = sorted.map(v => v.views ? (v.likes / v.views * 100) : 0);
      const commentRate = sorted.map(v => v.views ? (v.comments / v.views * 100) : 0);
      const favRate = sorted.map(v => v.views ? (v.favorites / v.views * 100) : 0);
      this.drawBarChart('chartEngagement', 'legend-chartEngagement', labels, [
        { label: '点赞率%', data: likeRate, color: '#E9A8CF' },
        { label: '评论率%', data: commentRate, color: '#AFC9EA' },
        { label: '收藏率%', data: favRate, color: '#FFD580' },
      ]);
    }

    if (document.getElementById('chartCompletion')) {
      this.drawLineChart('chartCompletion', 'legend-chartCompletion', labels, [
        { label: '完播率%', data: sorted.map(v => v.completionRate || 0), color: '#C2F84F' },
        { label: '5s完播%', data: sorted.map(v => v.completion5sRate || 0), color: '#9DC8F0' },
        { label: '2s跳出%', data: sorted.map(v => v.bounce2sRate || 0), color: '#FF9B9B' },
      ]);
    }

    if (document.getElementById('chartFollow')) {
      this.drawBarChart('chartFollow', 'legend-chartFollow', labels, [
        { label: '吸粉', data: sorted.map(v => v.followGained || 0), color: '#C2F84F' },
        { label: '脱粉', data: sorted.map(v => v.followLost || 0), color: '#FFB3B3' },
      ]);
    }
  },

  // 简易纯 SVG 柱状图
  drawBarChart(containerId, legendId, labels, datasets) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const w = 480, h = 240, padding = { top: 24, right: 16, bottom: 62, left: 44 };
    const innerW = w - padding.left - padding.right;
    const innerH = h - padding.top - padding.bottom;
    const allValues = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allValues, 1);
    const barGroupW = innerW / labels.length;
    const barW = Math.max(8, Math.min(28, barGroupW / (datasets.length + 1)));

    let svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">`;
    // Y 轴网格
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (innerH * i / 4);
      const val = maxVal * (1 - i / 4);
      svg += `<line x1="${padding.left}" y1="${y}" x2="${w - padding.right}" y2="${y}" stroke="#E8E8E5" stroke-width="1"/>`;
      svg += `<text x="${padding.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9A9A95">${val >= 10000 ? (val / 10000).toFixed(1) + 'w' : Math.round(val)}</text>`;
    }
    // 柱子
    labels.forEach((label, i) => {
      const groupX = padding.left + barGroupW * i + barGroupW / 2;
      datasets.forEach((ds, dsIdx) => {
        const val = ds.data[i] || 0;
        const barH = (val / maxVal) * innerH;
        const x = groupX - (datasets.length * barW) / 2 + dsIdx * barW;
        const y = padding.top + innerH - barH;
        svg += `<rect x="${x}" y="${y}" width="${barW - 2}" height="${barH}" fill="${ds.color}" rx="3"/>`;
      });
      // X 轴标签倾斜显示，放在 padding.bottom 区域内，留足旋转空间
      const labelX = groupX;
      const labelY = padding.top + innerH + 16;
      svg += `<text x="${labelX}" y="${labelY}" text-anchor="end" font-size="10" fill="#6A6A65" transform="rotate(-35, ${labelX}, ${labelY})">${this.esc(label)}</text>`;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
    // 图例放到右上方 inline
    this.renderLegend(legendId, datasets);
  },

  // 简易纯 SVG 折线图
  drawLineChart(containerId, legendId, labels, datasets) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const w = 480, h = 240, padding = { top: 24, right: 16, bottom: 62, left: 44 };
    const innerW = w - padding.left - padding.right;
    const innerH = h - padding.top - padding.bottom;
    const allValues = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allValues, 1);
    const minVal = Math.min(0, Math.min(...allValues));
    const range = maxVal - minVal || 1;
    const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;

    let svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">`;
    // 先画 Y 轴网格与文字
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (innerH * i / 4);
      const val = maxVal - (range * i / 4);
      svg += `<line x1="${padding.left}" y1="${y}" x2="${w - padding.right}" y2="${y}" stroke="#E8E8E5" stroke-width="1"/>`;
      svg += `<text x="${padding.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9A9A95">${val.toFixed(0)}</text>`;
    }
    // 后画折线 + 数据点（确保圆点不会覆盖 Y 轴文字）
    datasets.forEach(ds => {
      let pathD = '';
      let pts = [];
      labels.forEach((label, i) => {
        const val = ds.data[i] || 0;
        const x = padding.left + stepX * i;
        const y = padding.top + innerH - ((val - minVal) / range) * innerH;
        pts.push({ x, y });
        pathD += (i === 0 ? `M${x} ${y}` : ` L${x} ${y}`);
      });
      svg += `<path d="${pathD}" fill="none" stroke="${ds.color}" stroke-width="2" stroke-linejoin="round"/>`;
      pts.forEach(pt => {
        svg += `<circle cx="${pt.x}" cy="${pt.y}" r="3" fill="${ds.color}"/>`;
      });
    });
    // 最后画 X 轴标签
    labels.forEach((label, i) => {
      const x = padding.left + stepX * i;
      const labelY = padding.top + innerH + 16;
      svg += `<text x="${x}" y="${labelY}" text-anchor="end" font-size="10" fill="#6A6A65" transform="rotate(-35, ${x}, ${labelY})">${this.esc(label)}</text>`;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
    this.renderLegend(legendId, datasets);
  },

  // 把图例渲染到右上方 inline 容器（取代底部 legend）
  renderLegend(legendId, datasets) {
    const el = document.getElementById(legendId);
    if (!el) return;
    el.innerHTML = datasets.map(d => `<span class="legend-item"><i style="background:${d.color}"></i>${this.esc(d.label)}</span>`).join('');
  },

  // 简易纯 SVG 圆饼图
  drawPieChart(containerId, data, colors, legendId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const w = 300, h = 220, r = 70, cx = w / 2, cy = h / 2 - 10;
    const total = data.reduce((a, b) => a + (b.value || 0), 0) || 1;
    let startAngle = -Math.PI / 2;
    let svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;">`;
    const legendItems = [];
    data.forEach((item, i) => {
      const value = item.value || 0;
      const angle = (value / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(startAngle + angle);
      const y2 = cy + r * Math.sin(startAngle + angle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const color = colors[i % colors.length];
      svg += `<path d="${d}" fill="${color}" stroke="#fff" stroke-width="2"/>`;
      legendItems.push({ label: `${item.label} ${value}`, color });
      startAngle += angle;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
    if (legendId) {
      const legendEl = document.getElementById(legendId);
      if (legendEl) {
        legendEl.innerHTML = legendItems.map(l => `<span class="legend-item"><i style="background:${l.color};border-radius:50%;"></i>${this.esc(l.label)}</span>`).join('');
      }
    }
  },

  openVideoForm(videoId) {
    const video = videoId ? Store.getVideo(videoId) : null;
    const isEdit = !!video;
    const v = video || {};
    const fields = ModuleConfig.dataDimensions;

    let fieldsHtml = fields.map(f => `
      <div class="form-col">
        <label class="form-label">${f.label}（${f.unit}）</label>
        <input type="number" class="form-input" id="vf_${f.key}" value="${v[f.key] || ''}" placeholder="0" step="any">
      </div>
    `).join('');

    this.showModal(`
      <div class="modal-header">
        <h3>${isEdit ? '编辑' : '新增'}视频数据</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-col form-col-full">
            <label class="form-label">视频标题 <span class="required">*</span></label>
            <input type="text" class="form-input" id="vf_title" value="${this.esc(v.title || '')}" placeholder="如：猫咪第一次见到雪的呆萌反应">
          </div>
          <div class="form-col">
            <label class="form-label">发布日期</label>
            <input type="date" class="form-input" id="vf_publishDate" value="${v.publishDate || new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="form-col">
            <label class="form-label">平台</label>
            <select class="form-input" id="vf_platform">
              <option value="抖音" ${v.platform === '抖音' ? 'selected' : ''}>抖音</option>
              <option value="小红书" ${v.platform === '小红书' ? 'selected' : ''}>小红书</option>
              <option value="视频号" ${v.platform === '视频号' ? 'selected' : ''}>视频号</option>
              <option value="快手" ${v.platform === '快手' ? 'selected' : ''}>快手</option>
              <option value="B站" ${v.platform === 'B站' ? 'selected' : ''}>B站</option>
            </select>
          </div>
          <div class="form-col">
            <label class="form-label">视频时长（秒）</label>
            <input type="number" class="form-input" id="vf_duration" value="${v.duration || ''}" placeholder="30" min="0">
          </div>
          ${fieldsHtml}
          <div class="form-col form-col-full">
            <label class="form-label">标签（逗号分隔）</label>
            <input type="text" class="form-input" id="vf_tags" value="${this.esc((v.tags || []).join(', '))}" placeholder="萌宠, 搞笑, 治愈">
          </div>
          <div class="form-col form-col-full">
            <label class="form-label">备注</label>
            <textarea class="form-textarea" id="vf_notes" placeholder="如：选题好但完播率偏低">${this.esc(v.notes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" id="vf_saveBtn">${isEdit ? '保存' : '新增'}</button>
      </div>
    `);

    document.getElementById('vf_saveBtn')?.addEventListener('click', () => {
      const data = { id: videoId };
      const title = document.getElementById('vf_title')?.value.trim();
      if (!title) { this.showToast('请填写视频标题'); return; }
      data.title = title;
      data.publishDate = document.getElementById('vf_publishDate')?.value;
      data.platform = document.getElementById('vf_platform')?.value;
      data.duration = Number(document.getElementById('vf_duration')?.value) || 0;
      fields.forEach(f => {
        const val = document.getElementById(`vf_${f.key}`)?.value;
        data[f.key] = val === '' ? 0 : Number(val);
      });
      const tagsStr = document.getElementById('vf_tags')?.value.trim() || '';
      data.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
      data.notes = document.getElementById('vf_notes')?.value.trim() || '';

      Store.saveVideo(data);
      this.closeModal();
      this.navigate('dashboard');
      this.showToast(isEdit ? '已保存' : '已新增');
    });
  },

  viewVideo(id) {
    const v = Store.getVideo(id);
    if (!v) return;
    const fields = ModuleConfig.dataDimensions;
    const fmt = (k, val) => {
      if (val == null || isNaN(val)) return '—';
      const num = Number(val);
      const f = fields.find(x => x.key === k);
      if (!f) return num.toString();
      if (f.type === 'percent') return num.toFixed(1) + '%';
      if (f.type === 'duration') return num.toFixed(1) + '秒';
      return num.toLocaleString() + ' ' + f.unit;
    };

    const fieldsHtml = fields.map(f => `
      <div class="detail-row">
        <span class="detail-label">${f.label}</span>
        <span class="detail-value">${fmt(f.key, v[f.key])}</span>
      </div>
    `).join('');

    this.showModal(`
      <div class="modal-header">
        <h3>${this.esc(v.title || '视频详情')}</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="detail-meta">
          <span>${v.publishDate || ''}</span>
          <span>${v.platform || '抖音'}</span>
          <span>${v.duration || 0}秒</span>
          ${v.tags && v.tags.length ? `<span>${v.tags.map(t => '#' + t).join(' ')}</span>` : ''}
        </div>
        <div class="detail-section">
          ${fieldsHtml}
        </div>
        ${v.notes ? `
          <div class="detail-section">
            <div class="detail-section-title">备注</div>
            <div class="detail-notes">${this.esc(v.notes)}</div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">关闭</button>
        <button class="btn-primary" onclick="App.openVideoForm('${id}')">${Icons.edit} 编辑</button>
      </div>
    `);
  },

  handleCSVImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      try {
        const videos = this.parseCSV(text);
        if (videos.length === 0) {
          this.showToast('CSV 文件为空或解析失败');
          return;
        }
        Store.bulkSaveVideos(videos);
        this.navigate('dashboard');
        this.showToast(`成功导入 ${videos.length} 条数据`);
      } catch (err) {
        console.error(err);
        this.showToast('CSV 解析失败：' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  },

  parseCSV(text) {
    // 处理 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const parseRow = (line) => {
      const result = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && line[i + 1] === '"' && inQuote) { cur += '"'; i++; }
        else if (c === '"') { inQuote = !inQuote; }
        else if (c === ',' && !inQuote) { result.push(cur); cur = ''; }
        else { cur += c; }
      }
      result.push(cur);
      return result.map(s => s.trim());
    };

    const headers = parseRow(lines[0]);
    const fieldMap = {
      '标题': 'title', '视频标题': 'title', 'title': 'title',
      '日期': 'publishDate', '发布日期': 'publishDate',
      '平台': 'platform',
      '时长': 'duration', '时长(秒)': 'duration', 'duration': 'duration',
      '播放量': 'views', 'views': 'views',
      '点赞': 'likes', '点赞量': 'likes', 'likes': 'likes',
      '评论': 'comments', '评论量': 'comments', 'comments': 'comments',
      '分享': 'shares', '分享量': 'shares', 'shares': 'shares',
      '收藏': 'favorites', '收藏量': 'favorites', 'favorites': 'favorites',
      '完播率': 'completionRate', 'completionRate': 'completionRate',
      '2s跳出率': 'bounce2sRate', 'bounce2sRate': 'bounce2sRate',
      '平均播放时长': 'avgDuration', 'avgDuration': 'avgDuration',
      '5s完播率': 'completion5sRate', 'completion5sRate': 'completion5sRate',
      '平均播放占比': 'avgPlayRatio', 'avgPlayRatio': 'avgPlayRatio',
      '不感兴趣率': 'notInterestedRate', 'notInterestedRate': 'notInterestedRate',
      '吸粉量': 'followGained', 'followGained': 'followGained',
      '脱粉量': 'followLost', 'followLost': 'followLost',
      '吸粉率': 'followGainRate', 'followGainRate': 'followGainRate',
      '脱粉率': 'followLossRate', 'followLossRate': 'followLossRate',
    };

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseRow(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        const key = fieldMap[h];
        if (key) obj[key] = cells[idx];
      });
      if (obj.title) rows.push(obj);
    }
    return rows;
  },

  generateCompare() {
    const checked = Array.from(document.querySelectorAll('.video-compare-check:checked'));
    if (checked.length < 2) {
      this.showToast('请至少选择 2 条视频');
      return;
    }
    if (checked.length > 5) {
      this.showToast('最多选择 5 条视频');
      return;
    }

    const ids = checked.map(cb => cb.dataset.id);
    const videos = ids.map(id => Store.getVideo(id)).filter(Boolean);
    if (videos.length < 2) return;

    const dimensions = ModuleConfig.dataDimensions;
    const fmt = (k, val) => {
      if (val == null || isNaN(val)) return '—';
      const num = Number(val);
      const f = dimensions.find(x => x.key === k);
      if (!f) return num.toString();
      if (f.type === 'percent') return num.toFixed(1) + '%';
      if (f.type === 'duration') return num.toFixed(1) + '秒';
      return num.toLocaleString();
    };

    const shortLabels = videos.map(v => this.esc(v.title.slice(0, 8)) + (v.title.length > 8 ? '…' : ''));

    let html = `
      <div class="compare-header">
        <h3>${Icons.grid} 对比分析</h3>
        <p>共对比 ${videos.length} 条视频 · 15 个数据维度</p>
      </div>

      <div class="compare-charts">
        <div class="compare-chart-card">
          <div class="chart-header"><div class="chart-header-text"><div class="chart-title">播放量对比</div><div class="chart-sub">各视频播放量柱状对比</div></div><div class="chart-legend-inline" id="legend-compareChartViews"></div></div>
          <div class="chart-body" id="compareChartViews"></div>
        </div>
        <div class="compare-chart-card">
          <div class="chart-header"><div class="chart-header-text"><div class="chart-title">互动数据对比</div><div class="chart-sub">点赞 / 评论 / 收藏</div></div><div class="chart-legend-inline" id="legend-compareChartEngage"></div></div>
          <div class="chart-body" id="compareChartEngage"></div>
        </div>
        <div class="compare-chart-card">
          <div class="chart-header"><div class="chart-header-text"><div class="chart-title">完播质量对比</div><div class="chart-sub">完播率 / 5s完播 / 2s跳出</div></div><div class="chart-legend-inline" id="legend-compareChartComplete"></div></div>
          <div class="chart-body" id="compareChartComplete"></div>
        </div>
        <div class="compare-chart-card">
          <div class="chart-header"><div class="chart-header-text"><div class="chart-title">播放量占比</div><div class="chart-sub">所选视频播放量分布</div></div><div class="chart-legend-inline" id="legend-compareChartPie"></div></div>
          <div class="chart-body" id="compareChartPie"></div>
        </div>
      </div>

      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-dim">数据维度</th>
              ${videos.map(v => `<th>${this.esc(v.title.slice(0, 12))}${v.title.length > 12 ? '…' : ''}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dimensions.map(dim => `
              <tr>
                <td class="compare-dim">${dim.label}</td>
                ${videos.map(v => `<td>${fmt(dim.key, v[dim.key])}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // 找最优视频
    const bestByViews = videos.reduce((a, b) => (b.views || 0) > (a.views || 0) ? b : a);
    const bestByCompletion = videos.reduce((a, b) => (b.completionRate || 0) > (a.completionRate || 0) ? b : a);
    const bestByFollow = videos.reduce((a, b) => (b.followGained || 0) > (a.followGained || 0) ? b : a);

    html += `
      <div class="compare-highlights">
        <div class="highlight-card"><div class="highlight-label">${Icons.eye} 播放最高</div><div class="highlight-title">${this.esc(bestByViews.title)}</div><div class="highlight-value">${(bestByViews.views || 0).toLocaleString()}</div></div>
        <div class="highlight-card"><div class="highlight-label">${Icons.chartLine} 完播最高</div><div class="highlight-title">${this.esc(bestByCompletion.title)}</div><div class="highlight-value">${(bestByCompletion.completionRate || 0).toFixed(1)}%</div></div>
        <div class="highlight-card"><div class="highlight-label">${Icons.user} 涨粉最快</div><div class="highlight-title">${this.esc(bestByFollow.title)}</div><div class="highlight-value">+${bestByFollow.followGained || 0}</div></div>
      </div>
    `;

    document.getElementById('compareContent').innerHTML = html;

    // 渲染对比图表
    setTimeout(() => {
      this.drawBarChart('compareChartViews', 'legend-compareChartViews', shortLabels, [
        { label: '播放量', data: videos.map(v => v.views || 0), color: '#C2F84F' }
      ]);
      this.drawBarChart('compareChartEngage', 'legend-compareChartEngage', shortLabels, [
        { label: '点赞', data: videos.map(v => v.likes || 0), color: '#E9A8CF' },
        { label: '评论', data: videos.map(v => v.comments || 0), color: '#AFC9EA' },
        { label: '收藏', data: videos.map(v => v.favorites || 0), color: '#FFD580' }
      ]);
      this.drawLineChart('compareChartComplete', 'legend-compareChartComplete', shortLabels, [
        { label: '完播率%', data: videos.map(v => v.completionRate || 0), color: '#C2F84F' },
        { label: '5s完播%', data: videos.map(v => v.completion5sRate || 0), color: '#9DC8F0' },
        { label: '2s跳出%', data: videos.map(v => v.bounce2sRate || 0), color: '#FF9B9B' }
      ]);
      this.drawPieChart('compareChartPie', videos.map((v, i) => ({ label: shortLabels[i], value: v.views || 0 })), ['#C2F84F', '#9DC8F0', '#E9A8CF', '#FFD580', '#A6A2FF'], 'legend-compareChartPie');
    }, 0);
    // 切换到对比 tab
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.dash-tab[data-tab="compare"]')?.classList.add('active');
    document.querySelector('.dash-panel[data-panel="compare"]')?.classList.add('active');
  },

  async generateReport() {
    const settings = Store.getSettings();
    if (!settings.deepseekApiKey) {
      this.showToast('请先在设置中配置 Deepseek API Key');
      setTimeout(() => this.navigate('settings'), 1500);
      return;
    }

    const videos = Store.getVideos();
    if (videos.length === 0) {
      this.showToast('暂无视频数据，请先添加');
      return;
    }

    // 计算本周范围（最近 7 天）
    const sorted = [...videos].sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
    const recent = sorted.filter(v => {
      if (!v.publishDate) return true;
      const days = (Date.now() - new Date(v.publishDate).getTime()) / 86400000;
      return days <= 7;
    });
    const targetVideos = recent.length > 0 ? recent : sorted;

    const periodStart = targetVideos[targetVideos.length - 1]?.publishDate || '';
    const periodEnd = targetVideos[0]?.publishDate || '';
    const period = `${periodStart} ~ ${periodEnd}`;

    const aggregateKeys = ['views', 'likes', 'comments', 'shares', 'favorites',
      'completionRate', 'completion5sRate', 'bounce2sRate', 'avgDuration', 'avgPlayRatio',
      'notInterestedRate', 'followGained', 'followLost', 'followGainRate', 'followLossRate'];
    const aggregates = Store.aggregateVideos(targetVideos, aggregateKeys);

    const genDiv = document.getElementById('reportGenerating');
    const resultDiv = document.getElementById('reportResult');
    genDiv.style.display = 'block';
    resultDiv.innerHTML = '';

    const resp = await API.generateWeeklyReport({
      videos: targetVideos,
      aggregates,
      period,
    });

    genDiv.style.display = 'none';

    if (resp.error && !resp.report) {
      resultDiv.innerHTML = `<div class="alert-card"><span class="alert-icon">${Icons.alert}</span><div class="alert-content"><div class="alert-title">生成失败</div><div class="alert-desc">${this.esc(resp.message || resp.error)}</div></div></div>`;
      return;
    }

    if (resp.report) {
      const r = resp.report;
      const title = `${periodEnd} 周度数据报告`;
      const saved = Store.saveReport({
        title,
        period,
        content: JSON.stringify(r),
        videoIds: targetVideos.map(v => v.id),
        stats: aggregates,
      });
      resultDiv.innerHTML = this.renderReportHTML(r, saved);
      document.querySelectorAll('.delete-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('确定删除这份报告吗？')) {
            Store.deleteReport(btn.dataset.id);
            this.navigate('dashboard');
            this.showToast('已删除');
          }
        });
      });
      this.showToast('报告生成完成');
    } else {
      resultDiv.innerHTML = `<div class="card"><div class="detail-body">${this.esc(resp.raw || '')}</div></div>`;
    }
  },

  renderReportHTML(r, saved) {
    const o = r.overview || {};
    const problems = r.problems || [];
    const actions = r.nextWeekActions || [];
    const patterns = r.patterns || [];
    return `
      <div class="report-result">
        <div class="report-result-header">
          <div>
            <h3>${this.esc(saved.title)}</h3>
            <p>${saved.period} · ${new Date(saved.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div class="report-result-badge">${o.performanceLevel || '诊断完成'}</div>
        </div>

        ${o.highlight ? `<div class="report-highlight">${this.esc(o.highlight)}</div>` : ''}

        <div class="report-kpis">
          <div class="kpi-card"><div class="kpi-label">总播放量</div><div class="kpi-value">${this.esc(o.totalViews || '—')}</div></div>
          <div class="kpi-card"><div class="kpi-label">总点赞</div><div class="kpi-value">${this.esc(o.totalLikes || '—')}</div></div>
          <div class="kpi-card"><div class="kpi-label">总吸粉</div><div class="kpi-value">${this.esc(o.totalFollowGained || '—')}</div></div>
          <div class="kpi-card"><div class="kpi-label">平均完播</div><div class="kpi-value">${this.esc(o.avgCompletionRate || '—')}</div></div>
        </div>

        ${r.bestVideo || r.worstVideo ? `
          <div class="report-section-block">
            <h4>${Icons.star} 表现分析</h4>
            ${r.bestVideo ? `<div class="report-best"><div class="report-sublabel">表现最好</div><div class="report-best-title">${this.esc(r.bestVideo.title || '')}</div><div class="report-best-reason">${this.esc(r.bestVideo.reason || '')}</div></div>` : ''}
            ${r.worstVideo ? `<div class="report-worst"><div class="report-sublabel">需要改进</div><div class="report-best-title">${this.esc(r.worstVideo.title || '')}</div><div class="report-best-reason">${this.esc(r.worstVideo.diagnosis || '')}</div></div>` : ''}
          </div>
        ` : ''}

        ${patterns.length > 0 ? `
          <div class="report-section-block">
            <h4>${Icons.trend} 数据规律</h4>
            ${patterns.map(p => `<div class="report-item"><div class="report-item-title">${this.esc(p.pattern || '')}</div><div class="report-item-text">${this.esc(p.explanation || '')}</div></div>`).join('')}
          </div>
        ` : ''}

        ${problems.length > 0 ? `
          <div class="report-section-block">
            <h4>${Icons.alert} 问题诊断</h4>
            ${problems.map(p => `<div class="report-item"><div class="report-item-title">${this.esc(p.problem || '')} <span class="impact-tag">${this.esc(p.impact || '')}</span></div><div class="report-item-text">${this.esc(p.rootCause || '')}</div></div>`).join('')}
          </div>
        ` : ''}

        ${actions.length > 0 ? `
          <div class="report-section-block">
            <h4>${Icons.sparkles} 下周行动清单</h4>
            ${actions.map(a => `<div class="report-action-item"><div class="report-action-name">${this.esc(a.action || '')}</div><div class="report-action-detail"><div><strong>原因：</strong>${this.esc(a.reason || '')}</div><div><strong>预期：</strong>${this.esc(a.expectedOutcome || '')}</div></div></div>`).join('')}
          </div>
        ` : ''}

        ${r.keyInsight ? `
          <div class="report-insight">
            <div class="insight-label">${Icons.sparkles} 关键洞察</div>
            <div class="insight-text">${this.esc(r.keyInsight)}</div>
          </div>
        ` : ''}
      </div>
    `;
  },

  viewReport(id) {
    const report = Store.getReports().find(r => r.id === id);
    if (!report) return;
    let r;
    try { r = JSON.parse(report.content); } catch { r = null; }
    if (!r) {
      this.showToast('报告数据已损坏');
      return;
    }
    this.showModal(`
      <div class="modal-header">
        <h3>${this.esc(report.title)}</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        ${this.renderReportHTML(r, report)}
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">关闭</button>
      </div>
    `);
  },

  // ===== 设置 =====
  renderSettings() {
    const settings = Store.getSettings();

    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>设置与数据</h2>
          ${this.helpBtn('settings')}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">${Icons.user} 个人信息</div>
        <div class="settings-section-body">
          <div class="settings-row">
            <div>
              <div class="settings-row-label">昵称</div>
            </div>
            <input type="text" class="form-input" id="setUserName" value="${this.esc(settings.userName || '')}" style="max-width:200px;">
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-label">工作类型</div>
            </div>
            <input type="text" class="form-input" id="setWorkType" value="${this.esc(settings.workType || '')}" style="max-width:200px;">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">${Icons.ai} Deepseek AI 配置</div>
        <div class="settings-section-body">
          <div class="settings-row" style="flex-direction:column;align-items:stretch;">
            <div class="settings-row-label" style="margin-bottom:6px;">API Key</div>
            <div style="display:flex;gap:8px;width:100%;">
              <input type="password" class="form-input" id="setDeepseekKey" value="${this.esc(settings.deepseekApiKey || '')}" placeholder="sk-..." style="flex:1;">
              <button class="btn-secondary" id="toggleKeyVisibility" style="white-space:nowrap;">${Icons.eye}</button>
            </div>
            <div class="settings-row-desc">获取地址：https://platform.deepseek.com → API Keys</div>
          </div>
          <div class="settings-row" style="flex-direction:column;align-items:stretch;">
            <div class="settings-row-label" style="margin-bottom:6px;">API 地址</div>
            <input type="text" class="form-input" id="setDeepseekUrl" value="${this.esc(settings.deepseekApiUrl || 'https://api.deepseek.com/v1')}" style="width:100%;">
          </div>
          <div class="settings-row" style="flex-direction:column;align-items:stretch;">
            <div class="settings-row-label" style="margin-bottom:6px;">模型</div>
            <select class="form-select" id="setDeepseekModel" style="width:100%;">
              <option value="deepseek-chat" ${settings.deepseekModel === 'deepseek-chat' ? 'selected' : ''}>deepseek-chat（通用）</option>
              <option value="deepseek-reasoner" ${settings.deepseekModel === 'deepseek-reasoner' ? 'selected' : ''}>deepseek-reasoner（推理）</option>
            </select>
          </div>
          <div class="settings-row">
            <button class="btn-secondary" id="testDeepseekBtn">测试连接</button>
            <button class="btn-primary" id="saveDeepseekBtn">保存配置</button>
          </div>
          <div id="deepseekTestResult"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">${Icons.download} 数据管理</div>
        <div class="settings-section-body">
          <div class="settings-row">
            <div>
              <div class="settings-row-label">导出数据</div>
              <div class="settings-row-desc">将所有数据下载为 JSON 文件</div>
            </div>
            <button class="btn-secondary" id="exportDataBtn">${Icons.download} 导出</button>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-label">导入数据</div>
              <div class="settings-row-desc">从 JSON 备份文件恢复</div>
            </div>
            <button class="btn-secondary" id="importDataBtn">${Icons.upload} 导入</button>
            <input type="file" id="importFileInput" accept=".json" style="display:none;">
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-label" style="color:var(--danger);">清空所有数据</div>
              <div class="settings-row-desc">删除所有本地数据，不可恢复</div>
            </div>
            <button class="btn-danger" id="clearDataBtn">清空</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">${Icons.help} 使用说明</div>
        <div class="settings-section-body" style="padding:16px 18px;">
          <div style="font-size:13px;line-height:1.8;color:var(--text);">
            <p style="margin-bottom:10px;"><strong>数据保存方式：</strong>所有数据保存在浏览器 localStorage 中，不上传到任何服务器。数据只在当前浏览器中可用，清除浏览器缓存会丢失数据。</p>
            <p style="margin-bottom:10px;"><strong>AI 功能：</strong>AI 帮手、选题灵感、内容创作 AI 写作需要配置 Deepseek API Key。API Key 只保存在本地浏览器中。</p>
            <p style="margin-bottom:10px;"><strong>AI 资讯：</strong>自动从 aihot.virxact.com 获取，每小时缓存一次。</p>
            <p style="margin-bottom:10px;"><strong>平台热点：</strong>自动从 60s.viki.moe 获取，每30分钟缓存一次。</p>
            <p style="margin-bottom:10px;"><strong>爆款拆解：</strong>基于 Deepseek AI 进行视频结构化拆解分析，包括结构分段、爆款归因、六维评分、可借鉴策略。输入视频标题和文案即可使用。</p>
            <p style="margin-bottom:10px;"><strong>费用说明：</strong>工作台本身免费。所有 AI 功能均通过 Deepseek API 实现，按使用量计费。</p>
            <p><strong>备份建议：</strong>建议每周导出一次数据备份。</p>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">${Icons.clock} 更新日志</div>
        <div class="settings-section-body">
          ${ModuleConfig.updateLogs.map(log => `
            <div class="log-entry">
              <div class="log-entry-header">
                <span class="log-entry-date">${log.date}</span>
                <span class="log-entry-version">${log.version}</span>
              </div>
              <div class="log-entry-content">${this.esc(log.content)}</div>
              <div class="log-entry-impact">影响范围：${this.esc(log.impact)}${log.needAction ? ' · 需要操作' : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  bindSettingsEvents() {
    // Save user info
    document.getElementById('setUserName')?.addEventListener('change', () => this.saveUserInfo());
    document.getElementById('setWorkType')?.addEventListener('change', () => this.saveUserInfo());

    // Toggle key visibility
    document.getElementById('toggleKeyVisibility')?.addEventListener('click', () => {
      const input = document.getElementById('setDeepseekKey');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Save Deepseek config
    document.getElementById('saveDeepseekBtn')?.addEventListener('click', () => this.saveDeepseekConfig());

    // Test Deepseek connection
    document.getElementById('testDeepseekBtn')?.addEventListener('click', () => this.testDeepseekConnection());

    // Export data
    document.getElementById('exportDataBtn')?.addEventListener('click', () => this.exportData());

    // Import data
    document.getElementById('importDataBtn')?.addEventListener('click', () => {
      document.getElementById('importFileInput')?.click();
    });
    document.getElementById('importFileInput')?.addEventListener('change', (e) => this.importData(e));

    // Clear data
    document.getElementById('clearDataBtn')?.addEventListener('click', () => this.confirmClearData());
  },

  saveUserInfo() {
    const userName = document.getElementById('setUserName')?.value;
    const workType = document.getElementById('setWorkType')?.value;
    Store.saveSettings({ userName, workType });
    this.showToast('已保存');
  },

  saveDeepseekConfig() {
    const apiKey = document.getElementById('setDeepseekKey')?.value.trim();
    const apiUrl = document.getElementById('setDeepseekUrl')?.value.trim();
    const model = document.getElementById('setDeepseekModel')?.value;
    Store.saveSettings({ deepseekApiKey: apiKey, deepseekApiUrl: apiUrl, deepseekModel: model });
    this.showToast('Deepseek 配置已保存');
  },

  async testDeepseekConnection() {
    const apiKey = document.getElementById('setDeepseekKey')?.value.trim();
    const apiUrl = document.getElementById('setDeepseekUrl')?.value.trim();
    const resultDiv = document.getElementById('deepseekTestResult');

    if (!apiKey) {
      resultDiv.innerHTML = '<div class="alert-card"><span class="alert-icon">' + Icons.alert + '</span><div class="alert-content"><div class="alert-title">请输入 API Key</div></div></div>';
      return;
    }

    resultDiv.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>正在测试连接...</p></div>';

    const result = await API.testDeepseekConnection(apiKey, apiUrl);

    if (result.success) {
      resultDiv.innerHTML = `<div class="alert-card" style="background:#EEF5E8;border-color:#B8CB9A;"><span class="alert-icon" style="color:#4A6B3A;">${Icons.check}</span><div class="alert-content"><div class="alert-title" style="color:#4A6B3A;">连接成功</div><div class="alert-desc">${result.message}</div></div></div>`;
    } else {
      resultDiv.innerHTML = `<div class="alert-card"><span class="alert-icon">${Icons.alert}</span><div class="alert-content"><div class="alert-title">连接失败</div><div class="alert-desc">${this.esc(result.message)}</div></div></div>`;
    }
  },

  exportData() {
    const data = Store.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('数据已导出');
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        Store.importAll(e.target.result);
        this.showToast('数据导入成功');
        this.navigate('today');
      } catch (err) {
        this.showToast('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
  },

  confirmClearData() {
    this.showModal(`
      <div class="modal-header">
        <h3 style="color:var(--danger);">确认清空所有数据？</h3>
        <button class="search-close" onclick="App.closeModal()">${Icons.close}</button>
      </div>
      <div class="modal-body">
        <div class="alert-card" style="background:#FFF0F0;border-color:#FFC0C0;">
          <span class="alert-icon" style="color:var(--danger);">${Icons.alert}</span>
          <div class="alert-content">
            <div class="alert-title" style="color:var(--danger);">此操作不可撤销</div>
            <div class="alert-desc">所有今日事项、内容、选题、用户灵感、素材、AI聊天记录都将被永久删除。建议先导出备份。</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-danger" onclick="App.doClearData()">确认清空</button>
      </div>
    `);
  },

  doClearData() {
    Store.clearAll();
    Store.init();
    this.closeModal();
    this.navigate('today');
    this.showToast('所有数据已清空');
  },

  // ===== FAB =====
  openFAB() {
    const overlay = document.getElementById('fabOverlay');
    const list = document.getElementById('fabList');
    const items = [
      { icon: 'plus', label: '新增今日待办', desc: '快速创建今天的待办', module: 'today', action: 'addTodo' },
      { icon: 'topics', label: '选题灵感', desc: '今日灵感 / 用户灵感', module: 'topics' },
      { icon: 'content', label: '新建内容', desc: '创建新的内容项目', module: 'content' },
      { icon: 'plus', label: '记录灵感', desc: '记录用户自己的选题灵感', action: 'addInspiration' },
      { icon: 'ai', label: '问 AI', desc: '和 AI 助手对话', module: 'ai' },
    ];
    list.innerHTML = items.map(item => `
      <div class="fab-item" data-module="${item.module}" data-action="${item.action || ''}">
        <div class="fab-item-icon" style="background:var(--bg-muted);">${Icons[item.icon] || ''}</div>
        <div>
          <div class="fab-item-text">${item.label}</div>
          <div class="fab-item-desc">${item.desc}</div>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.fab-item').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        this.closeFAB();
        if (action === 'addTodo') {
          this.navigate('today');
          setTimeout(() => this.openAddTodoItem(), 100);
        } else if (action === 'addInspiration') {
          this.navigate('topics');
          setTimeout(() => this.openUserInspirationEditor(), 100);
        } else {
          this.navigate(el.dataset.module);
        }
      });
    });
    overlay.classList.add('show');
  },

  closeFAB() {
    document.getElementById('fabOverlay')?.classList.remove('show');
  },

  // ===== 搜索 =====
  openSearch() {
    document.getElementById('searchOverlay')?.classList.add('show');
    document.getElementById('searchInput')?.focus();
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchInput').value = '';
  },

  closeSearch() {
    document.getElementById('searchOverlay')?.classList.remove('show');
  },

  performSearch(query) {
    const results = Store.searchAll(query);
    const container = document.getElementById('searchResults');

    if (!query || !query.trim()) {
      container.innerHTML = '';
      return;
    }

    if (results.length === 0) {
      container.innerHTML = '<div class="search-no-results">没有找到相关内容</div>';
      return;
    }

    container.innerHTML = results.map(r => `
      <div class="search-result-item" data-module="${r.moduleKey}" data-id="${r.id}">
        <div class="search-result-module">${r.module}</div>
        <div class="search-result-title">${this.esc(r.title)}</div>
        <div class="search-result-snippet">${this.esc(r.snippet)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        this.closeSearch();
        this.navigate(el.dataset.module);
      });
    });
  },

  // ===== 帮助 =====
  showHelp(moduleKey) {
    const m = ModuleConfig.modules[moduleKey];
    if (!m || !m.help) return;

    const panel = document.getElementById('helpPanel');
    let html = `<h3>${Icons.help} ${m.help.title}</h3>`;
    m.help.sections.forEach(s => {
      html += `<div class="help-section"><div class="help-label">${s.label}</div><p>${this.esc(s.text)}</p></div>`;
    });
    panel.innerHTML = html;
    document.getElementById('helpOverlay')?.classList.add('show');
  },

  closeHelp() {
    document.getElementById('helpOverlay')?.classList.remove('show');
  },

  // ===== 模态框 =====
  showModal(html) {
    document.getElementById('modalContainer').innerHTML = `<div class="modal">${html}</div>`;
    document.getElementById('modalOverlay')?.classList.add('show');
  },

  closeModal() {
    document.getElementById('modalOverlay')?.classList.remove('show');
  },

  // ===== Toast =====
  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  },

  // ===== 工具方法 =====
  renderTimeOptions(selected = '', defaultSelected = '') {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        const value = `${hour}:${minute}`;
        const isSelected = value === (selected || defaultSelected) ? 'selected' : '';
        options.push(`<option value="${value}" ${isSelected}>${hour}:${minute}</option>`);
      }
    }
    return `<option value="">不选择</option>` + options.join('');
  },

  esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  renderMarkdown(md) {
    if (!md) return '';
    let html = this.esc(md);
    // headings
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin:14px 0 6px;font-size:14px;font-weight:700;">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:15px;font-weight:700;">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 style="margin:18px 0 10px;font-size:16px;font-weight:700;">$1</h2>');
    // bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // list items
    html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0 4px 18px;list-style:disc;">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0 4px 22px;list-style:decimal;">$1</li>');
    // line breaks (but not inside block elements)
    html = html.replace(/\n/g, '<br>');
    // clean up extra brs around headings/lists
    html = html.replace(/<br>(<(?:h[2-4]|li))/g, '$1');
    html = html.replace(/(<\/(?:h[2-4]|li)>)<br>/g, '$1');
    return html;
  },

  helpBtn(moduleKey) {
    return '';
  },

  priorityLabel(priority) {
    return { high: '高', medium: '中', low: '低' }[priority] || '';
  },

  sourceLabel(source) {
    const labels = {
      content: '内容',
      topics: '选题',
      data: '数据',
      materials: '素材',
    };
    return labels[source] || source || '';
  },

  progressRing(value, total, displayText = null) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    const displayValue = displayText !== null ? displayText : (total > 0 ? `${percent}%` : '0%');
    const circumference = 2 * Math.PI * 24;
    const dashOffset = circumference - (percent / 100) * circumference;
    return `
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle class="ring-bg" cx="30" cy="30" r="24"/>
        <circle class="ring-fg" cx="30" cy="30" r="24"
          stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
          transform="rotate(-90 30 30)"/>
      </svg>
      <span class="ring-value">${displayValue}</span>
    `;
  },
};

// Start app
document.addEventListener('DOMContentLoaded', () => App.init());
