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
      var { error } = await window.SB.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.href }
      });
      if (error) alert('登录失败：' + error.message);
    },

    async signOut() {
      if (!window.SB) return;
      await window.SB.auth.signOut();
    },

    // 订阅登录态变化，回调收到 user 或 null
    onAuthChange(cb) {
      if (!window.SB) { cb(null); return; }
      window.SB.auth.onAuthStateChange(function (event, session) {
        cb(session && session.user ? session.user : null);
      });
    },

    async getCurrentUser() {
      if (!window.SB) return null;
      var { data } = await window.SB.auth.getUser();
      return data && data.user ? data.user : null;
    }
  };

  window.Auth = Auth;
})();
