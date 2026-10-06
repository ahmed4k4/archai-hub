/* ============================================================
   Toast Notifications
   ============================================================ */
import { escapeHtml } from './helpers.js';

const ICONS = {
  success: 'fa-circle-check text-emerald-400',
  error: 'fa-circle-xmark text-rose-400',
  info: 'fa-circle-info text-indigo-400',
  warning: 'fa-triangle-exclamation text-amber-400',
};

const BORDERS = {
  success: 'border-emerald-500/30',
  error: 'border-rose-500/30',
  info: 'border-indigo-500/30',
  warning: 'border-amber-500/30',
};

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

export function toast(message, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${BORDERS[type] || BORDERS.info}`;
  el.innerHTML = `
    <i class="fa-solid ${ICONS[type] || ICONS.info}"></i>
    <span class="text-xs font-semibold">${escapeHtml(message)}</span>
  `;
  ensureContainer().appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s';
    setTimeout(() => el.remove(), 200);
  }, duration);
}
