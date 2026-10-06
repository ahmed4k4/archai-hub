/* ============================================================
   Confirmation Dialog
   ============================================================ */
import { openModal, closeModal } from './modal.js';
import { t } from '../i18n.js';

export function confirmDialog({ title, message, confirmText, cancelText } = {}) {
  return new Promise((resolve) => {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal-body">
          <div class="flex gap-4">
            <div class="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h3 id="confirm-title" class="modal-title">${title || t('تأكيد')}</h3>
              <p class="text-xs text-slate-400 mt-1">${message || ''}</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="cancel">${cancelText || t('إلغاء')}</button>
          <button class="btn btn-danger" data-action="confirm">${confirmText || t('تأكيد')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    openModal(modal);

    // Handle click events
    const handleClick = (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'confirm') {
        closeModal(modal);
        modal.removeEventListener('click', handleClick);
        modal.remove();
        resolve(true);
      } else if (action === 'cancel' || e.target === modal) {
        closeModal(modal);
        modal.removeEventListener('click', handleClick);
        modal.remove();
        resolve(false);
      }
    };

    modal.addEventListener('click', handleClick);
    
    // Handle escape key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeModal(modal);
        modal.removeEventListener('click', handleClick);
        modal.removeEventListener('keydown', handleKeydown);
        modal.remove();
        resolve(false);
      }
    };
    modal.addEventListener('keydown', handleKeydown);
  });
}
