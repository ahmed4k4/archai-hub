/* ============================================================
   Resources View
   ============================================================ */
import { getState, isAdmin, isItemLoading, getItemError, getFilesByProject, getFilesByTask } from '../state.js';
import { getVisibleResources } from '../api/resources.js';
import {
  escapeHtml, emptyState, formatDate, formatFileSize,
  projectTitle,
} from '../ui/helpers.js';
import { setText } from '../ui/dom.js';

export function renderResources() {
  const state = getState();
  const list = getVisibleResources();
  const visibleFiles = isAdmin()
    ? state.files
    : state.files.filter(f =>
        f.uploaded_by === state.user?.id ||
        (f.project_id && state.projectMembers.some(m => m.project_id === f.project_id && m.user_id === state.user?.id)) ||
        (f.task_id && state.tasks.some(t => t.id === f.task_id && t.assigned_to === state.user?.id))
      );

  const links = list.filter(r => r.type === 'link' || /^https?:\/\//i.test(r.content || ''));
  const notes = list.filter(r => !links.includes(r));

  setText('resource-link-count', links.length);
  setText('resource-note-count', notes.length);
  setText('resource-file-count', visibleFiles.length);
  setText('resource-project-count', new Set(visibleFiles.map(f => f.project_id).filter(Boolean)).size);
  setText('resource-content-count', list.length);
  setText('resource-library-count', visibleFiles.length);

  // Content
  const contentGrid = document.getElementById('resources-grid');
  if (contentGrid) {
    contentGrid.innerHTML = list.length
      ? list.map(r => resourceCard(r)).join('')
      : emptyState('fa-link-slash', 'لا توجد روابط أو ملاحظات متاحة');
  }

  // Files grouped
  const library = document.getElementById('resource-file-library');
  if (!library) return;

  if (!visibleFiles.length) {
    library.innerHTML = emptyState('fa-folder-open', 'لا توجد ملفات PDF متاحة');
    return;
  }

  const groups = {};
  visibleFiles.forEach(f => {
    const key = f.project_id || 'general';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  });

  const admin = isAdmin();

  library.innerHTML = Object.keys(groups).map(key => {
    const project = key === 'general' ? null : state.projects.find(p => p.id === key);
    const files = groups[key];
    
    // Check if any file in this group is loading
    const groupLoading = files.some(f => isItemLoading('files', f.id));
    const groupError = files.find(f => getItemError('files', f.id));

    return `
      <section class="file-group ${groupLoading ? 'opacity-50' : ''}">
        <div class="file-group-head">
          <div class="file-group-title">
            <span class="file-group-icon"><i class="fa-solid ${project ? 'fa-diagram-project' : 'fa-layer-group'}"></i></span>
            <div>
              <h5>${project ? escapeHtml(project.title) : 'ملفات عامة'}</h5>
              <p>${project
                ? `${files.filter(f => !f.task_id).length} ملفات مشروع • ${files.filter(f => f.task_id).length} ملفات مهام`
                : 'لا يرتبط بمشروع محدد'}</p>
            </div>
          </div>
          <span>${files.length} ملف</span>
        </div>
        ${groupError ? `
          <div class="file-group-error">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${escapeHtml(groupError.message)}</span>
          </div>
        ` : ''}
        <div class="file-group-grid">
          ${files.map(f => fileCard(f)).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function resourceCard(r) {
  const content = r.content || r.content_or_url || '';
  const isLink = r.type === 'link' || /^https?:\/\//i.test(content);
  const admin = isAdmin();
  
  const loading = isItemLoading('resources', r.id);
  const error = getItemError('resources', r.id);

  return `
    <article class="resource-item ${loading ? 'opacity-50' : ''}">
      <div class="resource-item-head">
        <div class="resource-item-icon ${isLink ? 'resource-item-icon-cyan' : 'resource-item-icon-amber'}">
          <i class="fa-solid ${isLink ? 'fa-link' : 'fa-note-sticky'}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h4 class="resource-item-title">${escapeHtml(r.title)}</h4>
              <p class="resource-item-meta">${r.project_id ? `مشروع: ${escapeHtml(projectTitle(r.project_id))}` : 'مورد عام'}</p>
            </div>
            ${admin ? `
              <div class="resource-item-actions">
                <button class="resource-item-action" data-edit-resource="${escapeHtml(r.id)}" ${loading ? 'disabled' : ''}>
                  ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : '<i class="fa-solid fa-pen"></i>'}
                </button>
                <button class="resource-item-action" data-delete-resource="${escapeHtml(r.id)}" ${loading ? 'disabled' : ''}>
                  ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : '<i class="fa-solid fa-trash"></i>'}
                </button>
              </div>
            ` : ''}
          </div>
          <div class="resource-item-preview">${escapeHtml(content)}</div>
          ${isLink ? `
            <a href="${escapeHtml(content)}" target="_blank" rel="noopener noreferrer" class="link mt-2 inline-block">
              فتح الرابط <i class="fa-solid fa-arrow-up-left-from-square"></i>
            </a>
          ` : ''}
          ${error ? `
            <div class="resource-item-error">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>${escapeHtml(error.message)}</span>
            </div>
          ` : ''}
          ${loading ? `
            <div class="resource-item-loading">
              <i class="fa-solid fa-circle-notch spin"></i>
            </div>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

function fileCard(f) {
  const admin = isAdmin();
  const source = f.task_id
    ? `مهمة: ${escapeHtml(getState().tasks.find(x => x.id === f.task_id)?.title || 'غير معروفة')}`
    : `مشروع: ${escapeHtml(projectTitle(f.project_id))}`;
  
  const projectFiles = f.project_id ? getFilesByProject(f.project_id) : [];
  const taskFiles = f.task_id ? getFilesByTask(f.task_id) : [];
  
  const loading = isItemLoading('files', f.id);
  const error = getItemError('files', f.id);

  return `
    <article class="file-card ${loading ? 'opacity-50' : ''}">
      <div class="file-card-head">
        <div class="file-card-icon"><i class="fa-regular fa-file-pdf"></i></div>
        <div class="min-w-0 flex-1">
          <h4 class="file-card-name truncate">${escapeHtml(f.file_name)}</h4>
          <p class="file-card-source">${source}</p>
          <p class="file-card-meta">${formatFileSize(f.file_size)} • ${formatDate(f.created_at, true)}</p>
        </div>
      </div>
      <div class="file-card-actions">
        <button class="file-card-btn ${loading ? 'loading' : ''}" data-download-file="${escapeHtml(f.id)}" ${loading ? 'disabled' : ''}>
          ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : '<i class="fa-solid fa-eye"></i><span>معاينة</span>'}
        </button>
        ${admin ? `
          <button class="file-card-btn ${loading ? 'loading' : ''}" data-edit-file="${escapeHtml(f.id)}" ${loading ? 'disabled' : ''}>
            ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : '<i class="fa-solid fa-pen"></i><span>تعديل</span>'}
          </button>
          <button class="file-card-btn danger ${loading ? 'loading' : ''}" data-delete-file="${escapeHtml(f.id)}" ${loading ? 'disabled' : ''}>
            ${loading ? '<i class="fa-solid fa-circle-notch spin"></i>' : '<i class="fa-solid fa-trash"></i><span>حذف</span>'}
          </button>
        ` : ''}
      </div>
      ${error ? `
        <div class="file-card-error">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${escapeHtml(error.message)}</span>
        </div>
      ` : ''}
      ${loading ? `
        <div class="file-card-loading">
          <i class="fa-solid fa-circle-notch spin"></i>
        </div>
      ` : ''}
    </article>
  `;
}
