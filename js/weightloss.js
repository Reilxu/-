/* ============================================================================
 * 减肥记录模块（Neo-brutalism 风格）
 * 纯前端实现，复用工作台 Store（localStorage + Supabase 云端同步）与 API（Deepseek）。
 * 以独立模块挂载到 App 的 weightloss 路由，不改动任何现有模块逻辑。
 * ========================================================================== */
(function () {
  'use strict';

  var esc = function (s) {
    return (window.App && App.esc) ? App.esc(s) : String(s == null ? '' : s)
      .replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function fmtDate(d) {
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function todayStr() { return (Store.localDateStr ? Store.localDateStr() : fmtDate(new Date())); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function pad(n) { return String(n).padStart(2, '0'); }

  // ---------- 数据访问（对象型，使用 Store.getObject/setObject）----------
  // 注意：不能用 Store.get/set（数组型），否则空键返回 []（truthy），
  // 会让 ensureProfile 误判"已有档案"而跳过首启引导弹窗。
  // 另：对象型数据不走 SYNC_BUCKETS 数组同步循环，改为本地落盘（云端同步待接入）。
  function getProfile() { return Store.getObject(Store.KEYS.weightlossProfile); } // 空返回 {}
  function setProfile(p) { Store.setObject(Store.KEYS.weightlossProfile, p); }
  function getRecords() { return Store.getObject(Store.KEYS.weightlossRecords); } // 空返回 {}
  function setRecords(r) { Store.setObject(Store.KEYS.weightlossRecords, r); }
  function getRecord(ds) { return getRecords()[ds] || null; }
  function saveRecord(ds, patch) {
    var r = getRecords();
    r[ds] = Object.assign({}, r[ds] || {}, patch);
    setRecords(r);
    return r[ds];
  }
  function getReports() { return Store.getObject(Store.KEYS.weightlossReports); } // 空返回 {}
  function setReports(o) { Store.setObject(Store.KEYS.weightlossReports, o); }

  // ---------- 计算 ----------
  function computeBMI(jin, heightCm) {
    if (!jin || !heightCm) return null;
    var kg = jin / 2;
    var bmi = kg / Math.pow(heightCm / 100, 2);
    return Math.round(bmi * 100) / 100;
  }
  function bmiStatus(bmi) {
    if (bmi == null) return { label: '--', cls: 'wl-bmi-mute' };
    if (bmi < 18.5) return { label: '偏瘦', cls: 'wl-bmi-blue' };
    if (bmi < 24) return { label: '正常', cls: 'wl-bmi-green' };
    if (bmi < 28) return { label: '超重', cls: 'wl-bmi-warn' };
    return { label: '肥胖', cls: 'wl-bmi-danger' };
  }
  function progressPct(profile, currentJin) {
    if (!profile || !profile.initialWeight || !profile.targetWeight) return 0;
    var span = profile.initialWeight - profile.targetWeight;
    if (span <= 0) return 100;
    var done = profile.initialWeight - (currentJin || profile.initialWeight);
    var p = (done / span) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  }

  // ---------- 状态 ----------
  var root = null;
  var state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth() + 1, // 1-12
    selected: todayStr(),
    all: false,
  };

  // ================= 渲染 =================
  function render(container) {
    root = container;
    container.innerHTML =
      '<div class="wl-module">' +
        '<div class="wl-monthbar" id="wlMonthBar"></div>' +
        '<div class="wl-cal-wrap" id="wlCalWrap"></div>' +
        '<div class="wl-today-card" id="wlTodayCard"></div>' +
        '<div class="wl-quick" id="wlQuick"></div>' +
        '<div class="wl-trend" id="wlTrend"></div>' +
      '</div>';
    bindContainer();
    ensureProfile(function () { renderViews(); });
  }

  function ensureProfile(cb) {
    var p = getProfile();
    if (p && Object.keys(p).length) { cb(); return; }
    showProfileModal(function () { cb(); });
  }

  function renderViews() {
    renderMonthBar();
    renderCalWrap();
    renderTodayCard();
    renderQuick();
    renderTrend();
  }

  function renderMonthBar() {
    var bar = root.querySelector('#wlMonthBar');
    if (!bar) return;
    var label = state.all ? '全部记录' : (state.viewYear + '年' + pad(state.viewMonth) + '月');
    bar.innerHTML =
      '<button class="wl-nav-btn" data-act="prev-month" aria-label="上一月">‹</button>' +
      '<div class="wl-month-label">' + esc(label) + '</div>' +
      '<button class="wl-nav-btn" data-act="next-month" aria-label="下一月">›</button>' +
      '<button class="wl-all-btn ' + (state.all ? 'active' : '') + '" data-act="toggle-all">' + (state.all ? '返回本月' : '全部记录') + '</button>';
  }

  function renderCalWrap() {
    var wrap = root.querySelector('#wlCalWrap');
    if (!wrap) return;
    if (state.all) { wrap.innerHTML = renderAllList(); return; }
    wrap.innerHTML = renderCalendar();
  }

  function renderCalendar() {
    var recs = getRecords();
    var y = state.viewYear, m = state.viewMonth;
    var firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun
    var total = daysInMonth(y, m);
    var cells = '';
    var weekHead = ['日', '一', '二', '三', '四', '五', '六'].map(function (w) {
      return '<div class="wl-cal-week">' + w + '</div>';
    }).join('');
    for (var i = 0; i < firstDow; i++) cells += '<div class="wl-cal-cell wl-cal-empty"></div>';
    for (var d = 1; d <= total; d++) {
      var ds = y + '-' + pad(m) + '-' + pad(d);
      var rec = recs[ds];
      var cls = 'wl-cal-cell';
      if (ds === todayStr()) cls += ' wl-cal-today';
      if (ds === state.selected) cls += ' wl-cal-selected';
      var weightHtml = rec && rec.weight ? '<div class="wl-cal-weight">' + esc(rec.weight) + '</div>' : '';
      var dotHtml = (rec && hasTrivia(rec)) ? '<span class="wl-cal-dot"></span>' : '';
      cells += '<div class="' + cls + '" data-act="pick-day" data-date="' + ds + '">' +
        '<span class="wl-cal-num">' + d + '</span>' + weightHtml + dotHtml + '</div>';
    }
    return '<div class="wl-cal">' + weekHead + cells + '</div>';
  }

  function hasTrivia(rec) {
    var t = rec && rec.trivia;
    if (!t) return false;
    if (t.note && t.note.trim()) return true;
    return !!(t.injection || t.exercised || t.bowel || t.alcohol || t.stayedUp);
  }

  function renderAllList() {
    var recs = getRecords();
    var keys = Object.keys(recs).filter(function (k) { return recs[k].weight; }).sort().reverse();
    if (keys.length === 0) return '<div class="wl-empty">还没有任何体重记录，去某天打卡吧～</div>';
    var rows = keys.map(function (k) {
      var r = recs[k];
      var tri = triviaSummary(r.trivia);
      return '<div class="wl-all-row" data-act="pick-day" data-date="' + k + '">' +
        '<span class="wl-all-date">' + esc(k.slice(5)) + '</span>' +
        '<span class="wl-all-weight">' + esc(r.weight) + ' 斤</span>' +
        '<span class="wl-all-tri">' + (tri ? esc(tri) : '<span class="wl-mute">无琐事</span>') + '</span>' +
        '</div>';
    }).join('');
    return '<div class="wl-all-list">' + rows + '</div>';
  }

  function triviaSummary(t) {
    if (!t) return '';
    var arr = [];
    if (t.injection) arr.push('注射' + (t.injectionName ? '(' + t.injectionName + ')' : ''));
    if (t.exercised) arr.push('运动' + (t.exerciseType ? '(' + t.exerciseType + ')' : ''));
    if (t.bowel) arr.push('排便');
    if (t.alcohol) arr.push('饮酒');
    if (t.stayedUp) arr.push('熬夜');
    if (t.note && t.note.trim()) arr.push('备注');
    return arr.join(' · ');
  }

  function renderTodayCard() {
    var card = root.querySelector('#wlTodayCard');
    if (!card) return;
    var profile = getProfile();
    var ds = state.selected;
    var rec = getRecord(ds);
    var isToday = ds === todayStr();
    var title = isToday ? '今日体重' : (ds.slice(5).replace('-', '月') + '日体重');
    var weight = rec && rec.weight ? rec.weight : null;
    var target = profile ? profile.targetWeight : null;
    var bmi = profile ? computeBMI(weight, profile.height) : null;
    var bs = bmiStatus(bmi);
    var pct = profile ? progressPct(profile, weight) : 0;
    var remaining = (weight != null && target != null) ? Math.round((weight - target) * 10) / 10 : null;
    var monthChange = computeMonthChange(weight);
    var barColor = pct < 30 ? '#C9C9C9' : (pct < 70 ? 'var(--accent)' : 'var(--accent-green)');
    var checkedIn = !!(rec && rec.checkedIn);
    var reached = (remaining != null && remaining <= 0);
    var btnLabel = reached ? '保持记录' : (checkedIn ? '已打卡 · 修改' : '今日打卡');
    var btnCls = checkedIn ? 'wl-checkin done' : 'wl-checkin';

    card.innerHTML =
      '<div class="wl-card wl-today-inner">' +
        '<div class="wl-today-head">' +
          '<div class="wl-today-title">' + esc(title) + '</div>' +
          '<button class="' + btnCls + '" data-act="open-weight">' + esc(btnLabel) + '</button>' +
        '</div>' +
        '<div class="wl-today-weight">' + (weight != null ? esc(weight) : '--') + '<span class="wl-unit">斤</span></div>' +
        '<div class="wl-today-metrics">' +
          metric('本月变化', monthChange) +
          metric('本月目标', target != null ? (target + ' 斤') : '--') +
          metric('BMI', bmi != null ? (bmi + ' · <span class="' + bs.cls + '">' + bs.label + '</span>') : '--') +
          metric('目标进度', pct + '%') +
          metric('还差', reached ? '<span class="wl-reached">已达到目标 🎉</span>' : (remaining != null ? (remaining + ' 斤') : '--')) +
        '</div>' +
        '<div class="wl-progress"><div class="wl-progress-bar" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
      '</div>';
  }

  function metric(label, val) {
    return '<div class="wl-metric"><div class="wl-metric-label">' + label + '</div><div class="wl-metric-val">' + val + '</div></div>';
  }

  function computeMonthChange(currentWeight) {
    var recs = getRecords();
    var prefix = state.all ? '' : (state.viewYear + '-' + pad(state.viewMonth) + '-');
    var keys = Object.keys(recs).filter(function (k) {
      return (state.all || k.indexOf(prefix) === 0) && recs[k].weight;
    }).sort();
    if (keys.length === 0 || currentWeight == null) return '-- 斤';
    var first = recs[keys[0]].weight;
    var diff = Math.round((currentWeight - first) * 10) / 10;
    if (diff === 0) return '0.0 斤';
    return (diff > 0 ? '+' : '') + diff + ' 斤';
  }

  function renderQuick() {
    var q = root.querySelector('#wlQuick');
    if (!q) return;
    q.innerHTML =
      '<div class="wl-quick-grid">' +
        '<button class="wl-quick-btn wl-q-diet" data-act="open-diet"><span class="wl-q-ico">🍎</span><span>今日食谱</span></button>' +
        '<button class="wl-quick-btn wl-q-report" data-act="open-report"><span class="wl-q-ico">📊</span><span>数据分析</span></button>' +
        '<button class="wl-quick-btn wl-q-trivia" data-act="open-trivia"><span class="wl-q-ico">📝</span><span>记录琐事</span></button>' +
      '</div>';
  }

  function renderTrend() {
    var t = root.querySelector('#wlTrend');
    if (!t) return;
    var recs = getRecords();
    var list = [];
    Object.keys(recs).forEach(function (k) {
      if (recs[k].weight && (state.all || k.indexOf(state.viewYear + '-' + pad(state.viewMonth) + '-') === 0)) {
        list.push({ ds: k, w: recs[k].weight });
      }
    });
    list.sort(function (a, b) { return a.ds < b.ds ? -1 : 1; });
    var profile = getProfile();
    var html = '<div class="wl-card wl-trend-inner"><div class="wl-trend-title">本月趋势</div>';
    if (list.length < 2) {
      html += '<div class="wl-empty wl-trend-empty">记录两次体重后，将生成趋势图</div>';
    } else {
      html += trendSVG(list, profile);
    }
    html += '</div>';
    t.innerHTML = html;
  }

  function trendSVG(list, profile) {
    var W = 640, H = 200, padL = 36, padR = 16, padT = 16, padB = 28;
    var weights = list.map(function (i) { return i.w; });
    var min = Math.min.apply(null, weights), max = Math.max.apply(null, weights);
    var span = (max - min) || 1;
    min = Math.floor(min - span * 0.15);
    max = Math.ceil(max + span * 0.15);
    var range = (max - min) || 1;
    function x(i) { return padL + (W - padL - padR) * (i / (list.length - 1)); }
    function y(w) { return padT + (H - padT - padB) * (1 - (w - min) / range); }
    var pts = list.map(function (i, idx) { return x(idx) + ',' + y(i.w); }).join(' ');
    var dots = list.map(function (i, idx) {
      return '<circle cx="' + x(idx) + '" cy="' + y(i.w) + '" r="4" fill="var(--accent)" stroke="#000" stroke-width="2"><title>' + i.ds + '：' + i.w + ' 斤</title></circle>';
    }).join('');
    // 目标线
    var targetLine = '';
    if (profile && profile.targetWeight >= min && profile.targetWeight <= max) {
      var ty = y(profile.targetWeight);
      targetLine = '<line x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '" stroke="var(--accent-green)" stroke-width="2" stroke-dasharray="6 5"/>' +
        '<text x="' + (W - padR) + '" y="' + (ty - 5) + '" text-anchor="end" font-size="11" fill="#5b6b48">目标 ' + profile.targetWeight + '</text>';
    }
    // Y 轴刻度
    var yTicks = '';
    for (var g = 0; g <= 2; g++) {
      var val = min + range * (g / 2);
      var gy = y(val);
      yTicks += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="rgba(0,0,0,.12)" stroke-width="1"/>' +
        '<text x="' + (padL - 4) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="rgba(0,0,0,.6)">' + Math.round(val) + '</text>';
    }
    return '<svg class="wl-trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      yTicks + targetLine +
      '<polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + '</svg>';
  }

  // ================= 弹窗 =================
  function openModal(title, bodyNode) {
    closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'wl-modal-overlay';
    overlay.innerHTML =
      '<div class="wl-modal">' +
        '<div class="wl-modal-head"><div class="wl-modal-title">' + title + '</div><button class="wl-modal-close" data-act="close-modal">×</button></div>' +
        '<div class="wl-modal-body"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.wl-modal-body').appendChild(bodyNode);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.querySelector('[data-act="close-modal"]').addEventListener('click', closeModal);
    return overlay;
  }
  function closeModal() { var o = document.querySelector('.wl-modal-overlay'); if (o) o.remove(); }

  function showProfileModal(onDone) {
    var p = getProfile() || {};
    var body = el(
      '<div class="wl-form">' +
        '<div class="wl-field"><label>性别</label><select id="wlP_gender" class="wl-input">' +
          '<option value="female">女</option><option value="male">男</option></select></div>' +
        '<div class="wl-field"><label>身高 (cm)</label><input id="wlP_height" type="number" class="wl-input" placeholder="如 162"></div>' +
        '<div class="wl-field"><label>出生年份</label><input id="wlP_birth" type="number" class="wl-input" placeholder="如 1995"></div>' +
        '<div class="wl-field"><label>初始体重 (斤)</label><input id="wlP_init" type="number" class="wl-input" placeholder="如 140"></div>' +
        '<div class="wl-field"><label>目标体重 (斤)</label><input id="wlP_target" type="number" class="wl-input" placeholder="如 120"></div>' +
        '<div class="wl-field"><label>饮食口味</label><select id="wlP_taste" class="wl-input">' +
          '<option>清淡</option><option>偏辣</option><option>偏甜</option><option>家常</option></select></div>' +
        '<div class="wl-field"><label>运动习惯</label><select id="wlP_act" class="wl-input">' +
          '<option>久坐</option><option>偶尔运动</option><option>经常运动</option></select></div>' +
        '<button class="wl-btn-primary" id="wlP_save">保存并开始</button>' +
      '</div>');
    if (p.gender) body.querySelector('#wlP_gender').value = p.gender;
    if (p.height) body.querySelector('#wlP_height').value = p.height;
    if (p.birthYear) body.querySelector('#wlP_birth').value = p.birthYear;
    if (p.initialWeight) body.querySelector('#wlP_init').value = p.initialWeight;
    if (p.targetWeight) body.querySelector('#wlP_target').value = p.targetWeight;
    if (p.taste) body.querySelector('#wlP_taste').value = p.taste;
    if (p.activityLevel) body.querySelector('#wlP_act').value = p.activityLevel;
    openModal('设置基础信息', body);
    body.querySelector('#wlP_save').addEventListener('click', function () {
      var np = {
        gender: body.querySelector('#wlP_gender').value,
        height: parseFloat(body.querySelector('#wlP_height').value) || 0,
        birthYear: parseInt(body.querySelector('#wlP_birth').value, 10) || 0,
        initialWeight: parseFloat(body.querySelector('#wlP_init').value) || 0,
        targetWeight: parseFloat(body.querySelector('#wlP_target').value) || 0,
        taste: body.querySelector('#wlP_taste').value,
        activityLevel: body.querySelector('#wlP_act').value,
        createdAt: new Date().toISOString(),
      };
      if (!np.height || !np.initialWeight || !np.targetWeight) {
        alert('请至少填写身高、初始体重和目标体重');
        return;
      }
      setProfile(np);
      // 若当天未记录，用初始体重作为今日打卡
      var t = todayStr();
      if (!getRecord(t)) saveRecord(t, { weight: np.initialWeight, checkedIn: true });
      closeModal();
      if (onDone) onDone();
    });
  }

  function showWeightModal() {
    var ds = state.selected;
    var rec = getRecord(ds) || {};
    var body = el(
      '<div class="wl-form">' +
        '<div class="wl-form-tip">记录 <b>' + esc(ds) + '</b> 的体重（单位：斤）</div>' +
        '<div class="wl-field"><input id="wlW_val" type="number" step="0.1" class="wl-input" placeholder="如 136.5" value="' + (rec.weight != null ? esc(rec.weight) : '') + '"></div>' +
        '<button class="wl-btn-primary" id="wlW_save">保存</button>' +
      '</div>');
    openModal('记录体重', body);
    body.querySelector('#wlW_save').addEventListener('click', function () {
      var v = parseFloat(body.querySelector('#wlW_val').value);
      if (isNaN(v) || v <= 0) { alert('请输入有效的体重'); return; }
      saveRecord(ds, { weight: Math.round(v * 10) / 10, checkedIn: true });
      closeModal();
      renderViews();
    });
  }

  function showTriviaModal() {
    var ds = state.selected;
    var rec = getRecord(ds) || {};
    var t = rec.trivia || {};
    function chk(id, label, checked, extra) {
      return '<label class="wl-check"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '> ' + label + '</label>' + (extra || '');
    }
    var body = el(
      '<div class="wl-form">' +
        '<div class="wl-form-tip">记录 <b>' + esc(ds) + '</b> 的减重琐事</div>' +
        '<div class="wl-check-row">' +
          chk('wlT_inj', '注射减重针', t.injection,
            '<span class="wl-inline">药名<input id="wlT_injName" class="wl-input wl-input-sm" value="' + esc(t.injectionName || '') + '" placeholder="药名"><input id="wlT_dose" class="wl-input wl-input-sm" value="' + esc(t.dose || '') + '" placeholder="剂量"></span>') +
          chk('wlT_exc', '运动', t.exercised,
            '<span class="wl-inline">类型<input id="wlT_excType" class="wl-input wl-input-sm" value="' + esc(t.exerciseType || '') + '" placeholder="如慢跑"><input id="wlT_excDur" type="number" class="wl-input wl-input-sm" value="' + (t.exerciseDuration != null ? esc(t.exerciseDuration) : '') + '" placeholder="分钟"></span>') +
          chk('wlT_bowel', '排便', t.bowel) +
          chk('wlT_alc', '饮酒', t.alcohol) +
          chk('wlT_up', '熬夜', t.stayedUp) +
        '</div>' +
        '<div class="wl-field"><label>备注（选填）</label><textarea id="wlT_note" class="wl-input" maxlength="200" placeholder="最多 200 字">' + esc(t.note || '') + '</textarea></div>' +
        '<button class="wl-btn-primary" id="wlT_save">保存琐事</button>' +
      '</div>');
    openModal('记录琐事', body);
    body.querySelector('#wlT_save').addEventListener('click', function () {
      var nt = {
        injection: body.querySelector('#wlT_inj').checked,
        injectionName: body.querySelector('#wlT_injName').value.trim(),
        dose: body.querySelector('#wlT_dose').value.trim(),
        exercised: body.querySelector('#wlT_exc').checked,
        exerciseType: body.querySelector('#wlT_excType').value.trim(),
        exerciseDuration: parseInt(body.querySelector('#wlT_excDur').value, 10) || null,
        bowel: body.querySelector('#wlT_bowel').checked,
        alcohol: body.querySelector('#wlT_alc').checked,
        stayedUp: body.querySelector('#wlT_up').checked,
        note: body.querySelector('#wlT_note').value.trim(),
      };
      saveRecord(ds, { trivia: nt });
      closeModal();
      renderViews();
    });
  }

  // ================= AI =================
  function noKeyHint() {
    return '<div class="wl-empty">需要先配置 Deepseek API Key（设置与数据 → AI API 配置）才能使用 AI 功能。</div>';
  }

  function showDietModal() {
    var ds = state.selected;
    var rec = getRecord(ds) || {};
    var body = el('<div class="wl-diet"><div class="wl-diet-loading">正在生成今日饮食建议…</div></div>');
    openModal('今日食谱 · ' + ds, body);
    // 已缓存且同日：直接展示
    if (rec.dietAdvice && rec.dietAdvice.generatedAt && rec.dietAdvice.generatedAt.slice(0, 10) === ds) {
      renderDiet(body, rec.dietAdvice);
      return;
    }
    generateDiet(ds).then(function (advice) {
      saveRecord(ds, { dietAdvice: advice });
      renderDiet(body, advice);
    }).catch(function (err) {
      body.innerHTML = '<div class="wl-empty">生成失败：' + esc(err.message || '请检查 API 配置') + '</div>' +
        '<button class="wl-btn-primary" id="wlDietRetry">重试</button>';
      var rb = body.querySelector('#wlDietRetry');
      if (rb) rb.addEventListener('click', function () { closeModal(); showDietModal(); });
    });
  }

  function renderDiet(body, advice) {
    if (!advice || !advice.meals) {
      body.innerHTML = '<div class="wl-empty">未能解析饮食建议，请重试。</div>';
      return;
    }
    var meals = advice.meals.map(function (m) {
      return '<div class="wl-meal">' +
        '<div class="wl-meal-head"><span class="wl-meal-type">' + esc(m.type) + '</span><span class="wl-meal-cal">' + esc(m.calories) + ' kcal</span></div>' +
        '<div class="wl-meal-name">' + esc(m.name) + '</div>' +
        '<div class="wl-meal-items">' + esc(m.items) + '</div></div>';
    }).join('');
    body.innerHTML =
      '<div class="wl-diet-total">全天总热量：<b>' + esc(advice.totalCalories) + '</b> kcal</div>' +
      meals +
      '<button class="wl-btn-primary" id="wlDietRegen">重新生成</button>';
    body.querySelector('#wlDietRegen').addEventListener('click', function () { closeModal(); showDietModal(); });
  }

  function generateDiet(ds) {
    var profile = getProfile();
    if (!profile || !profile.targetWeight || !profile.height) return Promise.reject(new Error('请先设置基础信息'));
    var recs = getRecords();
    var weight = (recs[ds] && recs[ds].weight) || latestWeight();
    if (weight == null) return Promise.reject(new Error('请先记录当天体重'));
    var age = profile.birthYear ? (new Date().getFullYear() - profile.birthYear) : '未知';
    var userMsg = '用户信息：\n- 性别：' + profile.gender + '\n- 身高：' + profile.height + ' cm\n- 年龄：' + age + ' 岁\n- 当前体重：' + weight + ' 斤\n- 目标体重：' + profile.targetWeight + ' 斤\n- 运动习惯：' + profile.activityLevel + '\n- 饮食口味：' + profile.taste + '\n\n请输出 JSON 格式：\n{\n  "totalCalories": 数字,\n  "meals": [\n    { "type": "早餐", "name": "菜品名称", "items": "食材与分量", "calories": 数字 },\n    { "type": "午餐", "name": "菜品名称", "items": "食材与分量", "calories": 数字 },\n    { "type": "晚餐", "name": "菜品名称", "items": "食材与分量", "calories": 数字 },\n    { "type": "加餐", "name": "菜品名称", "items": "食材与分量", "calories": 数字 }\n  ]\n}';
    var msgs = [
      { role: 'system', content: '你是一位专业的减重营养师。请根据用户信息生成一份今日饮食建议，要求食材常见、做法简单、热量明确。只输出 JSON，不要任何额外文字或解释。' },
      { role: 'user', content: userMsg }
    ];
    return API.aiChat(msgs).then(function (res) {
      if (res.error) throw new Error(res.message || 'API 错误');
      var json = extractJSON(res.content);
      if (!json) throw new Error('返回格式无法解析');
      json.generatedAt = new Date().toISOString();
      return json;
    });
  }

  function showReportModal() {
    var scopeKey = state.all ? 'all' : ('m-' + state.viewYear + '-' + pad(state.viewMonth));
    var reports = getReports();
    var body = el('<div class="wl-report"><div class="wl-diet-loading">正在生成体重解读报告…</div></div>');
    openModal(state.all ? '数据分析 · 全部记录' : '数据分析 · ' + state.viewYear + '年' + pad(state.viewMonth) + '月', body);
    if (reports[scopeKey] && reports[scopeKey].content) {
      renderReport(body, reports[scopeKey].content);
      return;
    }
    generateReport(scopeKey).then(function (content) {
      var reports2 = getReports();
      reports2[scopeKey] = { generatedAt: new Date().toISOString(), content: content };
      setReports(reports2);
      renderReport(body, content);
    }).catch(function (err) {
      body.innerHTML = '<div class="wl-empty">生成失败：' + esc(err.message || '请检查 API 配置') + '</div>' +
        '<button class="wl-btn-primary" id="wlRepRetry">重试</button>';
      var rb = body.querySelector('#wlRepRetry');
      if (rb) rb.addEventListener('click', function () { closeModal(); showReportModal(); });
    });
  }

  function renderReport(body, content) {
    body.innerHTML = '<div class="wl-report-text">' + esc(content).replace(/\n/g, '<br>') + '</div>' +
      '<button class="wl-btn-primary" id="wlRepRegen">重新生成</button>';
    body.querySelector('#wlRepRegen').addEventListener('click', function () { closeModal(); showReportModal(); });
  }

  function generateReport(scopeKey) {
    var profile = getProfile();
    var recs = getRecords();
    var list = [];
    Object.keys(recs).forEach(function (k) {
      if (recs[k].weight && (state.all || k.indexOf(state.viewYear + '-' + pad(state.viewMonth) + '-') === 0)) {
        list.push({ ds: k, w: recs[k].weight, t: recs[k].trivia });
      }
    });
    list.sort(function (a, b) { return a.ds < b.ds ? -1 : 1; });
    if (list.length < 2) return Promise.reject(new Error('至少需要 2 条体重记录才能生成报告'));
    var weightList = list.map(function (i) { return i.ds + '：' + i.w + ' 斤'; }).join('\n');
    var triviaList = list.map(function (i) {
      var s = triviaSummary(i.t);
      return i.ds + '：' + (s || '无');
    }).join('\n');
    var target = profile ? profile.targetWeight : '未知';
    var userMsg = '目标体重：' + target + ' 斤\n\n体重记录（日期、体重）：\n' + weightList + '\n\n琐事记录（日期、事件）：\n' + triviaList + '\n\n请输出一份 300 字以内的报告，包含：\n1. 阶段体重变化总结；\n2. 关键事件与体重变化的关联分析；\n3. 未来一周建议。';
    var msgs = [
      { role: 'system', content: '你是一位体重管理分析师。请根据用户近期的体重记录与琐事记录，生成一份趋势解读报告，语言简洁、结论明确，用中文。' },
      { role: 'user', content: userMsg }
    ];
    return API.aiChat(msgs).then(function (res) {
      if (res.error) throw new Error(res.message || 'API 错误');
      return (res.content || '').trim();
    });
  }

  function latestWeight() {
    var recs = getRecords();
    var keys = Object.keys(recs).filter(function (k) { return recs[k].weight; }).sort();
    return keys.length ? recs[keys[keys.length - 1]].weight : null;
  }

  function extractJSON(str) {
    if (!str) return null;
    str = str.trim();
    // 去除 ```json ``` 包裹
    var m = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) str = m[1].trim();
    try { return JSON.parse(str); } catch (e) { }
    var s = str.indexOf('{'), e = str.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try { return JSON.parse(str.slice(s, e + 1)); } catch (e2) { }
    }
    return null;
  }

  // ================= 事件绑定 =================
  function bindContainer() {
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.dataset.act;
      if (act === 'prev-month') { shiftMonth(-1); }
      else if (act === 'next-month') { shiftMonth(1); }
      else if (act === 'toggle-all') { state.all = !state.all; renderViews(); }
      else if (act === 'pick-day') { state.selected = t.dataset.date; renderViews(); }
      else if (act === 'open-weight') { showWeightModal(); }
      else if (act === 'open-trivia') { showTriviaModal(); }
      else if (act === 'open-diet') { showDietModal(); }
      else if (act === 'open-report') { showReportModal(); }
    });
  }

  function shiftMonth(delta) {
    var y = state.viewYear, m = state.viewMonth + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    state.viewYear = y; state.viewMonth = m;
    renderViews();
  }

  window.WeightLossModule = { render: render };
})();
