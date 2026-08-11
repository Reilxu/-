/* ============================================================================
 * 习惯打卡模块（"小日常"式极简自律打卡）
 * 纯前端实现，复用工作台 Store（localStorage + Supabase 云端同步）与 App 辅助方法。
 * 以独立模块挂载到 App 的 habits 路由，不改动任何现有模块。
 * ========================================================================== */
(function () {
  'use strict';

  var esc = function (s) { return (window.App && App.esc) ? App.esc(s) : String(s == null ? '' : s); };

  // ---------- 习惯图标库（切分后的 PNG 图标）----------
  var ICON_ASSET_VERSION = '82';
  function habitIconSvg(size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';
  }
  function habitIconImg(key, size) {
    size = size || 28;
    if (key === 'circle') return habitIconSvg(size);
    return '<img src="assets/icons/' + key + '.png?v=' + ICON_ASSET_VERSION + '" alt="' + esc(key) + '" class="habit-icon-img" width="' + size + '" height="' + size + '">';
  }
  var HABIT_ICONS = {
    circle: habitIconImg('circle', 28),
    sunrise: habitIconImg('sunrise', 28),
    book: habitIconImg('book', 28),
    droplet: habitIconImg('droplet', 28),
    sparkles: habitIconImg('sparkles', 28),
    activity: habitIconImg('activity', 28),
    coffee: habitIconImg('coffee', 28),
    moon: habitIconImg('moon', 28),
    apple: habitIconImg('apple', 28),
    pencil: habitIconImg('pencil', 28),
    code: habitIconImg('code', 28),
    music: habitIconImg('music', 28),
    heart: habitIconImg('heart', 28),
    flame: habitIconImg('flame', 28),
    star: habitIconImg('star', 28),
    target: habitIconImg('target', 28),
    leaf: habitIconImg('leaf', 28),
    zap: habitIconImg('zap', 28),
    walk: habitIconImg('walk', 28),
    dumbbell: habitIconImg('dumbbell', 28),
    pill: habitIconImg('pill', 28),
    ointment: habitIconImg('ointment', 28)
  };

  // 马卡龙色板（10 色）
  var MACARON = [
    { name: '草莓粉', value: '#FFB5C2' },
    { name: '柠檬黄', value: '#FFF3B0' },
    { name: '薄荷绿', value: '#B5EAD7' },
    { name: '蓝莓紫', value: '#C7CEEA' },
    { name: '蜜桃橙', value: '#FFDAC1' },
    { name: '薰衣草', value: '#E2D5F5' },
    { name: '天空蓝', value: '#B5D8EB' },
    { name: '奶油白', value: '#FFF9E6' },
    { name: '抹茶绿', value: '#C2F0C2' },
    { name: '珊瑚红', value: '#FFC9C2' }
  ];

  var CATEGORIES = ['工作学习', '生活健康', '健身运动'];
  var ICON_KEYS = Object.keys(HABIT_ICONS).filter(function (k) { return k !== 'circle'; });
  var REWARD_POINT_PRESETS = [0, 1, 2, 3, 5, 10, 20, 50, 80, 100];

  // 习惯模板库
  var TEMPLATES = [
    { name: '早起', icon: 'sunrise', color: '#FFF3B0', category: '生活健康', frequency_type: 'daily', target_type: 'count', target_value: 1, time_slot_start: '07:00', time_slot_end: '07:30', motivational_quote: '一日之计在于晨', reward_points: 1 },
    { name: '阅读 30 分钟', icon: 'book', color: '#B5EAD7', category: '工作学习', frequency_type: 'daily', target_type: 'duration', target_value: 30, time_slot_start: '', time_slot_end: '', motivational_quote: '每天进步一点点', reward_points: 1 },
    { name: '喝 8 杯水', icon: 'droplet', color: '#B5D8EB', category: '生活健康', frequency_type: 'daily', target_type: 'quantity', target_value: 8, unit: '杯', time_slot_start: '', time_slot_end: '', motivational_quote: '多喝水身体好', reward_points: 1 },
    { name: '冥想 10 分钟', icon: 'sparkles', color: '#E2D5F5', category: '生活健康', frequency_type: 'daily', target_type: 'duration', target_value: 10, time_slot_start: '', time_slot_end: '', motivational_quote: '深呼吸，放空自己', reward_points: 1 },
    { name: '背 20 个单词', icon: 'pencil', color: '#C7CEEA', category: '工作学习', frequency_type: 'daily', target_type: 'quantity', target_value: 20, unit: '个', time_slot_start: '', time_slot_end: '', motivational_quote: '积少成多', reward_points: 1 },
    { name: '运动 30 分钟', icon: 'activity', color: '#FFB5C2', category: '健身运动', frequency_type: 'daily', target_type: 'duration', target_value: 30, time_slot_start: '', time_slot_end: '', motivational_quote: '动起来更有精神', reward_points: 1 },
    { name: '写日记', icon: 'pencil', color: '#FFF9E6', category: '生活健康', frequency_type: 'daily', target_type: 'count', target_value: 1, time_slot_start: '', time_slot_end: '', motivational_quote: '记录今天的小确幸', reward_points: 1 }
  ];

  // ---------- 数据访问 ----------
  function getArr(key) { return Store.get(Store.KEYS[key]); }
  function setArr(key, arr) { Store.set(Store.KEYS[key], arr || []); }
  function todayStr() { return (Store.localDateStr ? Store.localDateStr() : App.localDateStr()); }
  function fmtDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function dayOfWeek(ds) { return new Date(ds + 'T00:00:00').getDay(); } // 0=Sun..6=Sat
  function addDays(ds, n) {
    var d = new Date(ds + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }
  function startOfWeek(ds) {
    var d = new Date(ds + 'T00:00:00');
    var dow = d.getDay(); // 0=Sun
    var shift = dow === 0 ? -6 : 1 - dow; // 周一为周起点
    d.setDate(d.getDate() + shift);
    return fmtDate(d);
  }
  function startOfMonth(ds) { return ds.slice(0, 7) + '-01'; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  // ---------- 状态 ----------
  var root = null;
  var state = { sub: 'today', pomo: null, jar: { period: 'week', date: todayStr(), customStart: null, customEnd: null } };

  // ---------- 计算：连续天数 / 完成率 / 总量 ----------
  function dayCheckinCount(ds) {
    return getArr('checkins').filter(function (c) { return c.checkin_date === ds; }).length;
  }
  function computeStreak() {
    var streak = 0;
    var d = new Date();
    if (dayCheckinCount(todayStr()) === 0) d.setDate(d.getDate() - 1);
    var guard = 0;
    while (guard++ < 4000) {
      var ds = fmtDate(d);
      if (dayCheckinCount(ds) > 0) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }
  function completionRate30() {
    var done = 0;
    var d = new Date();
    for (var i = 0; i < 30; i++) {
      if (dayCheckinCount(fmtDate(d)) > 0) done++;
      d.setDate(d.getDate() - 1);
    }
    return Math.round((done / 30) * 100);
  }
  function totalCheckins() { return getArr('checkins').length; }

  // ---------- 糖球 / 糖果 ----------
  function allCandy() { return getArr('candyBalls'); }
  function totalPoints() {
    var candy = allCandy().reduce(function (s, c) { return s + (Number(c.point_value) || 0); }, 0);
    var spent = getArr('redemptions').reduce(function (s, r) { return s + (Number(r.points_spent) || 0); }, 0);
    return candy - spent;
  }
  function addCandy(opts) {
    var candy = allCandy();
    var ball = {
      id: Store.genId(),
      habit_id: opts.habit_id || null,
      checkin_id: opts.checkin_id || null,
      ball_type: opts.ball_type || 'normal',
      point_value: opts.point_value || 1,
      earned_at: new Date().toISOString(),
      jar_date: opts.jar_date || todayStr(),
      jar_level: 'day'
    };
    candy.push(ball);
    setArr('candyBalls', candy);
  }
  function habitColor(habitId) {
    var h = getArr('habits').filter(function (x) { return x.id === habitId; })[0];
    return (h && h.color) || '#FFE08A';
  }
  function habitById(id) { return getArr('habits').filter(function (h) { return h.id === id; })[0]; }

  // ---------- 今日需打卡习惯 ----------
  function habitsDueOn(ds) {
    var dow = dayOfWeek(ds);
    return getArr('habits').filter(function (h) {
      if (h.is_archived) return false;
      if (h.frequency_type === 'daily') return true;
      if (h.frequency_type === 'workday') return dow >= 1 && dow <= 5;
      if (h.frequency_type === 'custom') return (h.frequency_days || []).indexOf(dow) >= 0;
      return true;
    });
  }
  function checkinFor(habitId, ds) {
    return getArr('checkins').filter(function (c) {
      return c.habit_id === habitId && c.checkin_date === ds;
    })[0] || null;
  }
  function isHabitDone(habit, ds) {
    var c = checkinFor(habit.id, ds);
    if (!c) return false;
    if (habit.target_type === 'count') return true;
    return (Number(c.value) || 0) >= (Number(habit.target_value) || 1);
  }
  function targetLabel(habit) {
    if (habit.target_type === 'duration') return (habit.target_value || 0) + ' 分钟';
    if (habit.target_type === 'quantity') return (habit.target_value || 0) + ' ' + (habit.unit || '个');
    return '完成 1 次';
  }

  // ---------- 渲染外壳 ----------
  function render(container) {
    root = container;
    container.innerHTML = shellHTML();
    bindDelegation();
    maybeSeed();
    renderSub();
  }

  function shellHTML() {
    var tabs = [
      { key: 'today', label: '今日打卡' },
      { key: 'stats', label: '统计' },
      { key: 'jar', label: '糖罐' },
      { key: 'pomodoro', label: '番茄钟' },
      { key: 'notes', label: '碎念笔记' },
      { key: 'rewards', label: '扭蛋机' },
      { key: 'settings', label: '习惯管理' }
    ];
    var tabHtml = tabs.map(function (t) {
      return '<button class="habits-tab ' + (state.sub === t.key ? 'active' : '') + '" data-act="tab" data-tab="' + t.key + '">' + t.label + '</button>';
    }).join('');
    return '<div class="habits-module">' +
      '<div class="habits-tabs">' + tabHtml + '</div>' +
      '<div class="habits-view" id="habitsView"></div>' +
      '</div>';
  }

  function renderSub() {
    var view = root.querySelector('#habitsView');
    if (!view) return;
    if (state.sub === 'today') view.innerHTML = renderToday();
    else if (state.sub === 'stats') view.innerHTML = renderStats();
    else if (state.sub === 'jar') view.innerHTML = renderJar();
    else if (state.sub === 'pomodoro') view.innerHTML = renderPomodoro();
    else if (state.sub === 'notes') view.innerHTML = renderNotes();
    else if (state.sub === 'rewards') view.innerHTML = renderRewards();
    else if (state.sub === 'settings') view.innerHTML = renderSettings();
    if (state.sub === 'pomodoro') initPomo();
  }

  // ---------- 今日打卡 ----------
  function renderToday() {
    var ds = todayStr();
    var due = habitsDueOn(ds);
    var done = due.filter(function (h) { return isHabitDone(h, ds); });
    var allDone = due.length > 0 && done.length === due.length;

    var hour = new Date().getHours();
    var greet = hour < 12 ? '早上好' : (hour < 18 ? '下午好' : '晚上好');
    var dateLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

    var header = '<div class="habits-today-head">' +
      '<div class="habits-greet">' + greet + ' ☀️</div>' +
      '<div class="habits-date">' + esc(dateLabel) + '</div>' +
      '<div class="habits-progress-text">今日已完成 <b>' + done.length + '</b> / ' + due.length + ' 个习惯' +
      (allDone ? ' · 全勤 🎉' : '') + '</div>' +
      '</div>';

    var cards;
    if (due.length === 0) {
      cards = '<div class="habits-empty">今天没有需要打卡的习惯，去「习惯管理」里添加吧～</div>';
    } else {
      cards = '<div class="habits-cards">' + due.map(function (h) { return habitCardHTML(h, ds); }).join('') + '</div>';
    }

    return header + cards;
  }

  function habitCardHTML(h, ds) {
    var done = isHabitDone(h, ds);
    var progress = '';
    if (h.target_type !== 'count') {
      var c = checkinFor(h.id, ds);
      var cur = c ? (Number(c.value) || 0) : 0;
      progress = '<div class="habit-card-progress">已 ' + cur + ' / ' + (h.target_value || 0) + ' ' + (h.unit || (h.target_type === 'duration' ? '分钟' : '个')) + '</div>';
    }
    var time = (h.time_slot_start ? h.time_slot_start : '') + (h.time_slot_end ? '–' + h.time_slot_end : '');
    var timeHtml = time ? '<div class="habit-card-time">🕒 ' + esc(time) + '</div>' : '';
    return '<div class="habit-card ' + (done ? 'is-done' : '') + '" data-act="check" data-id="' + h.id + '" data-type="' + h.target_type + '" style="--hc:' + esc(h.color) + '">' +
      '<div class="habit-icon-wrap" style="background:' + esc(h.color) + '">' + (HABIT_ICONS[h.icon] || HABIT_ICONS.circle) + '</div>' +
      '<div class="habit-card-info">' +
        '<div class="habit-card-name">' + esc(h.name) + '</div>' +
        '<div class="habit-card-target">' + esc(targetLabel(h)) + '</div>' +
        timeHtml + progress +
      '</div>' +
      '<div class="habit-card-check">' + (done ? Icons.check : '<span class="habit-plus">+</span>') + '</div>' +
    '</div>';
  }

  function ripple(e, el) {
    var r = document.createElement('span');
    r.className = 'habit-ripple';
    var rect = el.getBoundingClientRect();
    var x = (e.clientX - rect.left);
    var y = (e.clientY - rect.top);
    r.style.left = x + 'px'; r.style.top = y + 'px';
    el.appendChild(r);
    setTimeout(function () { r.remove(); }, 520);
  }

  // ---------- 统计 ----------
  function renderStats() {
    var streak = computeStreak();
    var rate = completionRate30();
    var total = totalCheckins();
    var points = totalPoints();

    var cards =
      statCard('🔥 连续打卡', streak + ' 天', 'streak') +
      statCard('📊 近30天完成率', rate + '%', 'rate') +
      statCard('✅ 总打卡数', total + ' 次', 'total');

    var heat = renderHeatmap();
    var trend = renderTrend();

    return '<div class="habits-stats">' +
      '<div class="habits-stat-row">' + cards + '</div>' +
      '<div class="habits-card"><div class="habits-card-title">🗓️ 打卡热力图（近 12 个月）</div>' + heat + '</div>' +
      '<div class="habits-card"><div class="habits-card-title">📈 近 30 天趋势</div>' + trend + '</div>' +
      '</div>';
  }
  function statCard(label, value, cls) {
    return '<div class="habits-stat ' + cls + '"><div class="habits-stat-label">' + label + '</div><div class="habits-stat-value">' + value + '</div></div>';
  }
  function renderHeatmap() {
    var days = [];
    var d = new Date();
    d.setDate(d.getDate() - (52 * 7 + 6)); // 约 53 周前
    for (var i = 0; i < 53 * 7; i++) {
      var ds = fmtDate(d);
      var cnt = dayCheckinCount(ds);
      var lvl = cnt === 0 ? 0 : (cnt === 1 ? 1 : (cnt <= 3 ? 2 : (cnt <= 5 ? 3 : 4)));
      days.push('<div class="hm-cell hm-l' + lvl + '" title="' + ds + '：' + cnt + ' 次打卡"></div>');
      d.setDate(d.getDate() + 1);
    }
    return '<div class="habits-heatmap">' + days.join('') + '</div>' +
      '<div class="habits-heat-legend"><span>少</span>' +
      '<span class="hm-cell hm-l0"></span><span class="hm-cell hm-l1"></span><span class="hm-cell hm-l2"></span><span class="hm-cell hm-l3"></span><span class="hm-cell hm-l4"></span>' +
      '<span>多</span></div>';
  }
  function renderTrend() {
    var arr = [];
    var d = new Date();
    var max = 1;
    for (var i = 29; i >= 0; i--) {
      var dd = new Date(d); dd.setDate(dd.getDate() - i);
      var ds = fmtDate(dd);
      var cnt = dayCheckinCount(ds);
      if (cnt > max) max = cnt;
      arr.push({ ds: ds, cnt: cnt });
    }
    var bars = arr.map(function (it) {
      var h = Math.round((it.cnt / max) * 100);
      return '<div class="trend-bar-wrap" title="' + it.ds + '：' + it.cnt + ' 次">' +
        '<div class="trend-bar" style="height:' + (it.cnt === 0 ? 3 : Math.max(h, 6)) + '%"></div>' +
        '<div class="trend-bar-d"></div></div>';
    }).join('');
    return '<div class="habits-trend">' + bars + '</div>';
  }

  // ---------- 糖罐 ----------
  function periodRange() {
    var cfg = state.jar;
    var end, start, label;
    if (cfg.period === 'week') {
      start = startOfWeek(cfg.date);
      end = addDays(start, 6);
      label = start.slice(5) + ' → ' + end.slice(5);
    } else if (cfg.period === 'month') {
      var d = new Date(cfg.date + 'T00:00:00');
      start = startOfMonth(cfg.date);
      end = fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      label = cfg.date.slice(0, 7).replace('-', ' 年 ') + ' 月';
    } else if (cfg.period === 'year') {
      var y = cfg.date.slice(0, 4);
      start = y + '-01-01'; end = y + '-12-31'; label = y + ' 年';
    } else {
      start = cfg.customStart || cfg.date;
      end = cfg.customEnd || cfg.date;
      label = start.slice(5) + ' → ' + end.slice(5);
    }
    return { start: start, end: end, label: label };
  }
  function periodCandy(start, end) {
    return allCandy().filter(function (c) { return c.jar_date >= start && c.jar_date <= end; });
  }
  function periodHabitCompletion(start, end) {
    var habits = getArr('habits').filter(function (h) { return !h.is_archived; });
    var checkins = getArr('checkins');
    return habits.map(function (h) {
      var cnt = 0;
      checkins.forEach(function (c) { if (c.habit_id === h.id && c.checkin_date >= start && c.checkin_date <= end) cnt++; });
      return { habit: h, count: cnt };
    }).filter(function (x) { return x.count > 0; }).sort(function (a, b) { return b.count - a.count; });
  }

  function renderJar() {
    var range = periodRange();
    var candy = periodCandy(range.start, range.end);
    var points = candy.reduce(function (s, c) { return s + (Number(c.point_value) || 0); }, 0);
    var periodBtns = [
      { k: 'week', l: '周' }, { k: 'month', l: '月' }, { k: 'year', l: '年' }, { k: 'custom', l: '自定义' }
    ].map(function (b) {
      return '<button class="habits-period-btn ' + (state.jar.period === b.k ? 'active' : '') + '" data-act="jar-period" data-period="' + b.k + '">' + b.l + '</button>';
    }).join('');
    var nav = '<div class="jar-period-nav">' +
      '<button class="jar-nav-arrow" data-act="jar-prev">‹</button>' +
      '<div class="jar-period-label">' + esc(range.label) + '</div>' +
      '<button class="jar-nav-arrow" data-act="jar-next">›</button></div>';

    var customInputs = state.jar.period === 'custom'
      ? '<div class="jar-custom-row">' +
          '<input type="date" class="habits-input" id="jarStart" value="' + esc(range.start) + '">' +
          '<span>—</span>' +
          '<input type="date" class="habits-input" id="jarEnd" value="' + esc(range.end) + '">' +
          '<button class="habits-btn" data-act="jar-custom-apply">确定</button>' +
        '</div>'
      : '';

    var jarHTML = renderGlassJar(candy);
    var completion = periodHabitCompletion(range.start, range.end);
    var listHtml = completion.length === 0
      ? '<div class="habits-empty" style="margin-top:14px">该时段还没有完成的习惯</div>'
      : '<div class="jar-habit-list">' + completion.map(function (x) {
          return '<div class="jar-habit-row">' +
            '<div class="habit-icon-wrap" style="background:' + esc(x.habit.color) + '">' + (HABIT_ICONS[x.habit.icon] || HABIT_ICONS.circle) + '</div>' +
            '<div class="jar-habit-info">' +
              '<div class="jar-habit-name">' + esc(x.habit.name) + '</div>' +
              '<div class="jar-habit-meta">完成 ' + x.count + ' 次 · +' + (x.count * (Number(x.habit.reward_points) || 1)) + ' 糖</div>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';

    return '<div class="habits-jar">' +
      '<div class="jar-period-btns">' + periodBtns + '</div>' +
      nav + customInputs +
      '<div class="jar-card">' +
        '<div class="jar-title-row"><span>🍬 ' + (state.jar.period === 'week' ? '本周' : (state.jar.period === 'month' ? '本月' : (state.jar.period === 'year' ? '本年' : '自选'))) + '糖罐</span><span class="jar-points">+' + points + ' 糖</span></div>' +
        jarHTML +
      '</div>' +
      '<div class="habits-card"><div class="habits-card-title">习惯完成情况</div>' + listHtml + '</div>' +
      '</div>';
  }

  function renderGlassJar(candy) {
    var maxShow = 80;
    var list = candy.slice(0, maxShow);
    var balls = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var isRainbow = c.ball_type === 'rainbow';
      var isFocus = c.ball_type === 'focus';
      var h = !isRainbow && !isFocus ? habitById(c.habit_id) : null;
      var color = isRainbow ? 'linear-gradient(135deg,#FFB5C2,#B5EAD7,#C7CEEA)' : (isFocus ? '#A6C8FF' : habitColor(c.habit_id));
      var icon = (h && HABIT_ICONS[h.icon]) ? habitIconImg(h.icon, 12) : '';
      balls.push('<div class="jar-candy" style="background:' + esc(color) + ';animation-delay:' + (i * 0.015) + 's" title="' + (h ? esc(h.name) : c.ball_type) + ' · ' + (c.jar_date || '') + '">' + icon + '</div>');
    }
    var overflow = candy.length - maxShow;
    var overflowTag = overflow > 0 ? '<div class="jar-overflow">+' + overflow + '</div>' : '';
    return '<div class="jar-glass" data-act="jar-shake">' +
      '<div class="jar-shake-wrap">' +
        '<svg class="jar-svg" viewBox="0 0 260 180">' +
          '<defs>' +
            '<linearGradient id="jarGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
              '<stop offset="0%" style="stop-color:rgba(255,255,255,0.55)"/>' +
              '<stop offset="50%" style="stop-color:rgba(230,240,220,0.25)"/>' +
              '<stop offset="100%" style="stop-color:rgba(200,210,190,0.35)"/>' +
            '</linearGradient>' +
            '<clipPath id="jarClip"><path d="M30,30 Q30,10 50,10 L210,10 Q230,10 230,30 L230,140 Q230,170 190,170 L70,170 Q30,170 30,140 Z"/></clipPath>' +
          '</defs>' +
          '<rect x="0" y="0" width="260" height="180" fill="transparent"/>' +
          '<path class="jar-body" d="M30,30 Q30,10 50,10 L210,10 Q230,10 230,30 L230,140 Q230,170 190,170 L70,170 Q30,170 30,140 Z" fill="url(#jarGlassGrad)" stroke="rgba(180,190,170,0.5)" stroke-width="2"/>' +
          '<rect x="30" y="6" width="200" height="8" rx="4" fill="rgba(160,170,150,0.35)"/>' +
        '</svg>' +
        '<div class="jar-candy-pile">' + balls.join('') + '</div>' +
        overflowTag +
      '</div>' +
      '</div>';
  }

  function shiftJarDate(dir) {
    var cfg = state.jar;
    if (cfg.period === 'week') { cfg.date = addDays(cfg.date, dir * 7); }
    else if (cfg.period === 'month') {
      var d = new Date(cfg.date + 'T00:00:00');
      d.setMonth(d.getMonth() + dir);
      cfg.date = fmtDate(d);
    } else if (cfg.period === 'year') {
      var y = parseInt(cfg.date.slice(0, 4)) + dir;
      cfg.date = y + cfg.date.slice(4);
    }
    // custom 保持当前自定义区间不动，由 apply 更新
  }

  // ---------- 番茄钟 ----------
  function renderPomodoro() {
    var p = state.pomo || (state.pomo = newPomo());
    var habits = getArr('habits').filter(function (h) { return !h.is_archived; });
    var opts = '<option value="">不关联</option>' + habits.map(function (h) {
      return '<option value="' + h.id + '" ' + (p.habitId === h.id ? 'selected' : '') + '>' + esc(h.name) + '</option>';
    }).join('');
    var total = (p.mode === 'work' ? p.workMin : p.breakMin) * 60;
    var circ = 2 * Math.PI * 52;
    var offset = circ * (1 - (p.remaining / total));
    var focusToday = getArr('pomodoro').filter(function (s) { return s.checkin_date === todayStr() && s.completed; }).length;
    return '<div class="habits-pomo">' +
      '<div class="pomo-ring-wrap">' +
        '<svg class="pomo-ring" viewBox="0 0 120 120">' +
          '<circle class="pomo-ring-bg" cx="60" cy="60" r="52"/>' +
          '<circle id="pomoRing" class="pomo-ring-fg" cx="60" cy="60" r="52" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
        '</svg>' +
        '<div class="pomo-center">' +
          '<div id="pomoTime" class="pomo-time">' + fmtTime(p.remaining) + '</div>' +
          '<div id="pomoMode" class="pomo-mode">' + (p.mode === 'work' ? '专注' : '休息') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pomo-controls">' +
        '<button class="habits-btn" id="pomoStart" data-act="pomo-start">' + (p.running ? '暂停' : '开始') + '</button>' +
        '<button class="habits-btn-ghost" data-act="pomo-reset">重置</button>' +
      '</div>' +
      '<div class="pomo-config">' +
        '<div class="pomo-config-row"><label>关联习惯</label><select id="pomoHabit" class="habits-select">' + opts + '</select></div>' +
        '<div class="pomo-config-row"><label>专注时长（分钟）</label><input id="pomoWork" class="habits-input" type="number" min="1" max="120" value="' + p.workMin + '"></div>' +
        '<div class="pomo-config-row"><label>休息时长（分钟）</label><input id="pomoBreak" class="habits-input" type="number" min="1" max="60" value="' + p.breakMin + '"></div>' +
      '</div>' +
      '<div class="pomo-focus-today">今日已完成专注 <b>' + focusToday + '</b> 次</div>' +
      '</div>';
  }
  function newPomo() {
    return { mode: 'work', workMin: 25, breakMin: 5, remaining: 25 * 60, running: false, timer: null, habitId: '' };
  }
  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  function initPomo() {
    var p = state.pomo || (state.pomo = newPomo());
    var startBtn = root.querySelector('#pomoStart');
    if (startBtn) startBtn.addEventListener('click', function () { p.running ? pausePomo() : startPomo(); });
    var habitSel = root.querySelector('#pomoHabit');
    if (habitSel) habitSel.addEventListener('change', function () { p.habitId = habitSel.value; });
    var workI = root.querySelector('#pomoWork');
    if (workI) workI.addEventListener('change', function () { p.workMin = Math.max(1, parseInt(workI.value) || 25); if (!p.running && p.mode === 'work') { p.remaining = p.workMin * 60; updatePomoDisplay(); } });
    var breakI = root.querySelector('#pomoBreak');
    if (breakI) breakI.addEventListener('change', function () { p.breakMin = Math.max(1, parseInt(breakI.value) || 5); if (!p.running && p.mode === 'break') { p.remaining = p.breakMin * 60; updatePomoDisplay(); } });
  }
  function startPomo() {
    var p = state.pomo;
    if (p.running) return;
    p.running = true;
    var startBtn = root.querySelector('#pomoStart');
    if (startBtn) startBtn.textContent = '暂停';
    p.timer = setInterval(tickPomo, 1000);
  }
  function pausePomo() {
    var p = state.pomo;
    p.running = false;
    if (p.timer) clearInterval(p.timer);
    p.timer = null;
    var startBtn = root.querySelector('#pomoStart');
    if (startBtn) startBtn.textContent = '开始';
  }
  function resetPomo() {
    var p = state.pomo;
    pausePomo();
    p.mode = 'work';
    p.remaining = p.workMin * 60;
    updatePomoDisplay();
    var modeEl = root.querySelector('#pomoMode');
    if (modeEl) modeEl.textContent = '专注';
  }
  function tickPomo() {
    var p = state.pomo;
    if (!window.App || App.currentModule !== 'habits') { pausePomo(); return; }
    p.remaining--;
    if (p.remaining <= 0) { pomoComplete(); return; }
    updatePomoDisplay();
  }
  function updatePomoDisplay() {
    var p = state.pomo;
    var total = (p.mode === 'work' ? p.workMin : p.breakMin) * 60;
    var circ = 2 * Math.PI * 52;
    var offset = circ * (1 - (p.remaining / total));
    var ring = root.querySelector('#pomoRing');
    if (ring) ring.setAttribute('stroke-dashoffset', offset.toFixed(1));
    var t = root.querySelector('#pomoTime');
    if (t) t.textContent = fmtTime(p.remaining);
  }
  function pomoComplete() {
    var p = state.pomo;
    pausePomo();
    var ds = todayStr();
    // 记录会话
    var sessions = getArr('pomodoro');
    sessions.push({ id: Store.genId(), habit_id: p.habitId || null, start_time: new Date().toISOString(), duration_seconds: (p.mode === 'work' ? p.workMin : p.breakMin) * 60, mode: p.mode, completed: true, checkin_date: ds });
    setArr('pomodoro', sessions);
    // 专注糖球
    addCandy({ ball_type: 'focus', point_value: 1, jar_date: ds });
    // 关联习惯自动打卡
    if (p.mode === 'work' && p.habitId) {
      var habit = getArr('habits').filter(function (h) { return h.id === p.habitId; })[0];
      if (habit) doCheckin(habit, ds, habit.target_type === 'count' ? 1 : (habit.target_type === 'duration' ? p.workMin : 1), false);
    }
    if (window.App) App.showToast(p.mode === 'work' ? '专注完成！获得 1 颗专注糖球 🍬' : '休息结束，继续加油！');
    // 切到休息并停
    p.mode = 'break';
    p.remaining = p.breakMin * 60;
    renderSub();
  }

  // ---------- 碎念笔记 ----------
  function renderNotes() {
    var notes = getArr('habitNotes').slice().sort(function (a, b) {
      var da = a.record_date || a.created_at || '';
      var db = b.record_date || b.created_at || '';
      return db.localeCompare(da);
    });
    var list = notes.length === 0
      ? '<div class="habits-empty">还没有碎念笔记，写下此刻的想法吧～</div>'
      : '<div class="habits-notes-list">' + notes.map(function (n) {
          var tags = (n.tags || []).map(function (t) { return '<span class="note-tag">#' + esc(t) + '</span>'; }).join('');
          var recordDate = n.record_date || (n.created_at ? n.created_at.slice(0, 10) : '');
          var time = n.created_at ? new Date(n.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          return '<div class="note-item"><div class="note-content">' + esc(n.content) + '</div>' +
            (tags ? '<div class="note-tags">' + tags + '</div>' : '') +
            '<div class="note-foot"><span class="note-time">📅 ' + esc(recordDate) + (time ? ' · ' + esc(time) : '') + '</span>' +
            '<button class="note-del" data-act="note-del" data-id="' + n.id + '">删除</button></div></div>';
        }).join('') + '</div>';
    return '<div class="habits-notes">' +
      '<button class="habits-btn" data-act="note-add">✏️ 写一条碎念</button>' +
      list + '</div>';
  }

  // ---------- 扭蛋机 ----------
  function hashCode(s) {
    return s.split('').reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
  }
  function getRewardIcon(r) {
    if (!r) return '🎁';
    if (/^[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(r.icon || '') || (r.icon && r.icon.length <= 2 && !HABIT_ICONS[r.icon])) return esc(r.icon || '🎁');
    return HABIT_ICONS[r.icon] ? HABIT_ICONS[r.icon] : '🎁';
  }
  function renderGachaBalls(rewards) {
    var count = 28;
    var palette = ['#FFB5C2', '#FFF3B0', '#B5EAD7', '#C7CEEA', '#FFDAC1', '#E2D5F5', '#B5D8EB', '#FFC9C2'];
    var balls = [];
    for (var i = 0; i < count; i++) {
      var r = rewards[i % Math.max(rewards.length, 1)];
      var color = r ? palette[Math.abs(hashCode(r.id + i)) % palette.length] : '#FFE08A';
      var x = (Math.abs(hashCode('x' + i)) % 74) + 8;
      var y = (Math.abs(hashCode('y' + i)) % 58) + 12;
      var rot = Math.abs(hashCode('r' + i)) % 360;
      balls.push('<div class="gacha-ball" style="left:' + x + '%;top:' + y + '%;transform:rotate(' + rot + 'deg);--ball-color:' + color + '"></div>');
    }
    return balls.join('');
  }
  function pickGachaPrize(rewards) {
    var total = rewards.reduce(function (s, r) { return s + (Number(r.weight) || 1); }, 0);
    var pick = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < rewards.length; i++) {
      acc += (Number(rewards[i].weight) || 1);
      if (pick <= acc) return rewards[i];
    }
    return rewards[rewards.length - 1];
  }
  function showGachaResult(prize) {
    var icon = getRewardIcon(prize);
    var name = prize ? prize.name : '神秘小惊喜';
    var html = '<div class="gacha-result">' +
      '<div class="gacha-result-badge">中奖啦</div>' +
      '<div class="gacha-result-icon">' + icon + '</div>' +
      '<div class="gacha-result-title">' + esc(name) + '</div>' +
      '<div class="gacha-result-sub">恭喜获得新奖励，记得去兑现哦～</div>' +
      '<div class="form-actions"><button class="habits-btn" id="gachaOk">收下</button></div>' +
      '</div>';
    App.showModal(html);
    var ok = document.getElementById('gachaOk');
    if (ok) ok.addEventListener('click', function () { App.closeModal(); renderSub(); });
  }
  function renderRewards() {
    var rewards = getArr('rewardItems');
    var points = totalPoints();
    var cost = 50;
    var canGacha = points >= cost && rewards.length > 0;
    var totalWeight = rewards.reduce(function (s, r) { return s + (Number(r.weight) || 1); }, 0);
    var poolHtml = rewards.length === 0
      ? '<div class="gacha-pool-empty">还没有奖励，点击右上角「新增奖励」添加扭蛋奖品～</div>'
      : '<div class="gacha-pool">' + rewards.map(function (r) {
          var w = Number(r.weight) || 1;
          var pct = totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0;
          return '<div class="gacha-pool-item" data-act="reward-del" data-id="' + r.id + '" title="点击删除">' +
            '<div class="gacha-pool-icon">' + getRewardIcon(r) + '</div>' +
            '<div class="gacha-pool-name">' + esc(r.name) + '</div>' +
            '<div class="gacha-pool-weight">权重 ' + w + (pct > 0 ? ' · ' + pct + '%' : '') + '</div>' +
            '</div>';
        }).join('') + '</div>';
    var machineHtml = '<div class="gacha-machine" id="gachaMachine">' +
      '<img class="gacha-machine-img" src="assets/gacha-machine.png?v=' + ICON_ASSET_VERSION + '" alt="扭蛋机">' +
      '<div class="gacha-chute" id="gachaChute"></div>' +
      '</div>';
    return '<div class="habits-rewards">' +
      '<div class="rewards-head"><div class="rewards-points">🍬 当前糖果 <b>' + points + '</b></div>' +
      '<div class="rewards-actions"><button class="habits-btn" data-act="reward-add">+ 新增奖励</button></div></div>' +
      machineHtml +
      '<div class="gacha-action"><button class="habits-btn gacha-spin-btn ' + (canGacha ? '' : 'habits-btn-disabled') + '" data-act="gacha">🎰 抽扭蛋（' + cost + ' 糖果）</button></div>' +
      '<div class="gacha-pool-title">🎁 奖池</div>' + poolHtml +
      '</div>';
  }

  // ---------- 习惯管理 ----------
  function renderSettings() {
    var habits = getArr('habits');
    var active = habits.filter(function (h) { return !h.is_archived; });
    var archived = habits.filter(function (h) { return h.is_archived; });
    function groupHtml(list) {
      if (list.length === 0) return '';
      return list.map(function (h) {
        return '<div class="habit-row">' +
          '<div class="habit-icon-wrap" style="background:' + esc(h.color) + '">' + (HABIT_ICONS[h.icon] || HABIT_ICONS.circle) + '</div>' +
          '<div class="habit-row-info"><div class="habit-row-name">' + esc(h.name) + '</div>' +
          '<div class="habit-row-meta">' + esc(h.category) + ' · ' + esc(targetLabel(h)) + ' · ' + freqText(h) + ' · 奖励 ' + (Number(h.reward_points) || 1) + ' 糖</div></div>' +
          '<div class="habit-row-actions">' +
            '<button class="icon-sm" data-act="habit-edit" data-id="' + h.id + '" title="编辑">✎</button>' +
            (h.is_archived ? '<button class="icon-sm" data-act="habit-unarchive" data-id="' + h.id + '" title="恢复">↩</button>' : '<button class="icon-sm" data-act="habit-archive" data-id="' + h.id + '" title="归档">📥</button>') +
            '<button class="icon-sm danger" data-act="habit-del" data-id="' + h.id + '" title="删除">🗑</button>' +
          '</div></div>';
      }).join('');
    }
    var templates = TEMPLATES.map(function (t) {
      return '<button class="template-chip" data-act="tpl" data-name="' + esc(t.name) + '">' + (HABIT_ICONS[t.icon] || '') + ' ' + esc(t.name) + '</button>';
    }).join('');
    return '<div class="habits-settings">' +
      '<div class="settings-head">' +
        '<button class="habits-btn" data-act="habit-add">+ 新增习惯</button>' +
      '</div>' +
      '<div class="habits-card"><div class="habits-card-title">📚 模板库（一键导入）</div><div class="template-list">' + templates + '</div></div>' +
      '<div class="habits-card"><div class="habits-card-title">✅ 进行中的习惯（' + active.length + '）</div>' + (active.length ? '<div class="habit-list">' + groupHtml(active) + '</div>' : '<div class="habits-empty">暂无习惯</div>') + '</div>' +
      (archived.length ? '<div class="habits-card"><div class="habits-card-title">📥 已归档（' + archived.length + '）</div><div class="habit-list">' + groupHtml(archived) + '</div></div>' : '') +
      '</div>';
  }
  function freqText(h) {
    if (h.frequency_type === 'daily') return '每天';
    if (h.frequency_type === 'workday') return '工作日';
    var names = ['日', '一', '二', '三', '四', '五', '六'];
    return '每周' + (h.frequency_days || []).map(function (d) { return names[d]; }).join('、');
  }

  // ---------- 打卡逻辑 ----------
  function doCheckin(habit, ds, value, withAnim) {
    var checkins = getArr('checkins');
    var idx = checkins.findIndex(function (c) { return c.habit_id === habit.id && c.checkin_date === ds; });
    var c;
    var points = Number(habit.reward_points) || 1;
    if (idx >= 0) {
      c = checkins[idx];
      c.value = value;
    } else {
      c = { id: Store.genId(), habit_id: habit.id, checkin_date: ds, value: value, note: '', created_at: new Date().toISOString() };
      checkins.push(c);
    }
    setArr('checkins', checkins);
    // 糖球：按习惯配置的奖励数量
    addCandy({ habit_id: habit.id, checkin_id: c.id, ball_type: 'normal', point_value: points, jar_date: ds });
    // 连续天数加成：满 7/14/21/30 天额外彩虹糖球
    var streak = computeStreak();
    if (streak > 0 && streak % 7 === 0) {
      addCandy({ habit_id: habit.id, checkin_id: c.id, ball_type: 'rainbow', point_value: 2, jar_date: ds });
    }
    if (withAnim !== false) {
      renderSub();
      // 全勤彩花
      var due = habitsDueOn(ds);
      var done = due.filter(function (h) { return isHabitDone(h, ds); });
      if (due.length > 0 && done.length === due.length) confetti();
    }
  }
  function undoCheckin(habit, ds) {
    var checkins = getArr('checkins').filter(function (c) { return !(c.habit_id === habit.id && c.checkin_date === ds); });
    setArr('checkins', checkins);
    // 移除当日相关糖球
    var candy = allCandy().filter(function (cb) { return !(cb.habit_id === habit.id && cb.jar_date === ds); });
    setArr('candyBalls', candy);
    renderSub();
  }

  // ---------- 表单：习惯 ----------
  function openHabitForm(existing, tpl) {
    var h = existing || tpl || { name: '', icon: 'circle', color: MACARON[0].value, category: '生活健康', frequency_type: 'daily', frequency_days: [1, 2, 3, 4, 5, 6, 7], target_type: 'count', target_value: 1, unit: '个', time_slot_start: '', time_slot_end: '', motivational_quote: '', reward_points: 1 };
    // 兼容旧数据没有 reward_points
    if (typeof h.reward_points !== 'number' && typeof h.reward_points !== 'string') h.reward_points = 1;
    var iconGrid = ICON_KEYS.map(function (k) {
      return '<button type="button" class="icon-pick ' + (h.icon === k ? 'sel' : '') + '" data-icon="' + k + '">' + (HABIT_ICONS[k] || '') + '</button>';
    }).join('');
    var colorGrid = MACARON.map(function (c) {
      return '<button type="button" class="color-pick ' + (h.color === c.value ? 'sel' : '') + '" data-color="' + c.value + '" style="background:' + c.value + '" title="' + c.name + '"></button>';
    }).join('');
    var catOpts = CATEGORIES.map(function (c) { return '<option value="' + c + '" ' + (h.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('');
    var freqOpts = [['daily', '每天'], ['workday', '工作日'], ['custom', '自定义']].map(function (o) { return '<option value="' + o[0] + '" ' + (h.frequency_type === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('');
    var dayOpts = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var names = ['一', '二', '三', '四', '五', '六', '日'];
      var checked = (h.frequency_days || []).indexOf(d) >= 0 ? 'checked' : '';
      return '<label class="day-chk"><input type="checkbox" value="' + d + '" ' + checked + '>周' + names[d === 0 ? 6 : d - 1] + '</label>';
    }).join('');
    var typeOpts = [['count', '按次'], ['duration', '按时长'], ['quantity', '按数量']].map(function (o) { return '<option value="' + o[0] + '" ' + (h.target_type === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('');

    var rewardChips = REWARD_POINT_PRESETS.map(function (p) {
      return '<button type="button" class="reward-chip ' + ((Number(h.reward_points) || 0) === p ? 'sel' : '') + '" data-rp="' + p + '">' + p + '</button>';
    }).join('');

    var html = '<div class="habit-form">' +
      '<div class="form-group"><label>习惯名称</label><input id="hfName" class="habits-input" value="' + esc(h.name) + '" placeholder="如：早起、阅读"></div>' +
      '<div class="form-group"><label>图标</label><div class="icon-grid">' + iconGrid + '</div></div>' +
      '<div class="form-group"><label>颜色</label><div class="color-grid">' + colorGrid + '</div></div>' +
      '<div class="form-group"><label>分组</label><select id="hfCat" class="habits-select">' + catOpts + '</select></div>' +
      '<div class="form-group"><label>周期</label><select id="hfFreq" class="habits-select">' + freqOpts + '</select>' +
        '<div class="day-opts" id="hfDays">' + dayOpts + '</div></div>' +
      '<div class="form-group"><label>打卡类型</label><select id="hfType" class="habits-select">' + typeOpts + '</select>' +
        '<div class="type-opts" id="hfTypeOpts">' +
          '<input id="hfTarget" class="habits-input" type="number" min="1" value="' + (h.target_value || 1) + '">' +
          '<input id="hfUnit" class="habits-input" type="text" value="' + esc(h.unit || '个') + '" placeholder="单位（数量型用，如：杯）" style="width:90px">' +
        '</div></div>' +
      '<div class="form-group"><label>时段（可选）</label><div class="time-row">' +
        '<input id="hfStart" class="habits-input" type="time" value="' + esc(h.time_slot_start || '') + '"> — <input id="hfEnd" class="habits-input" type="time" value="' + esc(h.time_slot_end || '') + '"></div></div>' +
      '<div class="form-group"><label>激励语（可选）</label><input id="hfQuote" class="habits-input" value="' + esc(h.motivational_quote || '') + '" placeholder="如：一天的好心情从早起开始"></div>' +
      '<div class="form-group"><label>每次完成奖励糖数</label><div class="reward-chip-row">' + rewardChips + '</div>' +
        '<div class="reward-custom-row"><button class="reward-step" data-step="-1">−</button>' +
        '<input id="hfReward" class="habits-input" type="number" min="0" max="100" value="' + (Number(h.reward_points) || 0) + '">' +
        '<button class="reward-step" data-step="1">+</button><span class="reward-range">（0-100）</span></div></div>' +
      '<div class="form-actions"><button class="habits-btn" id="hfSave">保存</button><button class="habits-btn-ghost" id="hfCancel">取消</button></div>' +
      '</div>';
    App.showModal(html);
    var sel = { icon: h.icon, color: h.color, reward: Number(h.reward_points) || 0 };
    var modal = document.getElementById('modalContainer');
    modal.querySelectorAll('.icon-pick').forEach(function (b) { b.addEventListener('click', function () { sel.icon = b.dataset.icon; modal.querySelectorAll('.icon-pick').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); }); });
    modal.querySelectorAll('.color-pick').forEach(function (b) { b.addEventListener('click', function () { sel.color = b.dataset.color; modal.querySelectorAll('.color-pick').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); }); });

    var rewardInput = modal.querySelector('#hfReward');
    function setReward(v) {
      v = Math.max(0, Math.min(100, parseInt(v) || 0));
      sel.reward = v; rewardInput.value = v;
      modal.querySelectorAll('.reward-chip').forEach(function (x) { x.classList.toggle('sel', parseInt(x.dataset.rp) === v); });
    }
    modal.querySelectorAll('.reward-chip').forEach(function (b) { b.addEventListener('click', function () { setReward(b.dataset.rp); }); });
    modal.querySelectorAll('.reward-step').forEach(function (b) { b.addEventListener('click', function () { setReward((parseInt(rewardInput.value) || 0) + parseInt(b.dataset.step)); }); });
    rewardInput.addEventListener('change', function () { setReward(rewardInput.value); });

    var freqSel = modal.querySelector('#hfFreq');
    var daysBox = modal.querySelector('#hfDays');
    function toggleDays() { daysBox.style.display = freqSel.value === 'custom' ? 'flex' : 'none'; }
    freqSel.addEventListener('change', toggleDays); toggleDays();
    var typeSel = modal.querySelector('#hfType');
    var typeBox = modal.querySelector('#hfTypeOpts');
    function toggleType() { typeBox.style.display = typeSel.value === 'count' ? 'none' : 'flex'; }
    typeSel.addEventListener('change', toggleType); toggleType();
    modal.querySelector('#hfCancel').addEventListener('click', function () { App.closeModal(); });
    modal.querySelector('#hfSave').addEventListener('click', function () {
      var name = modal.querySelector('#hfName').value.trim();
      if (!name) { App.showToast('请填写习惯名称'); return; }
      var freq = freqSel.value;
      var frequency_days = freq === 'custom' ? Array.from(modal.querySelectorAll('#hfDays input:checked')).map(function (x) { return parseInt(x.value); }) : [1, 2, 3, 4, 5, 6, 7];
      if (freq === 'custom' && frequency_days.length === 0) { App.showToast('请至少选择一天'); return; }
      var rec = {
        id: existing ? existing.id : Store.genId(),
        name: name, icon: sel.icon, color: sel.color, category: modal.querySelector('#hfCat').value,
        frequency_type: freq, frequency_days: frequency_days,
        target_type: typeSel.value, target_value: parseInt(modal.querySelector('#hfTarget').value) || 1,
        unit: modal.querySelector('#hfUnit').value.trim() || '个',
        time_slot_start: modal.querySelector('#hfStart').value || '', time_slot_end: modal.querySelector('#hfEnd').value || '',
        motivational_quote: modal.querySelector('#hfQuote').value.trim(),
        reward_points: sel.reward,
        is_archived: existing ? !!existing.is_archived : false, created_at: existing ? existing.created_at : new Date().toISOString()
      };
      var arr = getArr('habits');
      if (existing) { var i = arr.findIndex(function (x) { return x.id === existing.id; }); arr[i] = rec; }
      else arr.push(rec);
      setArr('habits', arr);
      App.closeModal();
      renderSub();
      App.showToast(existing ? '已更新习惯' : '已添加习惯');
    });
  }

  // ---------- 表单：数值打卡（时长/数量）----------
  function openValueModal(habit, ds) {
    var c = checkinFor(habit.id, ds);
    var cur = c ? (Number(c.value) || 0) : 0;
    var unit = habit.target_type === 'duration' ? '分钟' : (habit.unit || '个');
    var html = '<div class="value-modal"><div class="vm-title">' + esc(habit.name) + '</div>' +
      '<div class="vm-target">目标：' + (habit.target_value || 0) + ' ' + unit + '</div>' +
      '<div class="vm-stepper"><button class="vm-minus" data-step="-1">−</button>' +
      '<input id="vmInput" class="habits-input vm-input" type="number" value="' + cur + '" min="0">' +
      '<button class="vm-plus" data-step="1">+</button></div>' +
      '<div class="vm-unit">' + unit + '</div>' +
      '<div class="form-actions"><button class="habits-btn" id="vmSave">打卡</button><button class="habits-btn-ghost" id="vmCancel">取消</button></div></div>';
    App.showModal(html);
    var modal = document.getElementById('modalContainer');
    var input = modal.querySelector('#vmInput');
    modal.querySelectorAll('.vm-minus,.vm-plus').forEach(function (b) {
      b.addEventListener('click', function () { input.value = Math.max(0, (parseInt(input.value) || 0) + parseInt(b.dataset.step) * (habit.target_value ? Math.max(1, Math.round(habit.target_value / 2)) : 1)); });
    });
    modal.querySelector('#vmCancel').addEventListener('click', function () { App.closeModal(); });
    modal.querySelector('#vmSave').addEventListener('click', function () {
      var val = Math.max(0, parseInt(input.value) || 0);
      if (val <= 0) { App.showToast('请输入大于 0 的数值'); return; }
      if (val < (habit.target_value || 1)) { if (!confirm('未达目标值，仍要打卡吗？')) return; }
      App.closeModal();
      doCheckin(habit, ds, val, true);
    });
  }

  // ---------- 笔记 ----------
  function openNoteForm() {
    var html = '<div class="note-form">' +
      '<div class="form-group"><label>记录日期</label><input type="date" id="nfDate" class="habits-input" value="' + todayStr() + '"></div>' +
      '<textarea id="nfContent" class="habits-textarea" placeholder="此刻在想什么？"></textarea>' +
      '<input id="nfTags" class="habits-input" placeholder="标签（用空格分隔，可选）">' +
      '<div class="form-actions"><button class="habits-btn" id="nfSave">保存</button><button class="habits-btn-ghost" id="nfCancel">取消</button></div></div>';
    App.showModal(html);
    var modal = document.getElementById('modalContainer');
    modal.querySelector('#nfCancel').addEventListener('click', function () { App.closeModal(); });
    modal.querySelector('#nfSave').addEventListener('click', function () {
      var content = modal.querySelector('#nfContent').value.trim();
      if (!content) { App.showToast('写点什么吧'); return; }
      var tags = modal.querySelector('#nfTags').value.trim().split(/\s+/).filter(Boolean);
      var recordDate = modal.querySelector('#nfDate').value || todayStr();
      var notes = getArr('habitNotes');
      notes.push({ id: Store.genId(), content: content, tags: tags, record_date: recordDate, created_at: new Date().toISOString() });
      setArr('habitNotes', notes);
      App.closeModal();
      renderSub();
    });
  }

  // ---------- 奖励 ----------
  function openRewardForm() {
    var html = '<div class="reward-form">' +
      '<div class="form-group"><label>奖励名称</label><input id="rfName" class="habits-input" placeholder="如：火锅一顿"></div>' +
      '<div class="form-group"><label>图标（emoji 或留空）</label><input id="rfIcon" class="habits-input" value="🎁" maxlength="4"></div>' +
      '<div class="form-group"><label>中奖概率权重（越大越容易中）</label><input id="rfWeight" class="habits-input" type="number" min="1" value="10"></div>' +
      '<div class="form-actions"><button class="habits-btn" id="rfSave">添加</button><button class="habits-btn-ghost" id="rfCancel">取消</button></div></div>';
    App.showModal(html);
    var modal = document.getElementById('modalContainer');
    modal.querySelector('#rfCancel').addEventListener('click', function () { App.closeModal(); });
    modal.querySelector('#rfSave').addEventListener('click', function () {
      var name = modal.querySelector('#rfName').value.trim();
      var weight = parseInt(modal.querySelector('#rfWeight').value) || 0;
      if (!name || weight <= 0) { App.showToast('请填写名称和有效概率权重'); return; }
      var rewards = getArr('rewardItems');
      rewards.push({ id: Store.genId(), name: name, icon: modal.querySelector('#rfIcon').value.trim() || '🎁', cost_points: 50, weight: weight, category: 'custom', created_at: new Date().toISOString() });
      setArr('rewardItems', rewards);
      App.closeModal();
      renderSub();
    });
  }
  function gacha() {
    var cost = 50;
    var points = totalPoints();
    var rewards = getArr('rewardItems');
    if (points < cost) { App.showToast('糖果不足，抽扭蛋需要 ' + cost + ' 糖果'); return; }
    if (!rewards.length) { App.showToast('请先添加奖励'); return; }
    var machine = root.querySelector('#gachaMachine');
    var chute = root.querySelector('#gachaChute');
    if (machine) machine.classList.add('gacha-spinning');
    setTimeout(function () {
      var prize = pickGachaPrize(rewards);
      var redemptions = getArr('redemptions');
      redemptions.push({ id: Store.genId(), reward_id: prize ? prize.id : null, points_spent: cost, redeemed_at: new Date().toISOString(), status: 'gacha', claimed_at: null });
      setArr('redemptions', redemptions);
      if (machine) machine.classList.remove('gacha-spinning');
      if (chute) {
        chute.innerHTML = '<div class="gacha-capsule">' + getRewardIcon(prize) + '</div>';
        chute.classList.add('gacha-capsule-drop');
      }
      setTimeout(function () {
        showGachaResult(prize);
        if (chute) { chute.innerHTML = ''; chute.classList.remove('gacha-capsule-drop'); }
      }, 900);
    }, 1600);
  }

  // ---------- 种子数据（首次进入）----------
  function maybeSeed() {
    if (localStorage.getItem('xl_habits_init')) return;
    localStorage.setItem('xl_habits_init', '1');
    if (getArr('habits').length === 0) {
      var now = new Date().toISOString();
      var seedHabits = [
        { id: Store.genId(), name: '早起', icon: 'sunrise', color: '#FFF3B0', category: '生活健康', frequency_type: 'daily', frequency_days: [1, 2, 3, 4, 5, 6, 7], target_type: 'count', target_value: 1, unit: '个', time_slot_start: '07:00', time_slot_end: '07:30', motivational_quote: '一日之计在于晨', reward_points: 1, is_archived: false, created_at: now },
        { id: Store.genId(), name: '阅读 30 分钟', icon: 'book', color: '#B5EAD7', category: '工作学习', frequency_type: 'daily', frequency_days: [1, 2, 3, 4, 5, 6, 7], target_type: 'duration', target_value: 30, unit: '分钟', time_slot_start: '', time_slot_end: '', motivational_quote: '每天进步一点点', reward_points: 1, is_archived: false, created_at: now },
        { id: Store.genId(), name: '喝 8 杯水', icon: 'droplet', color: '#B5D8EB', category: '生活健康', frequency_type: 'daily', frequency_days: [1, 2, 3, 4, 5, 6, 7], target_type: 'quantity', target_value: 8, unit: '杯', time_slot_start: '', time_slot_end: '', motivational_quote: '多喝水身体好', reward_points: 1, is_archived: false, created_at: now }
      ];
      setArr('habits', seedHabits);
    }
    if (getArr('rewardItems').length === 0) {
      var seedRewards = [
        { id: Store.genId(), name: '火锅一顿', icon: '🍲', cost_points: 50, weight: 10, category: 'food', created_at: new Date().toISOString() },
        { id: Store.genId(), name: '休息半天', icon: '😴', cost_points: 50, weight: 5, category: 'rest', created_at: new Date().toISOString() },
        { id: Store.genId(), name: '买一本喜欢的书', icon: '📚', cost_points: 50, weight: 15, category: 'self_invest', created_at: new Date().toISOString() }
      ];
      setArr('rewardItems', seedRewards);
    }
  }

  // ---------- 彩花 ----------
  function confetti() {
    var colors = ['#C2F84F', '#FFB5C2', '#B5EAD7', '#C7CEEA', '#FFD66B', '#E2D5F5'];
    for (var i = 0; i < 36; i++) {
      var c = document.createElement('div');
      c.className = 'habits-confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.4) + 's';
      c.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      document.body.appendChild(c);
      (function (el) { setTimeout(function () { el.remove(); }, 2600); })(c);
    }
  }

  // ---------- 事件委托 ----------
  function bindDelegation() {
    if (root.__habitsBound) return;
    root.__habitsBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.dataset.act;
      var id = t.dataset.id;
      if (act === 'tab') { state.sub = t.dataset.tab; renderSub(); updateTabActive(); return; }
      if (act === 'check') {
        var ds = todayStr();
        var habit = getArr('habits').filter(function (h) { return h.id === id; })[0];
        if (!habit) return;
        ripple(e, t);
        if (isHabitDone(habit, ds)) { undoCheckin(habit, ds); return; }
        if (habit.target_type === 'count') { doCheckin(habit, ds, 1, true); }
        else { openValueModal(habit, ds); }
        return;
      }
      if (act === 'habit-add') { openHabitForm(null, null); return; }
      if (act === 'habit-edit') { var eh = getArr('habits').filter(function (h) { return h.id === id; })[0]; if (eh) openHabitForm(eh, null); return; }
      if (act === 'tpl') { var tp = TEMPLATES.filter(function (x) { return x.name === t.dataset.name; })[0]; if (tp) openHabitForm(null, tp); return; }
      if (act === 'habit-archive') { var ah = getArr('habits'); var ai = ah.findIndex(function (h) { return h.id === id; }); if (ai >= 0) { ah[ai].is_archived = true; setArr('habits', ah); renderSub(); } return; }
      if (act === 'habit-unarchive') { var uh = getArr('habits'); var ui = uh.findIndex(function (h) { return h.id === id; }); if (ui >= 0) { uh[ui].is_archived = false; setArr('habits', uh); renderSub(); } return; }
      if (act === 'habit-del') { if (confirm('确定删除该习惯？相关打卡记录将保留。')) { var dh = getArr('habits').filter(function (h) { return h.id !== id; }); setArr('habits', dh); renderSub(); } return; }
      if (act === 'note-add') { openNoteForm(); return; }
      if (act === 'note-del') { var dn = getArr('habitNotes').filter(function (n) { return n.id !== id; }); setArr('habitNotes', dn); renderSub(); return; }
      if (act === 'reward-add') { openRewardForm(); return; }
      if (act === 'reward-del') { var dr = getArr('rewardItems').filter(function (r) { return r.id !== id; }); setArr('rewardItems', dr); renderSub(); return; }
      if (act === 'gacha') { gacha(); return; }
      // 糖罐
      if (act === 'jar-period') { state.jar.period = t.dataset.period; if (state.jar.period === 'custom') { state.jar.customStart = todayStr(); state.jar.customEnd = todayStr(); } renderSub(); return; }
      if (act === 'jar-prev') { shiftJarDate(-1); renderSub(); return; }
      if (act === 'jar-next') { shiftJarDate(1); renderSub(); return; }
      if (act === 'jar-custom-apply') {
        var s = root.querySelector('#jarStart'); var e = root.querySelector('#jarEnd');
        if (s && e) { state.jar.customStart = s.value; state.jar.customEnd = e.value; }
        renderSub(); return;
      }
      if (act === 'jar-shake') {
        t.classList.add('jar-shaking');
        var jcs = t.querySelectorAll('.jar-candy');
        jcs.forEach(function (candy, idx) {
          var delay = (Math.random() * 0.18).toFixed(3);
          var dir = Math.random() > 0.5 ? 'normal' : 'reverse';
          candy.style.animationDelay = delay + 's';
          candy.style.animationDirection = dir;
        });
        setTimeout(function () {
          t.classList.remove('jar-shaking');
          jcs.forEach(function (candy) {
            candy.style.animationDelay = '';
            candy.style.animationDirection = '';
          });
        }, 620);
        return;
      }
      // 番茄钟按钮（initPomo 已绑定大部分，这里兜底）
      if (act === 'pomo-start') { var p = state.pomo; p.running ? pausePomo() : startPomo(); return; }
      if (act === 'pomo-reset') { resetPomo(); return; }
    });
  }
  function updateTabActive() {
    if (!root) return;
    root.querySelectorAll('.habits-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === state.sub); });
  }

  window.HabitsModule = { render: render };
})();
