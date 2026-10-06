/* ============================================================
   Files API (Supabase Storage + DB)
   ============================================================ */
import { getClient } from '../supabase.js';
import { setState, getState, isAdmin, optimisticAdd, optimisticUpdate, optimisticDelete, setItemLoading, setItemError, clearItemError, registerMutation, completeMutation } from '../state.js';
import { STORAGE_BUCKET, MAX_FILE_SIZE } from '../config.js';

export function validatePdf(file) {
  if (!file) throw new Error('No file selected');
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are allowed');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must not exceed 20MB');
  }
}

export async function uploadPdf(file, path) {
  validatePdf(file);
  const { error } = await getClient()
    .storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: 'application/pdf' });
  if (error) throw error;
  return path;
}

export async function saveFileMeta({ projectId, taskId = null, fileName, filePath, fileSize, userId }) {
  const state = getState();
  if (!isAdmin()) {
    // Check if user is a member of the project
    if (projectId) {
      const isMember = state.projectMembers.some(m => m.project_id === projectId && m.user_id === state.user?.id);
      if (!isMember) throw new Error('Unauthorized: Not a member of this project');
    }
  }
  
  // Validate file size again before saving metadata
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error('File size must not exceed 20MB');
  }
  
  const { data, error } = await getClient()
    .from('files')
    .insert([{
      project_id: projectId,
      task_id: taskId,
      uploaded_by: userId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize,
      mime_type: 'application/pdf',
    }])
    .select()
    .single();
  if (error) throw error;
  
  // Optimistic add
  optimisticAdd('files', data);
  return data;
}

export async function getSignedUrl(filePath, expiresIn = 600) {
  const state = getState();
  if (!state.session?.access_token) {
    throw new Error('Invalid session. Please sign in again.');
  }
  
  // Check if user has access to this file
  const file = state.files.find(f => f.file_path === filePath);
  if (!file) {
    throw new Error('File not found');
  }
  
  // Authorization check
  if (!isAdmin()) {
    const hasAccess = file.uploaded_by === state.user?.id ||
      (file.project_id && state.projectMembers.some(m => m.project_id === file.project_id && m.user_id === state.user?.id)) ||
      (file.task_id && state.tasks.some(t => t.id === file.task_id && t.assigned_to === state.user?.id));
    if (!hasAccess) {
      throw new Error('Unauthorized: No access to this file');
    }
  }
  
  const { data, error } = await getClient()
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(id) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  
  const previousFile = getState().files.find(f => f.id === id);
  optimisticDelete('files', id);
  
  const controller = new AbortController();
  registerMutation('files', id, controller);
  setItemLoading('files', id, true);
  clearItemError('files', id);
  
  try {
    const client = getClient();
    const { error } = await client.from('files').delete().eq('id', id);
    if (error) throw error;
    
    // Also delete from storage
    if (previousFile?.file_path) {
      await deleteFileFromStorage(previousFile.file_path);
    }
    
    completeMutation('files', id);
    setItemLoading('files', id, false);
  } catch (err) {
    // Rollback on error
    if (previousFile) {
      optimisticAdd('files', previousFile);
    }
    setItemLoading('files', id, false);
    setItemError('files', id, err);
    completeMutation('files', id);
    throw err;
  }
}

export async function deleteFileFromStorage(filePath) {
  const { error } = await getClient()
    .storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);
  if (error) console.warn('Storage delete failed:', error);
}

export async function updateFileName(id, fileName) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  
  const state = getState();
  const previousFile = state.files.find(f => f.id === id);
  optimisticUpdate('files', id, { file_name: fileName });
  
  const controller = new AbortController();
  registerMutation('files', id, controller);
  setItemLoading('files', id, true);
  clearItemError('files', id);
  
  try {
    const { error } = await getClient()
      .from('files')
      .update({ file_name: fileName })
      .eq('id', id);
    if (error) throw error;
    
    completeMutation('files', id);
    setItemLoading('files', id, false);
  } catch (err) {
    // Rollback on error
    if (previousFile) {
      optimisticUpdate('files', id, previousFile);
    }
    setItemLoading('files', id, false);
    setItemError('files', id, err);
    completeMutation('files', id);
    throw err;
  }
}
