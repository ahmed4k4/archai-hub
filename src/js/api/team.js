/* ============================================================
   Team API
   ============================================================ */
import { getClient, callAdminUsers } from '../supabase.js';
import { setState, getState, isAdmin, optimisticAdd, optimisticUpdate, optimisticDelete, setItemLoading, setItemError, clearItemError, registerMutation, completeMutation } from '../state.js';

const VALID_ROLES = ['admin', 'user'];

export async function createTeamMember({ fullName, email, password, role }) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  
  // Validate role
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
  
  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Validate password
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  const result = await callAdminUsers({
    action: 'create',
    full_name: fullName,
    email,
    password,
    role,
  });
  
  // Optimistic add - the result should contain the new user
  if (result?.user) {
    optimisticAdd('team', result.user);
  }
  return result;
}

export async function updateTeamMember({ userId, fullName, email, password, role, active }) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  const state = getState();
  if (userId === state.user?.id) throw new Error('Cannot modify your own account');
  
  // Validate role
  if (role && !VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }
  
  // Validate email format
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Validate password if provided
  if (password && password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  const previousMember = state.team.find(u => u.id === userId);
  const updates = { full_name: fullName, email, role };
  if (active !== undefined) updates.active = active;
  optimisticUpdate('team', userId, updates);
  
  const controller = new AbortController();
  registerMutation('team', userId, controller);
  setItemLoading('team', userId, true);
  clearItemError('team', userId);
  
  try {
    const payload = { action: 'update', user_id: userId, full_name: fullName, email, role };
    if (password) payload.password = password;
    if (active !== undefined) payload.active = active;
    const result = await callAdminUsers(payload);
    
    completeMutation('team', userId);
    setItemLoading('team', userId, false);
    return result;
  } catch (err) {
    // Rollback on error
    if (previousMember) {
      optimisticUpdate('team', userId, previousMember);
    }
    setItemLoading('team', userId, false);
    setItemError('team', userId, err);
    completeMutation('team', userId);
    throw err;
  }
}

export async function deleteTeamMember(userId) {
  if (!isAdmin()) throw new Error('Unauthorized: Admin only');
  const state = getState();
  if (userId === state.user?.id) throw new Error('Cannot delete your own account');
  
  const previousMember = state.team.find(u => u.id === userId);
  optimisticDelete('team', userId);
  
  const controller = new AbortController();
  registerMutation('team', userId, controller);
  setItemLoading('team', userId, true);
  clearItemError('team', userId);
  
  try {
    const result = await callAdminUsers({ action: 'delete', user_id: userId });
    
    completeMutation('team', userId);
    setItemLoading('team', userId, false);
    return result;
  } catch (err) {
    // Rollback on error
    if (previousMember) {
      optimisticAdd('team', previousMember);
    }
    setItemLoading('team', userId, false);
    setItemError('team', userId, err);
    completeMutation('team', userId);
    throw err;
  }
}
