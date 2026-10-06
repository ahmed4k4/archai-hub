/* ============================================================
   Theme Manager
   ============================================================ */
import { STORAGE_KEYS } from './config.js';

let currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
const listeners = new Set();

export function getTheme() {
  return currentTheme;
}

export function setTheme(theme, persist = true) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  if (persist) localStorage.setItem(STORAGE_KEYS.THEME, currentTheme);

  const html = document.documentElement;
  html.classList.toggle('light', currentTheme === 'light');
  html.classList.toggle('dark', currentTheme === 'dark');
  html.style.colorScheme = currentTheme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = currentTheme === 'light' ? '#f4f7fb' : '#080b14';

  // Update theme toggle icons
  updateThemeIcons();

  notify();
}

export function toggleTheme() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => {
    try { fn(currentTheme); } catch (e) { console.error(e); }
  });
}

/**
 * Update theme toggle icons (sun/moon) based on current theme
 */
function updateThemeIcons() {
  const isLight = currentTheme === 'light';
  const sunIcon = 'fa-sun';
  const moonIcon = 'fa-moon';
  
  // Main theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (icon) {
      icon.classList.remove(sunIcon, moonIcon);
      icon.classList.add(isLight ? moonIcon : sunIcon);
    }
  }
  
  // Auth theme toggle
  const authThemeToggle = document.getElementById('auth-theme-toggle');
  if (authThemeToggle) {
    const icon = authThemeToggle.querySelector('i');
    if (icon) {
      icon.classList.remove(sunIcon, moonIcon);
      icon.classList.add(isLight ? moonIcon : sunIcon);
    }
  }
}

/**
 * Bind theme toggle buttons
 */
export function bindThemeToggles() {
  const themeToggle = document.getElementById('theme-toggle');
  const authThemeToggle = document.getElementById('auth-theme-toggle');
  
  const handleClick = () => toggleTheme();
  
  if (themeToggle) {
    themeToggle.removeEventListener('click', handleClick);
    themeToggle.addEventListener('click', handleClick);
  }
  
  if (authThemeToggle) {
    authThemeToggle.removeEventListener('click', handleClick);
    authThemeToggle.addEventListener('click', handleClick);
  }
  
  // Initial icon update
  updateThemeIcons();
}
