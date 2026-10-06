/* ============================================================
   Tasks View (Kanban)
   ============================================================ */
import { getState, isAdmin, isItemLoading, getItemError, getFilesByTask } from '../state.js';
import { getVisibleTasks } from '../api/tasks.js';
import {
  escapeHtml, emptyState, memberName, projectTitle,
  statusLabel, statusClass,
} from '../ui/helpers.js';
import { setText } from '../ui/dom.js';

export function renderTasks() {
  const tasks = getVisibleTasks();
  const groups = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  setText('count-todo', groups.todo.length);
  setText('count-progress', groups.in_progress.length);
  setText('count-completed', groups.completed.length);

  renderColumn('kanban-todo', groups.todo);
  renderColumn('kanban-progress', groups.in_progress);
  renderColumn('kanban-completed', groups.completed);
}

function renderColumn(id, tasks) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = emptyState('fa-inbox', 'لا توجد مهام');
    return;
  }
  el.innerHTML = tasks.map(taskCard).join('');
}

function taskCard(t) {
  const state = getState();
  const admin = isAdmin();
  const canChange = admin || t.assigned_to === state.user?.id;
  const next = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'completed' : 'todo';
  const nextLabel = next === 'in_progress' ? 'بدء العمل' : next === 'completed' ? 'إتمام' : 'إرجاع للانتظار';
  const due = t.due_date ? new Date(t.due_date) : null;
  const overdue = due && due < new Date() && t.status !== 'completed';
  const fileCount = getFilesByTask(t.id).length;
  
  const loading = isItemLoading('tasks', t.id);
  const error = getItemError('tasks', t.id);

  return `
    <article class="task-card ${loading ? 'opacity-50' : ''}" data-open-task="${escapeHtml(t.id)}">
      <div class="task-card-head">
        <h5 class="task-card-title">${escapeHtml(t.title)}</h5>
        ${admin ? `
          <button class="resource-item-action" data-delete-task="${escapeHtml(t.id)}" title="حذف" ${loading ? 'disabled' : ''}>
            <i class="fa-solid fa-trash-can"></i>
          </button>
        ` : ''}
        ${loading ? `
          <div class="task-card-loading">
            <i class="fa-solid fa-circle-notch spin"></i>
          </div>
        ` : ''}
      </div>
      <p class="task-card-desc">${escapeHtml(t.description || 'بدون تفاصيل')}</p>
      <div class="task-card-tags">
        <span class="badge ${statusClass(t.status)}">${statusLabel(t.status)}</span>
        <span class="badge badge-slate">${escapeHtml(t.project_id ? projectTitle(t.project_id) : 'مهمة عامة')}</span>
      </div>
      <div class="task-card-progress">
        <div class="task-card-progress-head">
          <span>التقدم</span>
          <b class="text-indigo-400">${Number(t.progress || 0)}%</b>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Number(t.progress || 0)}%"></div>
        </div>
      </div>
      <div class="task-card-meta">
        <span><i class="fa-regular fa-user"></i> ${escapeHtml(memberName(t.assigned_to))}</span>
        <span><i class="fa-regular fa-file-pdf"></i> ${fileCount}</span>
        ${due ? `<span class="${overdue ? 'text-rose-400' : ''}"><i class="fa-regular fa-calendar"></i> ${due.toLocaleDateString('ar-EG')}</span>` : ''}
      </div>
      ${error ? `
        <div class="task-card-error">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${escapeHtml(error.message)}</span>
        </div>
      ` : ''}
      ${canChange ? `
        <button class="task-card-action ${loading ? 'loading' : ''}" data-status-task="${escapeHtml(t.id)}" data-status="${next}" ${loading ? 'disabled' : ''}>
          ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : nextLabel}
        </button>
      ` : ''}
    </article>
  `;
}
