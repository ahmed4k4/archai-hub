/* ============================================================
   Modal Controller — single source of truth
   ============================================================ */
import { applyTranslations } from '../i18n.js';

const stack = [];
let lastFocusedElement = null;

export function openModal(modalEl) {
  if (!modalEl) return;
  
  // Prevent duplicate - if already open, bring to front
  if (modalEl.classList.contains('open')) {
    // Move to top of stack
    const idx = stack.indexOf(modalEl);
    if (idx >= 0) {
      stack.splice(idx, 1);
      stack.push(modalEl);
    }
    return;
  }
  
  // Store last focused element for restoration
  lastFocusedElement = document.activeElement;
  
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
  stack.push(modalEl);
  applyTranslations(modalEl);
  
  // Focus management - focus first focusable element
  const focusable = modalEl.querySelector('[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) {
    focusable.focus();
  }
  
  // Trap focus within modal
  modalEl.addEventListener('keydown', trapFocus);
}

export function closeModal(modalEl) {
  if (!modalEl) return;
  
  // Remove focus trap
  modalEl.removeEventListener('keydown', trapFocus);
  
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');
  const idx = stack.indexOf(modalEl);
  if (idx >= 0) stack.splice(idx, 1);
  
  if (stack.length === 0) {
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    
    // Restore focus to trigger element
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  
  const modalEl = stack[stack.length - 1];
  if (!modalEl) return;
  
  const focusableElements = modalEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}

export function closeTopModal() {
  const top = stack[stack.length - 1];
  if (top) closeModal(top);
}

export function closeAllModals() {
  while (stack.length) closeModal(stack.pop());
}

export function openModalById(id) {
  const el = document.getElementById(id);
  if (el) openModal(el);
}

export function closeModalById(id) {
  const el = document.getElementById(id);
  if (el) closeModal(el);
}

/**
 * Reset form inside modal
 */
export function resetModalForm(modalEl) {
  const form = modalEl.querySelector('form');
  if (form) {
    form.reset();
    // Clear any error messages
    form.querySelectorAll('.alert, .error-message, [data-error]').forEach(el => {
      el.remove();
    });
    // Clear any loading states
    form.querySelectorAll('[data-loading]').forEach(el => {
      el.removeAttribute('data-loading');
    });
    // Reset submit button
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      if (submitBtn.dataset.old) {
        submitBtn.innerHTML = submitBtn.dataset.old;
        delete submitBtn.dataset.old;
      }
    }
  }
}

/**
 * Set loading state on modal
 */
export function setModalLoading(modalEl, loading, text = 'جاري التنفيذ...') {
  const submitBtn = modalEl?.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  
  if (loading) {
    submitBtn.dataset.old = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch spin"></i><span>${text}</span>`;
  } else {
    submitBtn.disabled = false;
    if (submitBtn.dataset.old) {
      submitBtn.innerHTML = submitBtn.dataset.old;
      delete submitBtn.dataset.old;
    }
  }
}

/**
 * Show error in modal
 */
export function showModalError(modalEl, message) {
  const form = modalEl?.querySelector('form');
  if (!form) return;
  
  // Remove existing errors
  form.querySelectorAll('.modal-error').forEach(el => el.remove());
  
  const errorEl = document.createElement('div');
  errorEl.className = 'alert alert-danger modal-error';
  errorEl.textContent = message;
  
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    form.insertBefore(errorEl, submitBtn.parentElement);
  } else {
    form.appendChild(errorEl);
  }
}

/**
 * Clear modal errors
 */
export function clearModalErrors(modalEl) {
  const form = modalEl?.querySelector('form');
  if (!form) return;
  form.querySelectorAll('.modal-error').forEach(el => el.remove());
}

/* Global delegation */
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-modal-open]');
  if (opener) {
    e.preventDefault();
    openModalById(opener.dataset.modalOpen);
    return;
  }

  const closer = e.target.closest('[data-modal-close]');
  if (closer) {
    e.preventDefault();
    const modal = closer.closest('.modal');
    if (modal) closeModal(modal);
    return;
  }

  // Click on backdrop
  if (e.target.classList.contains('modal')) {
    closeModal(e.target);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTopModal();
});
