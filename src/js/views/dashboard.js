/* ============================================================
   Dashboard View
   ============================================================ */
import { getState, isAdmin, getTasksByProject } from '../state.js';
import { getVisibleProjects } from '../api/projects.js';
import { getVisibleTasks } from '../api/tasks.js';
import { escapeHtml, emptyState, formatDate } from '../ui/helpers.js';
import { t } from '../i18n.js';
import { setText, setHtml } from '../ui/dom.js';

export function renderDashboard() {
  const state = getState();
  const projects = getVisibleProjects();
  const tasks = getVisibleTasks();

  // Calculate stats with NaN/undefined protection
  const todo = tasks.filter(t => t.status === 'todo').length;
  const progress = tasks.filter(t => t.status === 'in_progress').length;
  const done = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const rate = totalTasks > 0 ? Math.round(done / totalTasks * 100) : 0;

  // Update stat cards with safe values
  setText('stat-projects', projects.length);
  setText('stat-tasks', totalTasks);
  setText('stat-progress', progress);
  setText('stat-completed', done);
  setText('completion-rate', `${rate}%`);
  setText('dash-todo', todo);
  setText('dash-progress', progress);
  setText('dash-done', done);

  // Update completion ring
  const ring = document.getElementById('completion-ring');
  if (ring) {
    const rest = document.documentElement.classList.contains('light') ? '#e2e8f0' : '#1e293b';
    ring.style.background = `conic-gradient(var(--brand-500) ${rate * 3.6}deg, ${rest} ${rate * 3.6}deg)`;
  }

  // Update ring stats
  setText('dash-todo', todo);
  setText('dash-progress', progress);
  setText('dash-done', done);

  // Render project list
  const list = document.getElementById('dashboard-projects');
  if (!list) return;

  if (!projects.length) {
    list.innerHTML = emptyState('fa-folder-open', 'لا توجد مشاريع متاحة');
    return;
  }

  list.innerHTML = projects.slice(0, 7).map(p => {
    const pt = tasks.filter(t => t.project_id === p.id);
    const pd = pt.filter(t => t.status === 'completed').length;
    const pr = pt.length ? Math.round(pd / pt.length * 100) : 0;
    return `
      <div class="dash-project">
        <div class="dash-project-head">
          <div class="min-w-0">
            <h4 class="dash-project-title">${escapeHtml(p.title)}</h4>
            <p class="dash-project-meta">${pt.length} مهمة</p>
          </div>
          <b class="dash-project-pct">${pr}%</b>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pr}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show loading state on dashboard
 */
export function showDashboardLoading() {
  const statIds = ['stat-projects', 'stat-tasks', 'stat-progress', 'stat-completed', 'completion-rate', 'dash-todo', 'dash-progress', 'dash-done'];
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '...';
  });
  
  const ring = document.getElementById('completion-ring');
  if (ring) {
    ring.style.background = 'conic-gradient(var(--brand-500) 0deg, var(--color-border) 0deg)';
  }
  
  const list = document.getElementById('dashboard-projects');
  if (list) {
    list.innerHTML = `
      <div class="dash-loading">
        <i class="fa-solid fa-circle-notch spin"></i>
        <span>جاري تحميل المشاريع...</span>
      </div>
    `;
  }
}

/**
 * Show error state on dashboard
 */
export function showDashboardError(message = 'تعذر تحميل البيانات') {
  const statIds = ['stat-projects', 'stat-tasks', 'stat-progress', 'stat-completed', 'completion-rate', 'dash-todo', 'dash-progress', 'dash-done'];
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  
  const ring = document.getElementById('completion-ring');
  if (ring) {
    ring.style.background = 'conic-gradient(var(--rose-500) 0deg, var(--color-border) 0deg)';
  }
  
  const list = document.getElementById('dashboard-projects');
  if (list) {
    list.innerHTML = `
      <div class="dash-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${escapeHtml(message)}</span>
        <button class="btn btn-secondary btn-sm mt-2" onclick="window.location.reload()">إعادة المحاولة</button>
      </div>
    `;
  }
}
