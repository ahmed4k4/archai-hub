/* ============================================================
   DOM Utilities — Shared DOM manipulation helpers
   ============================================================ */
import { getState, isAdmin } from '../state.js';
import { escapeHtml, formatDate, formatFileSize, memberName, projectTitle, statusLabel, statusClass, projectStatusLabel, projectStatusClass, priorityLabel, priorityClass, activityIcon, activityLabel, activityUserName, averageProgress, emptyState } from './helpers.js';

/**
 * Set text content of element by ID
 */
export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

/**
 * Set innerHTML of element by ID
 */
export function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value ?? '';
}

/**
 * Set className of element by ID
 */
export function setClass(id, value) {
  const el = document.getElementById(id);
  if (el) el.className = value;
}

/**
 * Set style property of element by ID
 */
export function setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}

/**
 * Set loading state on button
 */
export function setLoading(btn, loading, text = 'جاري التنفيذ...') {
  if (!btn) return;
  if (loading) {
    btn.dataset.old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch spin"></i><span>${text}</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.old) btn.innerHTML = btn.dataset.old;
  }
}

/**
 * Get element by ID (shorthand)
 */
export function $(id) {
  return document.getElementById(id);
}