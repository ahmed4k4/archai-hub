/* ============================================================
   Shell Renderers (Auth + App)
   ============================================================ */
import { getState, onStateChange, isAdmin, setState } from '../state.js';
import { applyTranslations, t, onLangChange } from '../i18n.js';
import { onThemeChange, getTheme } from '../theme.js';
import { toast } from './toast.js';
import { setText } from './dom.js';

export function renderAuthScreen() {
  // Already in HTML — just bind language/theme buttons
  bindAuthToggles();
}

export function renderAppShell() {
  bindSidebar();
  bindHeader();
  bindNav();
  bindStateListeners();
}

function bindAuthToggles() {
  document.getElementById('auth-lang-toggle')?.addEventListener('click', () => {
    import('../i18n.js').then(m => m.toggleLang());
  });
  document.getElementById('auth-theme-toggle')?.addEventListener('click', () => {
    import('../theme.js').then(m => m.toggleTheme());
  });
}

function bindSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  document.getElementById('open-sidebar')?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('open');
  });

  document.getElementById('close-sidebar')?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  }
}

function bindHeader() {
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn');
    btn?.classList.add('spin');
    try {
      const { loadAllData } = await import('../api/index.js');
      await loadAllData();
      toast('تم تحديث البيانات.', 'success');
    } catch (e) {
      toast('تعذر تحديث البيانات.', 'error');
    } finally {
      setTimeout(() => btn?.classList.remove('spin'), 400);
    }
  });

  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    import('../i18n.js').then(m => m.toggleLang());
  });

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    import('../theme.js').then(m => m.toggleTheme());
  });

  document.getElementById('global-search')?.addEventListener('input', (e) => {
    setState({ searchTerm: e.target.value });
  });
}

function bindNav() {
  // Navigation is handled by global delegation in events.js
  // This function kept for compatibility
}

export function switchView(view) {
  const state = getState();
  const allowed = ['dashboard', 'projects', 'tasks', 'resources'].includes(view)
    || (view === 'team' && isAdmin());

  if (!allowed) {
    toast('لا تملك صلاحية الوصول لهذه الصفحة.', 'warning');
    return;
  }

  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const titles = {
    dashboard: ['الرئيسية', 'نظرة شاملة على النظام'],
    projects: ['المشاريع', 'إدارة المشاريع ونسب الإنجاز'],
    tasks: ['لوحة المهام', 'مهام المشاريع والمهام العامة ومتابعة التقدم'],
    team: ['فريق العمل', 'إدارة الأعضاء والأدوار'],
    resources: ['الموارد والملفات', 'الروابط والملاحظات وملفات المشاريع'],
  };

  const [title, subtitle] = titles[view] || ['', ''];
  setText('page-title', t(title));
  setText('page-subtitle', t(subtitle));

  // Mobile: close sidebar
  if (window.innerWidth < 768) {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('mobile-overlay')?.classList.remove('open');
  }
}

function bindStateListeners() {
  onStateChange(() => {
    updateUserHeader();
    updateAdminVisibility();
  });

  onLangChange(() => {
    applyTranslations();
  });
}

function updateUserHeader() {
  const { profile, user } = getState();
  const name = profile?.full_name || user?.email || 'مستخدم';
  setText('user-name', name);
  setText('user-avatar', name.trim().charAt(0) || 'م');
  setText('user-role', isAdmin() ? 'مدير النظام • صلاحيات كاملة' : 'موظف • صلاحيات محدودة');
}

function updateAdminVisibility() {
  const admin = isAdmin();
  document.getElementById('admin-actions')?.classList.toggle('hidden', !admin);
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !admin));
  document.getElementById('nav-team')?.classList.toggle('hidden', !admin);
}
