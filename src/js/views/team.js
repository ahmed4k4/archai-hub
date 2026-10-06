/* ============================================================
   Team View
   ============================================================ */
import { getState, isAdmin, isItemLoading, getItemError, getTasksByUser } from '../state.js';
import { escapeHtml, emptyState } from '../ui/helpers.js';
import { setText } from '../ui/dom.js';

export function renderTeam() {
  const grid = document.getElementById('team-grid');
  if (!grid) return;

  if (!isAdmin()) {
    grid.innerHTML = emptyState('fa-shield-halved', 'هذه الصفحة متاحة لمدير النظام فقط');
    return;
  }

  const state = getState();
  let list = state.team.slice();

  const q = (document.getElementById('team-search')?.value || '').trim().toLowerCase();
  const role = document.getElementById('team-role-filter')?.value || '';
  if (q) list = list.filter(u => `${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(q));
  if (role) list = list.filter(u => u.role === role);

  if (!list.length) {
    grid.innerHTML = emptyState('fa-users', 'لا يوجد أعضاء مطابقون');
    return;
  }

  grid.innerHTML = list.map(u => {
    const userTasks = getTasksByUser(u.id);
    const assigned = userTasks.length;
    const completed = userTasks.filter(t => t.status === 'completed').length;
    const isMe = u.id === state.user?.id;
    const avatarClass = u.role === 'admin' ? 'team-avatar-admin' : 'team-avatar-user';
    
    const loading = isItemLoading('team', u.id);
    const error = getItemError('team', u.id);
    const isActive = u.active !== false; // Default to true if not set

    return `
      <article class="team-card ${loading ? 'opacity-50' : ''} ${!isActive ? 'team-card-inactive' : ''}">
        <div class="team-card-head">
          <div class="team-card-info">
            <div class="team-avatar ${avatarClass}">${escapeHtml((u.full_name || 'م').charAt(0))}</div>
            <div class="min-w-0">
              <h4 class="team-card-name">${escapeHtml(u.full_name || 'بدون اسم')}</h4>
              <p class="team-card-email">${escapeHtml(u.email || '')}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge ${u.role === 'admin' ? 'badge-amber' : 'badge-indigo'}">
              ${u.role === 'admin' ? 'مدير' : 'موظف'}
            </span>
            ${!isActive ? `
              <span class="badge badge-rose">معطل</span>
            ` : ''}
          </div>
        </div>
        <div class="team-card-stats">
          <div><b>${assigned}</b><span>المهام</span></div>
          <div><b class="text-emerald-400">${completed}</b><span>مكتملة</span></div>
        </div>
        ${error ? `
          <div class="team-card-error">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${escapeHtml(error.message)}</span>
          </div>
        ` : ''}
        <div class="team-card-actions">
          <button class="btn btn-secondary btn-sm" data-edit-team="${escapeHtml(u.id)}" ${loading ? 'disabled' : ''}>
            ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : '<i class="fa-solid fa-pen"></i>'} تعديل
          </button>
          <button class="btn btn-danger btn-sm" data-delete-team="${escapeHtml(u.id)}"
                  ${isMe || loading ? 'disabled title="لا يمكن حذف حسابك الحالي"' : ''}>
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        ${loading ? `
          <div class="team-card-loading">
            <i class="fa-solid fa-circle-notch spin"></i>
          </div>
        ` : ''}
      </article>
    `;
  }).join('');
}
