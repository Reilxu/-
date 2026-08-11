// ============================================================================
// 登录与鉴权态（GitHub OAuth）
// 仅使用 anon key；登录态由 Supabase Auth 管理（persistSession）。
// ============================================================================
(function () {
  'use strict';

  var Auth = {
    // GitHub OAuth 登录（跳转式）
    async signInWithGitHub() {
      if (!window.SupabaseReady || !window.SB) {
        alert('Supabase 未配置，无法登录');
        return;
      }
      // 登录成功后回调到当前站点来源（镜像 191.40.37.48 与 Vercel 都正确）
      var redirectTo = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? (window.location.origin + '/')
        : 'https://ai-workbench-tan.vercel.app/';
    var { error } = await window.SB.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: redirectTo }
      });
      if (error) alert('登录失败：' + error.message);
    },

    async signOut() {
      if (!window.SB) return;
      await window.SB.auth.signOut();
    },

    // 订阅登录态变化，回调收到 (user|null, event)
    // event 取值：INITIAL_SESSION / SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED ...
    onAuthChange(cb) {
      if (!window.SB) { cb(null, 'NO_CLIENT'); return; }
      window.SB.auth.onAuthStateChange(function (event, session) {
        cb(session && session.user ? session.user : null, event);
      });
    },

    // 恢复登录态：优先读本地已持久化的 session（不发网络请求，刷新页面时最快且不受
    // 网络抖动影响）；本地没有再回退到 getUser() 走一次服务端校验。
    async getCurrentUser() {
      if (!window.SB) return null;
      try {
        var s = await window.SB.auth.getSession();
        if (s && s.data && s.data.session && s.data.session.user) {
          return s.data.session.user;
        }
      } catch (e) { /* 继续尝试 getUser */ }
      try {
        var r = await window.SB.auth.getUser();
        return r && r.data && r.data.user ? r.data.user : null;
      } catch (e) {
        return null;
      }
    }
  };

  window.Auth = Auth;
})();
