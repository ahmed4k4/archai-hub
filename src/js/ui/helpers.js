/* ============================================================
   UI Helpers
   ============================================================ */
import { getState } from '../state.js';
import { t } from '../i18n.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value, withTime = false) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'ar-EG';
  return d.toLocaleDateString(locale, withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFileSize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return 'الحجم غير متاح';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function memberName(id) {
  const { team } = getState();
  return team.find(u => u.id === id)?.full_name || 'غير مسند';
}

export function projectTitle(id) {
  const { projects } = getState();
  return projects.find(p => p.id === id)?.title || 'مشروع غير معروف';
}

export function statusLabel(status) {
  const map = { todo: 'قيد الانتظار', in_progress: 'قيد التنفيذ', completed: 'مكتملة' };
  return t(map[status] || status || '-');
}

export function statusClass(status) {
  const map = {
    todo: 'badge-amber',
    in_progress: 'badge-cyan',
    completed: 'badge-emerald',
  };
  return map[status] || 'badge-slate';
}

export function projectStatusLabel(status) {
  const map = { planning: 'تخطيط', in_progress: 'قيد التنفيذ', paused: 'متوقف مؤقتًا', completed: 'مكتمل' };
  return t(map[status] || status || 'غير محدد');
}

export function projectStatusClass(status) {
  const map = {
    planning: 'badge-indigo',
    in_progress: 'badge-cyan',
    paused: 'badge-amber',
    completed: 'badge-emerald',
  };
  return map[status] || 'badge-slate';
}

export function priorityLabel(priority) {
  const map = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' };
  return t(map[priority] || 'متوسطة');
}

export function priorityClass(priority) {
  const map = {
    low: 'badge-slate',
    medium: 'badge-indigo',
    high: 'badge-amber',
    urgent: 'badge-rose',
  };
  return map[priority] || 'badge-slate';
}

export function activityUserName(id) {
  const state = getState();
  return state.team.find(u => u.id === id)?.full_name
    || (id === state.user?.id ? state.profile?.full_name : 'عضو الفريق')
    || 'عضو الفريق';
}

export function activityIcon(action) {
  const map = {
    project_created: 'fa-diagram-project',
    project_updated: 'fa-pen-to-square',
    task_created: 'fa-list-check',
    task_updated: 'fa-pen-to-square',
    task_status_changed: 'fa-arrows-rotate',
    comment: 'fa-comment',
    file_uploaded: 'fa-file-arrow-up',
    file_updated: 'fa-pen',
    file_deleted: 'fa-trash',
    resource_created: 'fa-link',
    resource_updated: 'fa-pen',
    member_added: 'fa-user-plus',
    progress_updated: 'fa-chart-line',
  };
  return map[action] || 'fa-clock-rotate-left';
}

export function activityLabel(action) {
  const map = {
    project_created: 'إنشاء المشروع',
    project_updated: 'تعديل المشروع',
    task_created: 'إنشاء مهمة',
    task_updated: 'تعديل المهمة',
    task_status_changed: 'تحديث حالة مهمة',
    comment: 'تعليق',
    file_uploaded: 'رفع ملف',
    file_updated: 'تعديل ملف',
    file_deleted: 'حذف ملف',
    resource_created: 'إضافة مورد',
    resource_updated: 'تعديل مورد',
    member_added: 'إضافة عضو',
    progress_updated: 'تحديث التقدم',
  };
  return t(map[action] || 'نشاط');
}

export function averageProgress(tasks) {
  if (!tasks.length) return 0;
  return Math.round(tasks.reduce((a, t) => a + Number(t.progress || 0), 0) / tasks.length);
}

export function emptyState(icon, text) {
  return `<div class="empty-state">
    <i class="fa-solid ${icon}"></i>
    <p>${escapeHtml(text)}</p>
  </div>`;
}

export function $(id) { return document.getElementById(id); }