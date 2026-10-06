/* ============================================================
   i18n — Clean translation system (no DOM walking)
   ============================================================ */
import { I18N, I18N_REVERSE, STORAGE_KEYS } from './config.js';

let currentLang = localStorage.getItem(STORAGE_KEYS.LANG) || 'ar';
const listeners = new Set();

export function getLang() {
  return currentLang;
}

export function setLang(lang, persist = true) {
  currentLang = lang === 'en' ? 'en' : 'ar';
  if (persist) localStorage.setItem(STORAGE_KEYS.LANG, currentLang);

  const html = document.documentElement;
  html.lang = currentLang;
  html.dir = currentLang === 'en' ? 'ltr' : 'rtl';
  html.classList.toggle('ltr', currentLang === 'en');

  notify();
}

export function t(key) {
  if (!key) return '';
  return currentLang === 'en' ? (I18N[key] || key) : (I18N_REVERSE[key] || key);
}

export function toggleLang() {
  setLang(currentLang === 'ar' ? 'en' : 'ar');
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => {
    try { fn(currentLang); } catch (e) { console.error(e); }
  });
}

/* Auto-translate elements with [data-i18n] */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });
}