import { createSlice } from '@reduxjs/toolkit';

import { STORAGE_KEYS, storage } from '../../lib/utils/storage.util.js';

const initialState = {
  workspaces: [],
  activeWorkspaceId: storage.get(STORAGE_KEYS.ACTIVE_WORKSPACE, null, { parse: false }),
  pendingInvitations: [],
  isLoading: false,
  error: null,
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    workspacesLoaded(state, action) {
      state.workspaces = action.payload;
      state.isLoading = false;
      state.error = null;

      if (!action.payload.some((workspace) => workspace.id === state.activeWorkspaceId)) {
        const fallback = action.payload[0]?.id ?? null;
        state.activeWorkspaceId = fallback;
        if (fallback) {
          storage.set(STORAGE_KEYS.ACTIVE_WORKSPACE, fallback, { stringify: false });
        } else {
          storage.remove(STORAGE_KEYS.ACTIVE_WORKSPACE);
        }
      }
    },
    workspaceAdded(state, action) {
      state.workspaces = [...state.workspaces, action.payload];
    },
    workspaceUpdated(state, action) {
      state.workspaces = state.workspaces.map((workspace) =>
        workspace.id === action.payload.id ? { ...workspace, ...action.payload } : workspace,
      );
    },
    workspaceRemoved(state, action) {
      state.workspaces = state.workspaces.filter((w) => w.id !== action.payload);
      if (state.activeWorkspaceId === action.payload) {
        const fallback = state.workspaces[0]?.id ?? null;
        state.activeWorkspaceId = fallback;
        if (fallback) {
          storage.set(STORAGE_KEYS.ACTIVE_WORKSPACE, fallback, { stringify: false });
        } else {
          storage.remove(STORAGE_KEYS.ACTIVE_WORKSPACE);
        }
      }
    },
    setActiveWorkspace(state, action) {
      state.activeWorkspaceId = action.payload;
      if (action.payload) {
        storage.set(STORAGE_KEYS.ACTIVE_WORKSPACE, action.payload, { stringify: false });
      } else {
        storage.remove(STORAGE_KEYS.ACTIVE_WORKSPACE);
      }
    },
    pendingInvitationsLoaded(state, action) {
      state.pendingInvitations = action.payload;
    },
    loading(state) {
      state.isLoading = true;
      state.error = null;
    },
    error(state, action) {
      state.isLoading = false;
      state.error = action.payload;
    },
  },
});

export const workspaceActions = workspaceSlice.actions;
export const workspaceReducer = workspaceSlice.reducer;

export const selectWorkspaces = (state) => state.workspace.workspaces;
export const selectActiveWorkspaceId = (state) => state.workspace.activeWorkspaceId;
export const selectPendingInvitations = (state) => state.workspace.pendingInvitations;
export const selectWorkspaceLoading = (state) => state.workspace.isLoading;

export default workspaceSlice.reducer;