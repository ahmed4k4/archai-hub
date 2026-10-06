/* ============================================================
   Projects API
   ============================================================ */
import { getClient } from '../supabase.js';
import { setState, getState, isAdmin, optimisticAdd, optimisticUpdate, optimisticDelete, setItemLoading, setItemError, clearItemError, registerMutation, completeMutation } from '../state.js';

export function getVisibleProjects() {
  const state = getState();
  if (isAdmin()) return state.projects;
  const memberProjectIds = new Set(
    state.projectMembers
      .filter(m => m.user_id === state.user?.id)
      .map(m => m.project_id)
  );
  state.tasks
    .filter(t => t.assigned_to === state.user?.id && t.project_id)
    .forEach(t => memberProjectIds.add(t.project_id));
  return state.projects.filter(p => memberProjectIds.has(p.id));
}

export async function createProject(payload) {
  const state = getState();
  if (!isAdmin()) {
    throw new Error('Unauthorized: Admin only');
  }
  
  const client = getClient();
  const { data, error } = await client
    .from('projects')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  
  // Optimistic add
  optimisticAdd('projects', data);
  
  // Also add creator as project member if not admin creating for themselves
  if (state.user?.id && payload.created_by === state.user.id) {
    const { error: memberError } = await client
      .from('project_members')
      .insert([{ project_id: data.id, user_id: state.user.id, role: 'owner' }]);
    if (memberError) console.warn('Failed to add creator as member:', memberError);
  }
  
  return data;
}

export async function updateProject(id, payload) {
  const state = getState();
  if (!isAdmin()) {
    // Check if user is a member of this project
    const isMember = state.projectMembers.some(m => m.project_id === id && m.user_id === state.user?.id);
    if (!isMember) throw new Error('Unauthorized: Not a member of this project');
  }
  
  // Optimistic update
  const previousProject = state.projects.find(p => p.id === id);
  optimisticUpdate('projects', id, payload);
  
  const controller = new AbortController();
  registerMutation('projects', id, controller);
  setItemLoading('projects', id, true);
  clearItemError('projects', id);
  
  try {
    const client = getClient();
    const { data, error } = await client
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    completeMutation('projects', id);
    setItemLoading('projects', id, false);
    return data;
  } catch (err) {
    // Rollback on error
    if (previousProject) {
      optimisticUpdate('projects', id, previousProject);
    }
    setItemLoading('projects', id, false);
    setItemError('projects', id, err);
    completeMutation('projects', id);
    throw err;
  }
}

export async function deleteProject(id) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  
  const previousProject = getState().projects.find(p => p.id === id);
  optimisticDelete('projects', id);
  
  const controller = new AbortController();
  registerMutation('projects', id, controller);
  setItemLoading('projects', id, true);
  clearItemError('projects', id);
  
  try {
    const client = getClient();
    const { error } = await client.from('projects').delete().eq('id', id);
    if (error) throw error;
    
    completeMutation('projects', id);
    setItemLoading('projects', id, false);
  } catch (err) {
    // Rollback on error
    if (previousProject) {
      optimisticAdd('projects', previousProject);
    }
    setItemLoading('projects', id, false);
    setItemError('projects', id, err);
    completeMutation('projects', id);
    throw err;
  }
}

export async function setProjectMembers(projectId, userIds) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  const client = getClient();
  const { data: current, error: fetchErr } = await client
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId);
  if (fetchErr) throw fetchErr;

  const currentIds = new Set((current || []).map(m => m.user_id));
  const nextIds = new Set(userIds);

  const toAdd = [...nextIds].filter(id => !currentIds.has(id));
  const toRemove = [...currentIds].filter(id => !nextIds.has(id));

  if (toRemove.length) {
    const { error } = await client
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .in('user_id', toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await client
      .from('project_members')
      .insert(toAdd.map(user_id => ({ project_id: projectId, user_id, role: 'member' })));
    if (error) throw error;
  }
}
