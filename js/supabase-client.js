// ============================================================================
// Supabase 客户端封装（仅使用 anon / publishable key）
// 所有写操作依赖 RLS（auth.uid() = user_id），浏览器无法越权读写他人数据。
// supabase-js 通过 CDN 引入（见 index.html 新增的 script 标签）。
// ============================================================================
(function () {
  'use strict';

  var cfg = window.SUPABASE_CONFIG;
  var placeholder = !cfg || !cfg.url || !cfg.anonKey || cfg.url.indexOf('YOUR_') === 0;

  if (placeholder || !window.supabase || !window.supabase.createClient) {
    // 未配置或库未加载：标记不可用，前端回退 localStorage，不破坏现有功能
    window.SupabaseReady = false;
    return;
  }

  var client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // OAuth 回调后地址栏会带 ?code=xxx，必须让 SDK 自动交换为 session 并清理 URL
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });

  window.SB = client;
  window.SupabaseReady = true;

  // --------------------------------------------------------------------------
  // OAuth 回调参数清理（修复"刷新页面就掉登录"）
  // 原因：登录成功后地址栏残留 ?code=xxx，用户刷新时 SDK 会拿这个**已被消费**的
  //       一次性 code 再次去换 session，交换失败后 SDK 会清掉本地既有登录态，
  //       表现就是每刷新一次都要重新登录。这里在 session 恢复后立即抹掉这些参数。
  // --------------------------------------------------------------------------
  (function stripOAuthParams() {
    var search = window.location.search || '';
    var hash = window.location.hash || '';
    var dirty = /[?&](code|state|error|error_code|error_description)=/.test(search) ||
                /[#&](access_token|refresh_token|error)=/.test(hash);
    if (!dirty) return;

    var strip = function () {
      try {
        var url = new URL(window.location.href);
        ['code', 'state', 'error', 'error_code', 'error_description'].forEach(function (k) {
          url.searchParams.delete(k);
        });
        var qs = url.searchParams.toString();
        var clean = url.origin + url.pathname + (qs ? '?' + qs : '');
        window.history.replaceState({}, document.title, clean);
      } catch (e) { /* 清理失败不影响主流程 */ }
    };

    client.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        strip();
      }
    });
    // 兜底：即便交换失败也要把 code 清掉，否则每次刷新都会重复失败
    setTimeout(strip, 2500);
  })();

  // ---- 通用 CRUD 封装（全部受 RLS 约束）----
  window.SBData = {
    // 取某 bucket 的全部条目
    async list(bucket) {
      var { data, error } = await client
        .from('user_items')
        .select('item_id, data, updated_at')
        .eq('bucket', bucket)
        .order('updated_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(function (r) { return r.data; });
    },

    // 全量 upsert（迁移 / 覆盖某 bucket）
    async upsertAll(bucket, items) {
      var user = await this._uid();
      if (!user) throw new Error('未登录');
      var rows = (items || []).map(function (it) {
        return {
          user_id: user,
          bucket: bucket,
          item_id: (it && (it.id || it.item_id)) ? String(it.id || it.item_id) : null,
          data: it,
          updated_at: new Date().toISOString()
        };
      });
      // 先删后插，保证覆盖一致
      var { error: dErr } = await client.from('user_items').delete().eq('bucket', bucket);
      if (dErr) throw dErr;
      if (rows.length) {
        var { error } = await client.from('user_items').insert(rows);
        if (error) throw error;
      }
      return rows.length;
    },

    // 单条新增 / 更新（按 item_id 主键）
    async save(bucket, item) {
      var user = await this._uid();
      if (!user) throw new Error('未登录');
      var id = item && (item.id || item.item_id) ? String(item.id || item.item_id) : null;
      if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
        if (item) item.id = id;
      }
      var { error } = await client
        .from('user_items')
        .upsert({ user_id: user, bucket: bucket, item_id: id, data: item, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,bucket,item_id' });
      if (error) throw error;
      return item;
    },

    // 单条删除
    async remove(bucket, id) {
      var user = await this._uid();
      if (!user) throw new Error('未登录');
      var { error } = await client
        .from('user_items')
        .delete()
        .eq('bucket', bucket)
        .eq('item_id', String(id));
      if (error) throw error;
    },

    // 设置（单行）
    async getSettings() {
      var { data, error } = await client
        .from('user_settings')
        .select('data')
        .maybeSingle();
      if (error) throw error;
      return data ? data.data : null;
    },
    async saveSettings(obj) {
      var user = await this._uid();
      if (!user) throw new Error('未登录');
      var { error } = await client
        .from('user_settings')
        .upsert({ user_id: user, data: obj, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' });
      if (error) throw error;
    },

    // 获取当前用户 id
    async _uid() {
      var { data } = await client.auth.getUser();
      return data && data.user ? data.user.id : null;
    }
  };
})();
