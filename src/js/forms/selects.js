/* ============================================================
   Populate form selects
   ============================================================ */
import { getState, isAdmin } from '../state.js';
import { getVisibleProjects } from '../api/projects.js';
import { escapeHtml } from '../ui/helpers.js';

export function populateSelects() {
  const state = getState();
  const projects = getVisibleProjects();
  // Include all users (admin and user) for assignee selection
  const members = isAdmin() ? state.team.filter(u => u.active !== false) : [];

  // Task form
  setOptions('task-project', '<option value="">اختر المشروع...</option>' +
    projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join(''));

  setOptions('resource-project', '<option value="">اختر المشروع...</option>' +
    projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join(''));

  setOptions('task-assignee', '<option value="">اختر الموظف...</option>' +
    members.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.full_name)} — ${escapeHtml(u.email || '')}</option>`).join(''));

  // Project members picker
  const picker = document.getElementById('project-members-picker');
  if (picker) {
    picker.innerHTML = members.length
      ? members.map(u => `
          <label class="member-option">
            <input type="checkbox" name="project-member" value="${escapeHtml(u.id)}">
            <span class="member-option-text">
              ${escapeHtml(u.full_name || u.email)}
              <small>${escapeHtml(u.email || '')}</small>
            </span>
          </label>
        `).join('')
      : '<p class="text-slate-500 text-xs">أنشئ المستخدمين أولاً من فريق العمل.</p>';
  }
}

export function populateFileUploadTargets() {
  const state = getState();
  const select = document.getElementById('file-target-project');
  if (!select) return;
  select.innerHTML = '<option value="">اختر المشروع...</option>' +
    state.projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
}

export function populateTaskFileTargets() {
  const projectId = document.getElementById('file-target-project')?.value;
  const taskSelect = document.getElementById('file-target-task');
  if (!taskSelect) return;
  const state = getState();
  taskSelect.innerHTML = '<option value="">اختر المهمة...</option>' +
    state.tasks.filter(t => t.project_id === projectId)
      .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`).join('');
}

function setOptions(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
