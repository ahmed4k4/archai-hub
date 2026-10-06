/* ============================================================
   Resources API
   ============================================================ */
import { getClient } from '../supabase.js';
import { setState, getState, isAdmin, optimisticAdd, optimisticUpdate, optimisticDelete, setItemLoading, setItemError, clearItemError, registerMutation, completeMutation } from '../state.js';

const VALID_RESOURCE_TYPES = ['link', 'note', 'file'];

function validateResourcePayload(payload, isUpdate = false) {
  if (!isUpdate) {
    if (!payload.title?.trim()) throw new Error('Resource title is required');
    if (!payload.type) throw new Error('Resource type is required');
    if (!payload.project_id) throw new Error('Project is required');
  }
  if (payload.type && !['link', 'note', 'file'].includes(payload.type)) {
    throw new Error(`Invalid type. Must be one of: ${['link', 'note', 'file'].join(', ')}`);
  }
  if (payload.type === 'link' && payload.content) {
    try {
      new URL(payload.content);
    } catch {
      throw new Error('Invalid URL format for link type');
    }
  }
  if (payload.project_id) {
    const state = getState();
    if (!isAdmin()) {
      const isMember = state.projectMembers.some(m => m.project_id === payload.project_id && m.user_id === state.user?.id);
      if (!isMember) throw new Error('Unauthorized: Not a member of this project');
    }
  }
}

export function getVisibleResources() {
  const state = getState();
  if (isAdmin()) return state.resources;
  return state.resources.filter(r => {
    if (r.target_user_id === state.user?.id) return true;
    if (r.target_user_id == null && r.project_id) {
      return state.projectMembers.some(m => m.project_id === r.project_id && m.user_id === state.user?.id);
    }
    return false;
  });
}

export async function createResource(payload) {
  const state = getState();
  if (!isAdmin()) {
    if (payload.project_id) {
      const isMember = state.projectMembers.some(m => m.project_id === payload.project_id && m.user_id === state.user?.id);
      if (!isMember) throw new Error('Unauthorized: Not a member of this project');
    }
  }
  
  // Validate payload
  validateResourcePayload(payload);
  
  const { data, error } = await getClient()
    .from('resources')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  
  // Optimistic add
  optimisticAdd('resources', data);
  return data;
}

export async function updateResource(id, payload) {
  const state = getState();
  const resource = state.resources.find(r => r.id === id);
  if (!resource) throw new Error('Resource not found');
  
  if (!isAdmin()) {
    if (resource.project_id) {
      const isMember = state.projectMembers.some(m => m.project_id === resource.project_id && m.user_id === state.user?.id);
      if (!isMember) throw new Error('Unauthorized: Not a member of this project');
    }
  }
  
  // Validate payload
  validateResourcePayload(payload, true);
  
  // Optimistic update
  const previousResource = state.resources.find(r => r.id === id);
  optimisticUpdate('resources', id, payload);
  
  const controller = new AbortController();
  registerMutation('resources', id, controller);
  setItemLoading('resources', id, true);
  clearItemError('resources', id);
  
  try {
    const { data, error } = await getClient()
      .from('resources')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    completeMutation('resources', id);
    setItemLoading('resources', id, false);
    return data;
  } catch (err) {
    // Rollback on error
    if (previousResource) {
      optimisticUpdate('resources', id, previousResource);
    }
    setItemLoading('resources', id, false);
    setItemError('resources', id, err);
    completeMutation('resources', id);
    throw err;
  }
}

export async function deleteResource(id) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  
  const previousResource = getState().resources.find(r => r.id === id);
  optimisticDelete('resources', id);
  
  const controller = new AbortController();
  registerMutation('resources', id, controller);
  setItemLoading('resources', id, true);
  clearItemError('resources', id);
  
  try {
    const { error } = await getClient().from('resources').delete().eq('id', id);
    if (error) throw error;
    
    completeMutation('resources', id);
    setItemLoading('resources', id, false);
  } catch (err) {
    // Rollback on error
    if (previousResource) {
      optimisticAdd('resources', previousResource);
    }
    setItemLoading('resources', id, false);
    setItemError('resources', id, err);
    completeMutation('resources', id);
    throw err;
  }
}
