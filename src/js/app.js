/* ============================================================
   Archai Hub — Bootstrap
   ============================================================ */
import { getClient } from './supabase.js';
import { setLang, getLang, applyTranslations, onLangChange } from './i18n.js';
import { setTheme, getTheme, onThemeChange, bindThemeToggles } from './theme.js';
import { getState, setState, resetState, onStateChange } from './state.js';
import { renderAuthScreen, renderAppShell, switchView } from './ui/shell.js';
import { bindAuthEvents } from './auth.js';
import { bindGlobalEvents } from './ui/events.js';
import { loadAllData } from './api/index.js';
import { renderAllViews } from './views/index.js';
import { toast } from './ui/toast.js';

async function init() {
  // Apply preferences
  setTheme(getTheme(), false);
  setLang(getLang(), false);

  // Render shells
  renderAuthScreen();
  renderAppShell();

  // Bind events
  bindAuthEvents();
  bindGlobalEvents();
  bindThemeToggles();

  // React to state changes
  onStateChange((state) => {
    if (state.session && state.profile) {
      renderAllViews();
      updateUserHeader();
      updateAdminVisibility();
    }
  });

  // Language / theme changes
  onLangChange(() => {
    applyTranslations();
    renderAllViews();
    updateUserHeader();
    updateThemeControls();
  });
  onThemeChange(() => {
    updateThemeControls();
  });

  updateThemeControls();
  updateLangControls();

  // Session check
  const client = getClient();
  const { data } = await client.auth.getSession();

  if (data?.session) {
    await establishSession(data.session);
  } else {
    showAuth();
  }

  // Auth listener
  client.auth.onAuthStateChange(async (event, newSession) => {
    if (event === 'SIGNED_OUT' || !newSession) {
      resetState();
      showAuth();
      return;
    }
    if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
      await establishSession(newSession);
    }
  });
}

async function establishSession(session) {
  const client = getClient();
  setState({ session, user: session.user });

  const { data: profile, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !profile) {
    await client.auth.signOut({ scope: 'local' });
    resetState();
    showAuth();
    return;
  }

  setState({ profile });
  hideAuth();
  switchView('dashboard');

  try {
    await loadAllData();
    renderAllViews();
    updateUserHeader();
    updateAdminVisibility();
  } catch (err) {
    toast('تعذر تحميل البيانات.', 'error');
    console.error(err);
  }
}

function showAuth() {
  document.getElementById('auth-screen')?.classList.remove('hidden');
  document.getElementById('app-shell')?.classList.add('hidden');
}

function hideAuth() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.remove('hidden');
}

function updateUserHeader() {
  const state = getState();
  const name = state.profile?.full_name || state.user?.email || 'مستخدم';
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  const roleEl = document.getElementById('user-role');
  if (nameEl) nameEl.textContent = name;
  if (avatarEl) avatarEl.textContent = name.trim().charAt(0) || 'م';
  if (roleEl) {
    roleEl.textContent = state.profile?.role === 'admin'
      ? 'مدير النظام • صلاحيات كاملة'
      : 'موظف • صلاحيات محدودة';
  }
}

function updateAdminVisibility() {
  const state = getState();
  const admin = state.profile?.role === 'admin';
  document.getElementById('admin-actions')?.classList.toggle('hidden', !admin);
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !admin));
  document.getElementById('nav-team')?.classList.toggle('hidden', !admin);
}

function updateThemeControls() {
  const theme = getTheme();
  document.querySelectorAll('#theme-toggle, #auth-theme-toggle').forEach(btn => {
    const icon = btn.querySelector('i');
    if (icon) icon.className = `fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`;
  });
}

function updateLangControls() {
  const lang = getLang();
  document.querySelectorAll('#lang-toggle, #auth-lang-toggle').forEach(btn => {
    const code = btn.querySelector('.lang-code');
    if (code) code.textContent = lang === 'ar' ? 'EN' : 'AR';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}