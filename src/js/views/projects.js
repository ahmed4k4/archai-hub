/* ============================================================
   Projects View
   ============================================================ */
import { getState, isAdmin, isItemLoading, getItemError, getTasksByProject, getMembersByProject, getFilesByProject } from '../state.js';
import { getVisibleProjects } from '../api/projects.js';
import { getVisibleTasks } from '../api/tasks.js';
import { escapeHtml, emptyState, projectStatusLabel, projectStatusClass } from '../ui/helpers.js';
import { setText } from '../ui/dom.js';

export function renderProjects() {
  const list = getVisibleProjects();
  const tasks = getVisibleTasks();
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (!list.length) {
    const state = getState();
    const isAdminUser = state.profile?.role === 'admin';
    grid.innerHTML = emptyState(
      'fa-diagram-project', 
      isAdminUser ? 'لا توجد مشاريع. اضغط "مشروع جديد" للبدء.' : 'لا توجد مشاريع متاحة لك.'
    );
    return;
  }

  const admin = isAdmin();

  grid.innerHTML = list.map(p => {
    const pt = getTasksByProject(p.id);
    const done = pt.filter(t => t.status === 'completed').length;
    const rate = pt.length ? Math.round(done / pt.length * 100) : 0;
    const memberCount = getMembersByProject(p.id).length;
    const docCount = getFilesByProject(p.id).length;
    
    const loading = isItemLoading('projects', p.id);
    const error = getItemError('projects', p.id);

    return `
      <article class="project-card ${loading ? 'opacity-50' : ''}" data-open-project="${escapeHtml(p.id)}">
        <div>
          <div class="project-cover"></div>
          <div class="project-card-head">
            <div class="project-card-icon"><i class="fa-solid fa-diagram-project"></i></div>
            ${admin ? `
              <button class="resource-item-action" data-delete-project="${escapeHtml(p.id)}" title="حذف" ${loading ? 'disabled' : ''}>
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : ''}
            ${loading ? `
              <div class="project-card-loading">
                <i class="fa-solid fa-circle-notch spin"></i>
              </div>
            ` : ''}
          </div>
          <h4 class="project-card-title">${escapeHtml(p.title)}</h4>
          <p class="project-card-desc">${escapeHtml(p.description || 'لا يوجد وصف للمشروع.')}</p>
          <div class="project-card-tags">
            <span class="badge badge-slate"><i class="fa-solid fa-users"></i> ${memberCount}</span>
            <span class="badge badge-slate"><i class="fa-regular fa-file-pdf"></i> ${docCount}</span>
            <span class="badge ${projectStatusClass(p.status)}">${projectStatusLabel(p.status)}</span>
          </div>
          ${error ? `
            <div class="project-card-error">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>${escapeHtml(error.message)}</span>
            </div>
          ` : ''}
        </div>
        <div class="project-card-footer">
          <div class="project-card-progress-head">
            <span>الإنجاز</span>
            <b>${done}/${pt.length} • ${rate}%</b>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${rate}%"></div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}
