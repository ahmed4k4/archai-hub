/* ============================================================
   Tasks API
   ============================================================ */
import { getClient } from '../supabase.js';
import { setState, getState, isAdmin, optimisticAdd, optimisticUpdate, optimisticDelete, setItemLoading, setItemError, clearItemError, registerMutation, completeMutation } from '../state.js';

const VALID_STATUSES = ['todo', 'in_progress', 'completed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export function getVisibleTasks() {
  const state = getState();
  if (isAdmin()) return state.tasks;
  return state.tasks.filter(t => t.assigned_to === state.user?.id);
}

function validateTaskPayload(payload, isUpdate = false) {
  if (!isUpdate) {
    if (!payload.title?.trim()) throw new Error('Task title is required');
    if (!payload.assigned_to) throw new Error('Assignee is required');
  }
  if (payload.status && !VALID_STATUSES.includes(payload.status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) {
    throw new Error(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  if (payload.progress !== undefined) {
    const progress = Number(payload.progress);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      throw new Error('Progress must be a number between 0 and 100');
    }
  }
}

export async function createTask(payload) {
  const state = getState();
  if (!isAdmin()) {
    // Check if user is a member of the project
    if (payload.project_id) {
      const isMember = state.projectMembers.some(m => m.project_id === payload.project_id && m.user_id === state.user?.id);
      if (!isMember) throw new Error('Unauthorized: Not a member of this project');
    }
  }
  
  // Validate payload
  validateTaskPayload(payload);
  
  const client = getClient();
  const { data, error } = await client
    .from('tasks')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  
  // Optimistic add
  optimisticAdd('tasks', data);
  return data;
}

export async function updateTask(id, payload) {
  const state = getState();
  const task = state.tasks.find(t => t.id === id);
  if (!task) throw new Error('Task not found');
  
  if (!isAdmin()) {
    // Users can only update their own tasks
    if (task.assigned_to !== state.user?.id) throw new Error('Unauthorized: Not assigned to this task');
    // Users can only update status and progress
    const allowedFields = ['status', 'progress'];
    const payloadKeys = Object.keys(payload);
    const hasDisallowedFields = payloadKeys.some(key => !allowedFields.includes(key));
    if (hasDisallowedFields) throw new Error('Unauthorized: Can only update status and progress');
  }
  
  // Validate payload
  validateTaskPayload(payload, true);
  
  // Optimistic update
  const previousTask = state.tasks.find(t => t.id === id);
  optimisticUpdate('tasks', id, payload);
  
  const controller = new AbortController();
  registerMutation('tasks', id, controller);
  setItemLoading('tasks', id, true);
  clearItemError('tasks', id);
  
  try {
    const client = getClient();
    const { data, error } = await client
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    completeMutation('tasks', id);
    setItemLoading('tasks', id, false);
    return data;
  } catch (err) {
    // Rollback on error
    if (previousTask) {
      optimisticUpdate('tasks', id, previousTask);
    }
    setItemLoading('tasks', id, false);
    setItemError('tasks', id, err);
    completeMutation('tasks', id);
    throw err;
  }
}

export async function updateTaskStatus(id, status) {
  const state = getState();
  const task = state.tasks.find(t => t.id === id);
  if (!task) throw new Error('Task not found');
  
  if (!isAdmin() && task.assigned_to !== state.user?.id) {
    throw new Error('Unauthorized: Not assigned to this task');
  }
  
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const progress = status === 'completed'
    ? 100
    : status === 'in_progress'
      ? Math.max(1, Number(task.progress || 0))
      : 0;

  return updateTask(id, { status, progress });
}

export async function deleteTask(id) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  
  const previousTask = getState().tasks.find(t => t.id === id);
  optimisticDelete('tasks', id);
  
  const controller = new AbortController();
  registerMutation('tasks', id, controller);
  setItemLoading('tasks', id, true);
  clearItemError('tasks', id);
  
  try {
    const client = getClient();
    const { error } = await client.from('tasks').delete().eq('id', id);
    if (error) throw error;
    
    completeMutation('tasks', id);
    setItemLoading('tasks', id, false);
  } catch (err) {
    // Rollback on error
    if (previousTask) {
      optimisticAdd('tasks', previousTask);
    }
    setItemLoading('tasks', id, false);
    setItemError('tasks', id, err);
    completeMutation('tasks', id);
    throw err;
  }
}
