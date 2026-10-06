/* ============================================================
   Global Event Delegation — COMPLETE VERSION
   ============================================================ */
import { getState, isAdmin, setItemLoading, isItemLoading, getItemError, clearItemError } from '../state.js';
import { toast } from './toast.js';
import { confirmDialog } from './confirm.js';
import { switchView } from './shell.js';
import { t } from '../i18n.js';
import {
  escapeHtml,
  formatDate,
  formatFileSize,
  memberName,
  projectTitle,
  statusLabel,
  statusClass,
  projectStatusLabel,
  projectStatusClass,
  priorityLabel,
  priorityClass,
  activityIcon,
  activityLabel,
  activityUserName,
  averageProgress,
  emptyState,
} from './helpers.js';
import {
  setText,
  setHtml,
  setClass,
  setStyle,
  setLoading,
} from './dom.js';

import { deleteProject, createProject, updateProject, setProjectMembers } from '../api/projects.js';
import { deleteTask, updateTaskStatus, createTask, updateTask } from '../api/tasks.js';
import { deleteFile, getSignedUrl, updateFileName, uploadPdf, saveFileMeta, deleteFileFromStorage } from '../api/files.js';
import { deleteTeamMember, createTeamMember, updateTeamMember } from '../api/team.js';
import { createResource, updateResource, deleteResource } from '../api/resources.js';
import { logActivity } from '../api/activity.js';
import { 
  loadAllData, 
  loadProjectsData, 
  loadTasksData, 
  loadTeamData, 
  loadResourcesData, 
  loadFilesData, 
  loadActivitiesData 
} from '../api/index.js';
import { getClient } from '../supabase.js';
import { populateFileUploadTargets, populateTaskFileTargets, populateSelects } from '../forms/selects.js';
import { openModalById, resetModalForm, setModalLoading, showModalError, clearModalErrors } from './modal.js';
import { getVisibleProjects } from '../api/projects.js';

/* ============================================================
   Bind
   ============================================================ */
export function bindGlobalEvents() {
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
}

/* ============================================================
   Click Handler
   ============================================================ */
function handleClick(e) {
  // Navigation
  const nav = e.target.closest('[data-view]');
  if (nav) {
    switchView(nav.dataset.view);
    return;
  }

  const jump = e.target.closest('[data-view-jump]');
  if (jump) {
    switchView(jump.dataset.viewJump);
    return;
  }

  // Project tabs
  const tab = e.target.closest('[data-project-tab]');
  if (tab) {
    switchProjectTab(tab.dataset.projectTab);
    return;
  }

  const pjump = e.target.closest('[data-project-jump]');
  if (pjump) {
    switchProjectTab(pjump.dataset.projectJump);
    return;
  }

  // Open details
  const openP = e.target.closest('[data-open-project]');
  if (openP) {
    openProjectDetails(openP.dataset.openProject);
    return;
  }

  const openT = e.target.closest('[data-open-task]');
  if (openT) {
    openTaskDetails(openT.dataset.openTask);
    return;
  }

  // Delete actions
  if (e.target.closest('[data-delete-project]')) {
    handleDeleteProject(e.target.closest('[data-delete-project]').dataset.deleteProject);
    return;
  }
  if (e.target.closest('[data-delete-task]')) {
    handleDeleteTask(e.target.closest('[data-delete-task]').dataset.deleteTask);
    return;
  }
  if (e.target.closest('[data-delete-file]')) {
    handleDeleteFile(e.target.closest('[data-delete-file]').dataset.deleteFile);
    return;
  }
  if (e.target.closest('[data-delete-resource]')) {
    handleDeleteResource(e.target.closest('[data-delete-resource]').dataset.deleteResource);
    return;
  }
  if (e.target.closest('[data-delete-team]')) {
    handleDeleteTeam(e.target.closest('[data-delete-team]').dataset.deleteTeam);
    return;
  }

  // Edit actions
  if (e.target.closest('[data-edit-team]')) {
    openEditTeamModal(e.target.closest('[data-edit-team]').dataset.editTeam);
    return;
  }
  if (e.target.closest('[data-edit-project]')) {
    openEditProjectModal(e.target.closest('[data-edit-project]').dataset.editProject);
    return;
  }
  if (e.target.closest('[data-edit-task]')) {
    openEditTaskModal(e.target.closest('[data-edit-task]').dataset.editTask);
    return;
  }
  if (e.target.closest('[data-edit-file]')) {
    openEditFileModal(e.target.closest('[data-edit-file]').dataset.editFile);
    return;
  }
  if (e.target.closest('[data-edit-resource]')) {
    openEditResourceModal(e.target.closest('[data-edit-resource]').dataset.editResource);
    return;
  }

  // Upload actions
  const uploadP = e.target.closest('[data-project-upload]');
  if (uploadP) {
    const pid = uploadP.dataset.projectUpload;
    if (pid && pid !== '1') openFileUploadForProject(pid);
    else openModalById('file-upload-modal');
    return;
  }

  const uploadT = e.target.closest('[data-task-upload]');
  if (uploadT) {
    openFileUploadForTask(uploadT.dataset.taskUpload);
    return;
  }

  // Task status
  const st = e.target.closest('[data-status-task]');
  if (st) {
    handleStatusChange(st.dataset.statusTask, st.dataset.status);
    return;
  }

  // File download
  const dl = e.target.closest('[data-download-file]');
  if (dl) {
    handleDownloadFile(dl.dataset.downloadFile);
    return;
  }

  // Comments
  if (e.target.id === 'detail-comment-submit') {
    handleProjectComment(e.target.dataset.projectId);
    return;
  }
  if (e.target.id === 'detail-task-comment-submit') {
    handleTaskComment(e.target.dataset.taskId);
    return;
  }

  // Team search
  if (e.target.id === 'team-search') {
    // handled in input
  }
}

/* ============================================================
   Submit Handler
   ============================================================ */
function handleSubmit(e) {
  const form = e.target;
  if (form.id === 'team-form') { handleCreateTeam(e); return; }
  if (form.id === 'edit-team-form') { handleUpdateTeam(e); return; }
  if (form.id === 'project-form') { handleCreateProject(e); return; }
  if (form.id === 'edit-project-form') { handleUpdateProject(e); return; }
  if (form.id === 'task-form') { handleCreateTask(e); return; }
  if (form.id === 'edit-task-form') { handleUpdateTask(e); return; }
  if (form.id === 'resource-form') { handleCreateOrUpdateResource(e); return; }
  if (form.id === 'file-upload-form') { handleUploadFile(e); return; }
  if (form.id === 'edit-file-form') { handleUpdateFile(e); return; }
}

/* ============================================================
   Input Handler
   ============================================================ */
function handleInput(e) {
  if (e.target.id === 'team-search') {
    import('../views/team.js').then(m => m.renderTeam());
  }
}

/* ============================================================
   Change Handler
   ============================================================ */
function handleChange(e) {
  if (e.target.id === 'team-role-filter') {
    import('../views/team.js').then(m => m.renderTeam());
  }
  if (e.target.id === 'task-type') {
    const wrap = document.getElementById('task-project-wrap');
    wrap?.classList.toggle('hidden', e.target.value === 'general');
  }
  if (e.target.id === 'edit-task-type') {
    const wrap = document.getElementById('edit-task-project-wrap');
    wrap?.classList.toggle('hidden', e.target.value !== 'project');
  }
  if (e.target.id === 'file-target-type') {
    const wrap = document.getElementById('file-target-task-wrap');
    wrap?.classList.toggle('hidden', e.target.value !== 'task');
    populateTaskFileTargets();
  }
  if (e.target.id === 'file-target-project') {
    populateTaskFileTargets();
  }
}

/* ============================================================
   TEAM Handlers
   ============================================================ */
async function handleCreateTeam(e) {
  e.preventDefault();
  if (!isAdmin()) return toast('هذا الإجراء متاح للمدير فقط.', 'warning');

  const btn = e.submitter;
  const fullName = document.getElementById('team-name')?.value.trim();
  const email = document.getElementById('team-email')?.value.trim().toLowerCase();
  const password = document.getElementById('team-password')?.value;
  const role = document.getElementById('team-role')?.value || 'user';

  if (!fullName) return toast('اكتب اسم الموظف.', 'error');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) return toast('بريد إلكتروني غير صحيح.', 'error');
  if (!password || password.length < 8) return toast('كلمة المرور 8 أحرف على الأقل.', 'error');

  // Prevent duplicate submission
  if (btn.disabled) return;
  setLoading(btn, true, 'جاري إنشاء الحساب...');
  try {
    await createTeamMember({ fullName, email, password, role });
    toast('تم إنشاء الحساب بنجاح.', 'success');
    e.target.reset();
    document.getElementById('team-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadTeamData();
  } catch (err) {
    const msg = String(err?.message || '');
    if (/already.*registered|already.*exists|duplicate/i.test(msg)) {
      toast('هذا البريد مستخدم بالفعل.', 'error');
    } else {
      toast('تعذر الإنشاء: ' + msg, 'error');
    }
  } finally {
    setLoading(btn, false);
  }
}

async function handleUpdateTeam(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const id = document.getElementById('edit-team-id')?.value;
  const fullName = document.getElementById('edit-team-name')?.value.trim();
  const email = document.getElementById('edit-team-email')?.value.trim().toLowerCase();
  const password = document.getElementById('edit-team-password')?.value;
  const role = document.getElementById('edit-team-role')?.value;

  if (!id || !fullName || !email) return toast('أكمل البيانات.', 'error');
  if (password && password.length < 8) return toast('كلمة المرور 8 أحرف على الأقل.', 'error');

  setLoading(btn, true, 'جاري الحفظ...');
  try {
    await updateTeamMember({ userId: id, fullName, email, password, role });
    toast('تم تحديث البيانات.', 'success');
    document.getElementById('edit-team-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadTeamData();
  } catch (err) {
    toast('تعذر التحديث: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleDeleteTeam(id) {
  if (!isAdmin()) return;
  const state = getState();
  if (id === state.user?.id) return toast('لا يمكنك حذف حسابك الحالي.', 'warning');

  const member = state.team.find(u => u.id === id);
  if (!member) return;

  const ok = await confirmDialog({
    title: 'حذف العضو',
    message: `سيتم حذف حساب ${member.email || member.full_name} نهائياً.`,
    confirmText: 'حذف',
  });
  if (!ok) return;

  try {
    await deleteTeamMember(id);
    toast('تم حذف الحساب.', 'success');
    await loadTeamData();
  } catch (err) {
    toast('تعذر الحذف: ' + err.message, 'error');
  }
}

async function openEditTeamModal(id) {
  if (!isAdmin()) return;
  const state = getState();
  const u = state.team.find(x => x.id === id);
  if (!u) return;

  document.getElementById('edit-team-id').value = u.id;
  document.getElementById('edit-team-name').value = u.full_name || '';
  document.getElementById('edit-team-email').value = u.email || '';
  document.getElementById('edit-team-password').value = '';
  document.getElementById('edit-team-role').value = u.role || 'user';

  openModalById('edit-team-modal');
}

/* ============================================================
   PROJECT Handlers
   ============================================================ */
async function handleCreateProject(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const title = document.getElementById('project-title')?.value.trim();
  if (!title) return toast('اسم المشروع مطلوب.', 'error');

  const state = getState();
  const payload = {
    title,
    description: document.getElementById('project-description')?.value.trim() || null,
    status: document.getElementById('project-status')?.value || 'planning',
    priority: document.getElementById('project-priority')?.value || 'medium',
    start_date: document.getElementById('project-start')?.value || null,
    due_date: document.getElementById('project-due')?.value || null,
    created_by: state.user?.id,
  };

  // Prevent duplicate submission
  if (btn.disabled) return;
  setLoading(btn, true, 'جاري الإنشاء...');
  
    try {
      const project = await createProject(payload);

      // Members
      const selected = [...document.querySelectorAll('input[name="project-member"]:checked')].map(x => x.value);
      if (selected.length) {
        await setProjectMembers(project.id, selected);
      }

      // File upload
      const file = document.getElementById('project-file')?.files?.[0];
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `projects/${project.id}/documentation/${crypto.randomUUID()}-${safe}`;
        await uploadPdf(file, path);
        await saveFileMeta({
          projectId: project.id,
          fileName: file.name,
          filePath: path,
          fileSize: file.size,
          userId: state.user.id,
        });
      }

      await logActivity({
        projectId: project.id,
        action: 'project_created',
        description: `تم إنشاء المشروع: ${title}`,
      });

      toast('تم إنشاء المشروع بنجاح.', 'success');
      // Reset form AFTER successful creation
      e.target.reset();
      document.getElementById('project-modal')?.classList.remove('open');
      document.body.classList.remove('modal-open');
      // Only reload projects, not everything
      await loadProjectsData();
    } catch (err) {
      toast('تعذر الإنشاء: ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  }

async function handleUpdateProject(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const id = document.getElementById('edit-project-id')?.value;
  const title = document.getElementById('edit-project-title')?.value.trim();
  if (!id || !title) return toast('اسم المشروع مطلوب.', 'error');

  const progress = Math.min(100, Math.max(0, Number(document.getElementById('edit-project-progress')?.value || 0)));
  const payload = {
    title,
    description: document.getElementById('edit-project-description')?.value.trim() || null,
    status: document.getElementById('edit-project-status')?.value,
    priority: document.getElementById('edit-project-priority')?.value,
    start_date: document.getElementById('edit-project-start')?.value || null,
    due_date: document.getElementById('edit-project-due')?.value || null,
    progress,
  };

  setLoading(btn, true, 'جاري الحفظ...');
  try {
    await updateProject(id, payload);

    const selected = [...document.querySelectorAll('input[name="edit-project-member"]:checked')].map(x => x.value);
    await setProjectMembers(id, selected);

    await logActivity({
      projectId: id,
      action: 'project_updated',
      description: `تم تعديل المشروع: ${title}`,
    });

    toast('تم تحديث المشروع.', 'success');
    document.getElementById('edit-project-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadProjectsData();
    openProjectDetails(id);
  } catch (err) {
    toast('تعذر التحديث: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleDeleteProject(id) {
  if (!isAdmin()) return;
  const ok = await confirmDialog({
    title: 'حذف المشروع',
    message: 'سيتم حذف المشروع وكل بياناته المرتبطة.',
    confirmText: 'حذف',
  });
  if (!ok) return;

  try {
    await deleteProject(id);
    toast('تم حذف المشروع.', 'success');
    await loadProjectsData();
  } catch (err) {
    toast('تعذر الحذف: ' + err.message, 'error');
  }
}

async function openEditProjectModal(id) {
  if (!isAdmin()) return;
  const state = getState();
  const p = state.projects.find(x => x.id === id);
  if (!p) return;

  document.getElementById('edit-project-id').value = p.id;
  document.getElementById('edit-project-title').value = p.title || '';
  document.getElementById('edit-project-description').value = p.description || '';
  document.getElementById('edit-project-status').value = p.status || 'planning';
  document.getElementById('edit-project-priority').value = p.priority || 'medium';
  document.getElementById('edit-project-start').value = p.start_date || '';
  document.getElementById('edit-project-due').value = p.due_date || '';

  const tasks = state.tasks.filter(t => t.project_id === id);
  const progress = tasks.length
    ? Math.round(tasks.reduce((a, t) => a + Number(t.progress || 0), 0) / tasks.length)
    : 0;
  document.getElementById('edit-project-progress').value = Number(p.progress ?? progress);

  // Use populateSelects for consistent member picker
  const { populateSelects } = await import('../forms/selects.js');
  populateSelects();
  
  // Update the edit modal's member picker with current project's members
  const picker = document.getElementById('edit-project-members-picker');
  if (picker) {
    const state = getState();
    const members = state.team.filter(u => u.role === 'user');
    picker.innerHTML = members.map(u => {
      const checked = state.projectMembers.some(m => m.project_id === id && m.user_id === u.id);
      return `
        <label class="member-option">
          <input type="checkbox" name="edit-project-member" value="${escapeHtml(u.id)}" ${checked ? 'checked' : ''}>
          <span class="member-option-text">
            ${escapeHtml(u.full_name || u.email)}
            <small>${escapeHtml(u.email || '')}</small>
          </span>
        </label>
      `;
    }).join('');
  }

  openModalById('edit-project-modal');
}

/* ============================================================
   TASK Handlers
   ============================================================ */
async function handleCreateTask(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const type = document.getElementById('task-type')?.value;
  const projectId = type === 'project' ? document.getElementById('task-project')?.value || null : null;
  const title = document.getElementById('task-title')?.value.trim();
  const assignedTo = document.getElementById('task-assignee')?.value;

  if (!title || !assignedTo) return toast('أكمل البيانات المطلوبة.', 'error');
  if (type === 'project' && !projectId) return toast('اختر المشروع.', 'error');

  const state = getState();
  const payload = {
    project_id: projectId,
    title,
    description: document.getElementById('task-description')?.value.trim() || null,
    assigned_to: assignedTo,
    due_date: document.getElementById('task-due')?.value || null,
    priority: document.getElementById('task-priority')?.value || 'medium',
    status: 'todo',
    progress: 0,
    created_by: state.user?.id,
  };

  // Prevent duplicate submission
  if (btn.disabled) return;
  setLoading(btn, true, 'جاري الإنشاء...');
  try {
    const task = await createTask(payload);

    // Files
    const files = [...(document.getElementById('task-files')?.files || [])];
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = projectId
        ? `projects/${projectId}/tasks/${task.id}/${crypto.randomUUID()}-${safe}`
        : `general-tasks/${task.id}/${crypto.randomUUID()}-${safe}`;
      await uploadPdf(file, path);
      await saveFileMeta({
        projectId,
        taskId: task.id,
        fileName: file.name,
        filePath: path,
        fileSize: file.size,
        userId: state.user.id,
      });
    }

    await logActivity({
      projectId,
      taskId: task.id,
      action: 'task_created',
      description: `تم إنشاء المهمة: ${title}`,
    });

    toast('تم إنشاء المهمة بنجاح.', 'success');
    e.target.reset();
    document.getElementById('task-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadTasksData();
  } catch (err) {
    toast('تعذر الإنشاء: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleUpdateTask(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const id = document.getElementById('edit-task-id')?.value;
  const type = document.getElementById('edit-task-type')?.value;
  const projectId = type === 'project' ? document.getElementById('edit-task-project')?.value || null : null;
  const title = document.getElementById('edit-task-title')?.value.trim();
  const assignedTo = document.getElementById('edit-task-assignee')?.value;

  if (!id || !title || !assignedTo) return toast('أكمل البيانات.', 'error');

  const payload = {
    project_id: projectId,
    title,
    description: document.getElementById('edit-task-description')?.value.trim() || null,
    assigned_to: assignedTo,
    status: document.getElementById('edit-task-status')?.value,
    priority: document.getElementById('edit-task-priority')?.value,
    progress: Number(document.getElementById('edit-task-progress')?.value || 0),
    due_date: document.getElementById('edit-task-due')?.value || null,
  };

  if (payload.status === 'completed') payload.progress = 100;

  setLoading(btn, true, 'جاري الحفظ...');
  try {
    await updateTask(id, payload);
    await logActivity({
      projectId,
      taskId: id,
      action: 'task_updated',
      description: `تم تعديل المهمة: ${title}`,
    });
    toast('تم تحديث المهمة.', 'success');
    document.getElementById('edit-task-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadTasksData();
  } catch (err) {
    toast('تعذر التحديث: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleStatusChange(taskId, status) {
  const state = getState();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!isAdmin() && task.assigned_to !== state.user?.id) return;

  try {
    await updateTaskStatus(taskId, status);
    await logActivity({
      projectId: task.project_id,
      taskId: task.id,
      action: 'task_status_changed',
      description: `تحديث حالة المهمة إلى: ${statusLabel(status)}`,
    });
    toast('تم تحديث حالة المهمة.', 'success');
    await loadTasksData();
  } catch (err) {
    toast('تعذر التحديث: ' + err.message, 'error');
  }
}

async function handleDeleteTask(id) {
  if (!isAdmin()) return;
  const ok = await confirmDialog({ title: 'حذف المهمة', message: 'سيتم حذف المهمة نهائياً.', confirmText: 'حذف' });
  if (!ok) return;
  try {
    await deleteTask(id);
    toast('تم حذف المهمة.', 'success');
    await loadTasksData();
  } catch (err) {
    toast('تعذر الحذف: ' + err.message, 'error');
  }
}

async function openEditTaskModal(id) {
  if (!isAdmin()) return;
  const state = getState();
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;

  document.getElementById('edit-task-id').value = t.id;
  document.getElementById('edit-task-type').value = t.project_id ? 'project' : 'general';
  document.getElementById('edit-task-title').value = t.title || '';
  document.getElementById('edit-task-description').value = t.description || '';
  document.getElementById('edit-task-status').value = t.status || 'todo';
  document.getElementById('edit-task-priority').value = t.priority || 'medium';
  document.getElementById('edit-task-progress').value = Number(t.progress || 0);
  document.getElementById('edit-task-due').value = t.due_date || '';

  const projectSelect = document.getElementById('edit-task-project');
  if (projectSelect) {
    projectSelect.innerHTML = '<option value="">اختر المشروع...</option>' +
      state.projects.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
    projectSelect.value = t.project_id || '';
  }

  const assigneeSelect = document.getElementById('edit-task-assignee');
  if (assigneeSelect) {
    assigneeSelect.innerHTML = '<option value="">اختر الموظف...</option>' +
      state.team.filter(u => u.role === 'user').map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.full_name || u.email)}</option>`).join('');
    assigneeSelect.value = t.assigned_to || '';
  }

  document.getElementById('edit-task-project-wrap')?.classList.toggle('hidden', !t.project_id);
  openModalById('edit-task-modal');
}

/* ============================================================
   FILE Handlers
   ============================================================ */
async function handleDownloadFile(id) {
  const state = getState();
  const file = state.files.find(f => f.id === id);
  if (!file) return;

  try {
    const url = await getSignedUrl(file.file_path);

    document.getElementById('pdf-viewer-title').textContent = file.file_name;
    document.getElementById('pdf-viewer-meta').textContent =
      `${file.task_id ? 'ملف مهمة' : 'مستند مشروع'} • ${formatFileSize(file.file_size)} • PDF`;

    const external = document.getElementById('pdf-viewer-external');
    if (external) external.href = url;

    const frame = document.getElementById('pdf-viewer-frame');
    const loading = document.getElementById('pdf-viewer-loading');
    if (loading) loading.classList.remove('hidden');
    if (frame) {
      frame.onload = () => loading?.classList.add('hidden');
      frame.src = url;
    }

    document.getElementById('pdf-viewer-modal')?.classList.add('open');
    document.body.classList.add('modal-open');
  } catch (err) {
    toast('تعذر فتح الملف: ' + err.message, 'error');
  }
}

async function handleDeleteFile(id) {
  if (!isAdmin()) return;
  const state = getState();
  const file = state.files.find(f => f.id === id);
  if (!file) return;

  const ok = await confirmDialog({
    title: 'حذف الملف',
    message: `سيتم حذف «${file.file_name}» نهائياً.`,
    confirmText: 'حذف',
  });
  if (!ok) return;

  try {
    const { deleteFileFromStorage } = await import('../api/files.js');
    await deleteFileFromStorage(file.file_path);
    await deleteFile(id);
    toast('تم حذف الملف.', 'success');
    await loadFilesData();
  } catch (err) {
    toast('تعذر الحذف: ' + err.message, 'error');
  }
}

async function handleUploadFile(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const file = document.getElementById('resource-file-input')?.files?.[0];
  const projectId = document.getElementById('file-target-project')?.value;
  const type = document.getElementById('file-target-type')?.value;
  const taskId = type === 'task' ? document.getElementById('file-target-task')?.value : null;

  if (!file) return toast('اختر ملف PDF.', 'error');
  if (!projectId) return toast('اختر المشروع.', 'error');
  if (type === 'task' && !taskId) return toast('اختر المهمة.', 'error');

  const state = getState();
  const displayName = document.getElementById('file-display-name')?.value.trim() || file.name;

  setLoading(btn, true, 'جاري الرفع...');
  try {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = taskId
      ? `projects/${projectId}/tasks/${taskId}/${crypto.randomUUID()}-${safe}`
      : `projects/${projectId}/documentation/${crypto.randomUUID()}-${safe}`;

    await uploadPdf(file, path);
    await saveFileMeta({
      projectId,
      taskId,
      fileName: displayName,
      filePath: path,
      fileSize: file.size,
      userId: state.user.id,
    });

    await logActivity({
      projectId,
      taskId,
      action: 'file_uploaded',
      description: `تم رفع الملف: ${displayName}`,
    });

    toast('تم رفع الملف.', 'success');
    e.target.reset();
    document.getElementById('file-upload-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadFilesData();
  } catch (err) {
    toast('تعذر الرفع: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleUpdateFile(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const id = document.getElementById('edit-file-id')?.value;
  const name = document.getElementById('edit-file-name')?.value.trim();
  if (!id || !name) return;

  setLoading(btn, true, 'جاري الحفظ...');
  try {
    await updateFileName(id, name);
    toast('تم تحديث الملف.', 'success');
    document.getElementById('edit-file-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadFilesData();
  } catch (err) {
    toast('تعذر التحديث: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function openEditFileModal(id) {
  if (!isAdmin()) return;
  const state = getState();
  const f = state.files.find(x => x.id === id);
  if (!f) return;
  document.getElementById('edit-file-id').value = f.id;
  document.getElementById('edit-file-name').value = f.file_name || '';
  openModalById('edit-file-modal');
}

function openFileUploadForProject(projectId) {
  if (!isAdmin()) return;
  document.getElementById('file-target-type').value = 'project';
  populateFileUploadTargets();
  document.getElementById('file-target-project').value = projectId;
  document.getElementById('file-target-task-wrap')?.classList.add('hidden');
  openModalById('file-upload-modal');
}

function openFileUploadForTask(taskId) {
  if (!isAdmin()) return;
  const state = getState();
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  document.getElementById('file-target-type').value = 'task';
  populateFileUploadTargets();
  document.getElementById('file-target-project').value = t.project_id || '';
  document.getElementById('file-target-task-wrap')?.classList.remove('hidden');
  populateTaskFileTargets();
  document.getElementById('file-target-task').value = taskId;
  openModalById('file-upload-modal');
}

/* ============================================================
   RESOURCE Handlers
   ============================================================ */
async function handleCreateOrUpdateResource(e) {
  e.preventDefault();
  if (!isAdmin()) return;

  const btn = e.submitter;
  const editId = e.target.dataset.editId;
  const projectId = document.getElementById('resource-project')?.value;
  const type = document.getElementById('resource-type')?.value || 'note';
  const title = document.getElementById('resource-title')?.value.trim();
  const content = document.getElementById('resource-content')?.value.trim();

  if (!projectId || !title || !content) return toast('أكمل البيانات.', 'error');

  const state = getState();
  const payload = { project_id: projectId, type, title, content };

  setLoading(btn, true, 'جاري الحفظ...');
  try {
    if (editId) {
      await updateResource(editId, payload);
      toast('تم تحديث المورد.', 'success');
      delete e.target.dataset.editId;
      const modalTitle = document.querySelector('#resource-modal .modal-title');
      if (modalTitle) modalTitle.textContent = 'إضافة مورد';
    } else {
      await createResource({ ...payload, created_by: state.user?.id });
      toast('تم حفظ المورد.', 'success');
    }
    e.target.reset();
    document.getElementById('resource-modal')?.classList.remove('open');
    document.body.classList.remove('modal-open');
    await loadResourcesData();
  } catch (err) {
    toast('تعذر الحفظ: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleDeleteResource(id) {
  if (!isAdmin()) return;
  const ok = await confirmDialog({ title: 'حذف المورد', message: 'سيتم حذف المورد نهائياً.', confirmText: 'حذف' });
  if (!ok) return;
  try {
    await deleteResource(id);
    toast('تم حذف المورد.', 'success');
    await loadResourcesData();
  } catch (err) {
    toast('تعذر الحذف: ' + err.message, 'error');
  }
}

async function openEditResourceModal(id) {
  if (!isAdmin()) return;
  const state = getState();
  const r = state.resources.find(x => x.id === id);
  if (!r) return;

  document.getElementById('resource-project').value = r.project_id || '';
  document.getElementById('resource-type').value = r.type || 'note';
  document.getElementById('resource-title').value = r.title || '';
  document.getElementById('resource-content').value = r.content || '';
  document.getElementById('resource-form').dataset.editId = id;

  const modalTitle = document.querySelector('#resource-modal .modal-title');
  if (modalTitle) modalTitle.textContent = 'تعديل المورد';

  openModalById('resource-modal');
}

/* ============================================================
   PROJECT DETAILS
   ============================================================ */
async function openProjectDetails(id) {
  const state = getState();
  const p = state.projects.find(x => x.id === id);
  if (!p) return;

  const tasks = state.tasks.filter(t => t.project_id === id);
  const members = state.projectMembers.filter(m => m.project_id === id);
  const files = state.files.filter(f => f.project_id === id);
  const activities = state.activities
    .filter(a => a.project_id === id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const done = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;
  const progress = averageProgress(tasks);

  setText('detail-project-title', p.title);
  setText('detail-project-subtitle', `أنشئ في ${formatDate(p.created_at)} • آخر تحديث ${formatDate(p.updated_at || p.created_at)}`);
  setText('detail-project-status', projectStatusLabel(p.status));
  setClass('detail-project-status', `badge ${projectStatusClass(p.status)}`);
  setText('detail-project-priority', `أولوية ${priorityLabel(p.priority)}`);
  setClass('detail-project-priority', `badge ${priorityClass(p.priority)}`);
  setText('detail-project-description', p.description || 'لا يوجد وصف أو مواصفات إضافية لهذا المشروع.');
  setText('detail-project-dates', `${p.start_date ? formatDate(p.start_date) : 'بدون بداية'} → ${p.due_date ? formatDate(p.due_date) : 'بدون موعد تسليم'}`);
  setText('detail-project-progress-label', `${progress}%`);
  setStyle('detail-project-progress', 'width', `${progress}%`);
  setText('overview-progress-label', `${progress}%`);
  setStyle('overview-progress', 'width', `${progress}%`);

  setText('detail-task-count-tab', tasks.length);
  setText('detail-file-count-tab', files.length);
  setText('detail-member-count-tab', members.length);
  setText('detail-activity-count-tab', activities.length);
  setText('detail-file-count', files.length);
  setText('detail-member-count', members.length);
  setText('detail-activity-count', activities.length);

  // Metrics
  const metrics = [
    ['fa-list-check', 'المهام', tasks.length, 'text-indigo-300'],
    ['fa-circle-check', 'مكتملة', done, 'text-emerald-400'],
    ['fa-spinner', 'قيد العمل', inProgress, 'text-cyan-400'],
    ['fa-users', 'الأعضاء', members.length, 'text-violet-400'],
    ['fa-file-pdf', 'الملفات', files.length, 'text-rose-400'],
    ['fa-triangle-exclamation', 'متأخرة', overdue, overdue ? 'text-rose-400' : 'text-slate-400'],
  ];
  setHtml('project-detail-metrics', metrics.map(([icon, label, value, color]) => `
    <div class="metric-box">
      <div class="flex items-center gap-2">
        <i class="fa-solid ${icon} ${color}"></i>
        <span class="text-[10px] text-slate-500">${label}</span>
      </div>
      <b class="block text-lg text-white mt-1">${value}</b>
    </div>
  `).join(''));

  // Tasks
  setHtml('detail-project-tasks', tasks.length ? tasks.map(t => `
    <div class="detail-task-row" data-open-task="${escapeHtml(t.id)}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h4 class="text-xs font-bold text-white truncate">${escapeHtml(t.title)}</h4>
          <p class="text-[10px] text-slate-500 mt-1">${escapeHtml(memberName(t.assigned_to))}${t.due_date ? ' • ' + formatDate(t.due_date) : ''}</p>
        </div>
        <span class="badge ${statusClass(t.status)}">${statusLabel(t.status)}</span>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <div class="progress-track flex-1"><div class="progress-fill" style="width:${Number(t.progress || 0)}%"></div></div>
        <b class="text-[10px] text-indigo-400">${Number(t.progress || 0)}%</b>
      </div>
    </div>
  `).join('') : emptyState('fa-list-check', 'لا توجد مهام داخل المشروع'));

  // Files
  setHtml('detail-project-files', files.length
    ? files.map(f => fileCardHtml(f)).join('')
    : emptyState('fa-file-circle-xmark', 'لا توجد ملفات للمشروع'));

  // Members
  setHtml('detail-project-members', members.length ? members.map(m => {
    const u = state.team.find(x => x.id === m.user_id);
    const mt = tasks.filter(t => t.assigned_to === m.user_id);
    const md = mt.filter(t => t.status === 'completed').length;
    return `
      <div class="member-mini">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-xs">
            ${escapeHtml((u?.full_name || u?.email || 'م').charAt(0))}
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="text-[11px] font-bold text-white truncate">${escapeHtml(u?.full_name || 'عضو غير معروف')}</h4>
            <p class="text-[10px] text-slate-500 truncate">${escapeHtml(u?.email || '')}</p>
          </div>
          <b class="text-[10px] text-indigo-400">${averageProgress(mt)}%</b>
        </div>
        <div class="grid grid-cols-3 gap-1.5 mt-3">
          <span class="text-center rounded-lg bg-slate-950/50 p-1.5 text-[9px] text-slate-400">${mt.length}<small class="block text-[8px] text-slate-600">مهام</small></span>
          <span class="text-center rounded-lg bg-slate-950/50 p-1.5 text-[9px] text-cyan-400">${mt.filter(t => t.status === 'in_progress').length}<small class="block text-[8px] text-slate-600">عمل</small></span>
          <span class="text-center rounded-lg bg-slate-950/50 p-1.5 text-[9px] text-emerald-400">${md}<small class="block text-[8px] text-slate-600">مكتمل</small></span>
        </div>
      </div>
    `;
  }).join('') : emptyState('fa-users', 'لم تتم إضافة أعضاء للمشروع'));

  // Activity
  setHtml('detail-project-activity', activities.length
    ? activities.slice(0, 100).map(a => timelineItem(a)).join('')
    : emptyState('fa-clock-rotate-left', 'لا يوجد نشاط مسجل بعد'));

  setText('detail-comment-avatar', (state.profile?.full_name || 'م').charAt(0));
  const commentInput = document.getElementById('detail-comment-input');
  if (commentInput) commentInput.value = '';
  const submitBtn = document.getElementById('detail-comment-submit');
  if (submitBtn) submitBtn.dataset.projectId = id;

  // Summary
  setHtml('detail-project-summary', `
    <div class="flex justify-between p-3 rounded-xl bg-slate-900/55 border border-slate-800">
      <span class="text-[10px] text-slate-500">متوسط تقدم المهام</span>
      <b class="text-[11px] text-indigo-400">${progress}%</b>
    </div>
    <div class="flex justify-between p-3 rounded-xl bg-slate-900/55 border border-slate-800">
      <span class="text-[10px] text-slate-500">نسبة إتمام المهام</span>
      <b class="text-[11px] text-emerald-400">${tasks.length ? Math.round(done / tasks.length * 100) : 0}%</b>
    </div>
    <div class="flex justify-between p-3 rounded-xl bg-slate-900/55 border border-slate-800">
      <span class="text-[10px] text-slate-500">المهام المتأخرة</span>
      <b class="text-[11px] ${overdue ? 'text-rose-400' : 'text-slate-400'}">${overdue}</b>
    </div>
  `);

  // Admin actions
  const admin = isAdmin();
  const adminActions = document.getElementById('detail-project-admin-actions');
  if (adminActions) {
    adminActions.innerHTML = admin
      ? `<button class="btn btn-secondary btn-sm" data-edit-project="${escapeHtml(id)}">
           <i class="fa-solid fa-pen"></i> تعديل
         </button>
         <button class="btn btn-primary btn-sm" data-project-upload="${escapeHtml(id)}">
           <i class="fa-solid fa-cloud-arrow-up"></i> رفع ملف
         </button>`
      : '';
    adminActions.classList.toggle('hidden', !admin);
  }

  switchProjectTab('overview');
  openModalById('project-details-modal');
}

/* ============================================================
   TASK DETAILS
   ============================================================ */
async function openTaskDetails(id) {
  const state = getState();
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;

  document.getElementById('project-details-modal')?.classList.remove('open');

  const files = state.files.filter(f => f.task_id === id);
  const activities = state.activities.filter(a => a.task_id === id);

  setText('detail-task-title', t.title);
  setText('detail-task-project', t.project_id
    ? state.projects.find(p => p.id === t.project_id)?.title || 'مشروع غير معروف'
    : 'مهمة عامة بدون مشروع');
  setText('detail-task-status', statusLabel(t.status));
  setClass('detail-task-status', `badge ${statusClass(t.status)}`);
  setText('detail-task-priority', `أولوية ${priorityLabel(t.priority)}`);
  setClass('detail-task-priority', `badge ${priorityClass(t.priority)}`);
  setText('detail-task-description', t.description || 'لا توجد تفاصيل إضافية.');

  const progress = Number(t.progress || 0);
  setText('detail-task-progress-label', `${progress}%`);
  setStyle('detail-task-progress', 'width', `${progress}%`);

  setHtml('detail-task-meta', [
    ['المسؤول', memberName(t.assigned_to)],
    ['تاريخ التسليم', formatDate(t.due_date)],
    ['أنشأها', memberName(t.created_by)],
    ['آخر تحديث', formatDate(t.updated_at || t.created_at, true)],
  ].map(([label, value]) => `
    <div class="metric-box">
      <span class="block text-[9px] text-slate-600">${label}</span>
      <b class="block text-[11px] text-slate-200 mt-1 truncate">${escapeHtml(value)}</b>
    </div>
  `).join(''));

  setHtml('detail-task-files', files.length
    ? files.map(f => fileCardHtml(f)).join('')
    : emptyState('fa-file-circle-xmark', 'لا توجد ملفات'));

  const admin = isAdmin();
  const adminActions = document.getElementById('detail-task-admin-actions');
  if (adminActions) {
    adminActions.innerHTML = admin
      ? `<button class="btn btn-secondary btn-sm" data-edit-task="${escapeHtml(id)}">
           <i class="fa-solid fa-pen"></i> تعديل
         </button>
         <button class="btn btn-primary btn-sm" data-task-upload="${escapeHtml(id)}">
           <i class="fa-solid fa-cloud-arrow-up"></i> رفع ملف
         </button>`
      : '';
    adminActions.classList.toggle('hidden', !admin);
  }

  setHtml('detail-task-activity', activities.length
    ? activities.map(a => timelineItem(a)).join('')
    : emptyState('fa-clock-rotate-left', 'لا يوجد نشاط'));

  const commentInput = document.getElementById('detail-task-comment-input');
  if (commentInput) commentInput.value = '';
  const submitBtn = document.getElementById('detail-task-comment-submit');
  if (submitBtn) submitBtn.dataset.taskId = id;

  const canChange = admin || t.assigned_to === state.user?.id;
  const next = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'completed' : 'todo';
  const nextLabel = next === 'in_progress' ? 'بدء العمل' : next === 'completed' ? 'إتمام' : 'إرجاع للانتظار';

  setHtml('detail-task-actions', canChange ? `
    <button class="btn btn-primary btn-block" data-status-task="${escapeHtml(t.id)}" data-status="${next}">
      ${nextLabel}
    </button>
  ` : '<p class="text-xs text-slate-500">لا توجد إجراءات متاحة لهذا الحساب.</p>');

  openModalById('task-details-modal');
}

/* ============================================================
   COMMENTS
   ============================================================ */
async function handleProjectComment(projectId) {
  const input = document.getElementById('detail-comment-input');
  const text = input?.value.trim();
  if (!text) return toast('اكتب التعليق أولاً.', 'error');

  try {
    await logActivity({ projectId, action: 'comment', description: text });
    input.value = '';
    toast('تمت إضافة التعليق.', 'success');
    await loadActivitiesData();
    openProjectDetails(projectId);
  } catch (err) {
    toast('تعذر الإضافة: ' + err.message, 'error');
  }
}

async function handleTaskComment(taskId) {
  const input = document.getElementById('detail-task-comment-input');
  const text = input?.value.trim();
  if (!text) return toast('اكتب التحديث أولاً.', 'error');

  const state = getState();
  const task = state.tasks.find(t => t.id === taskId);

  try {
    await logActivity({
      projectId: task?.project_id || null,
      taskId,
      action: 'comment',
      description: text,
    });
    input.value = '';
    toast('تمت إضافة التحديث.', 'success');
    await loadActivitiesData();
    openTaskDetails(taskId);
  } catch (err) {
    toast('تعذر الإضافة: ' + err.message, 'error');
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function switchProjectTab(tab) {
  document.querySelectorAll('[data-project-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.projectTab === tab);
  });
  document.querySelectorAll('[data-project-panel]').forEach(p => {
    p.classList.toggle('active', p.dataset.projectPanel === tab);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value ?? '';
}

function setClass(id, value) {
  const el = document.getElementById(id);
  if (el) el.className = value;
}

function setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}

function setLoading(btn, loading, text = 'جاري التنفيذ...') {
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

function fileCardHtml(f) {
  const state = getState();
  const admin = isAdmin();
  const source = f.task_id
    ? `مهمة: ${escapeHtml(state.tasks.find(x => x.id === f.task_id)?.title || 'غير معروفة')}`
    : `مشروع: ${escapeHtml(state.projects.find(p => p.id === f.project_id)?.title || 'غير معروف')}`;

  return `
    <article class="detail-project-file file-managed-card">
      <div class="flex items-start gap-3">
        <div class="pdf-icon"><i class="fa-regular fa-file-pdf"></i></div>
        <div class="min-w-0 flex-1">
          <h4 class="text-[11px] font-bold text-white break-words">${escapeHtml(f.file_name)}</h4>
          <p class="text-[9px] text-cyan-300/80 mt-1">${source}</p>
          <p class="text-[9px] text-slate-500 mt-1">${formatFileSize(f.file_size)} • ${formatDate(f.created_at, true)}</p>
        </div>
      </div>
      <div class="file-card-actions">
        <button class="file-card-btn" data-download-file="${escapeHtml(f.id)}">
          <i class="fa-solid fa-eye"></i><span>معاينة</span>
        </button>
        ${admin ? `
          <button class="file-card-btn" data-edit-file="${escapeHtml(f.id)}">
            <i class="fa-solid fa-pen"></i><span>تعديل</span>
          </button>
          <button class="file-card-btn danger" data-delete-file="${escapeHtml(f.id)}">
            <i class="fa-solid fa-trash"></i><span>حذف</span>
          </button>
        ` : ''}
      </div>
    </article>
  `;
}

function timelineItem(a) {
  return `
    <div class="timeline-item">
      <span class="timeline-dot"></span>
      <div class="rounded-2xl bg-slate-900/50 border border-slate-800 p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <i class="fa-solid ${activityIcon(a.action)} text-indigo-400 text-[10px]"></i>
            <span class="text-[10px] font-bold text-white truncate">${escapeHtml(activityUserName(a.user_id))}</span>
            <span class="badge badge-slate">${escapeHtml(activityLabel(a.action))}</span>
          </div>
          <time class="text-[9px] text-slate-600 whitespace-nowrap">${formatDate(a.created_at, true)}</time>
        </div>
        <p class="text-[10px] text-slate-400 leading-6 mt-2 whitespace-pre-wrap">${escapeHtml(a.description || '')}</p>
      </div>
    </div>
  `;
}
