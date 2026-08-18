// lib/offline/workspace.ts

import { localDb } from './indexeddb';

const WORKSPACE_STORE = 'workspace_context';
const ACTIVE_WORKSPACE_KEY = 'active_workspace';

export interface WorkspaceContextData {
  id: string; // key: 'active_workspace'
  activeWorkspaceId: string;
  workspaceName: string;
  blueprintId: string;
  blueprintName: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  membership: {
    role: string; // OWNER | ADMIN | STAFF
  };
  permissions: string[];
  lastUpdated: string;
}

/**
 * Menyimpan metadata workspace dan sesi pengguna saat ini ke IndexedDB lokal.
 */
export async function saveWorkspaceContext(data: Omit<WorkspaceContextData, 'id'>): Promise<void> {
  await localDb.put<WorkspaceContextData>(WORKSPACE_STORE, {
    id: ACTIVE_WORKSPACE_KEY,
    ...data,
  });
}

/**
 * Mendapatkan metadata workspace dan sesi pengguna yang aktif dari IndexedDB lokal.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContextData | null> {
  try {
    return await localDb.get<WorkspaceContextData>(WORKSPACE_STORE, ACTIVE_WORKSPACE_KEY);
  } catch (error) {
    console.error('Failed to get workspace context from IndexedDB:', error);
    return null;
  }
}

/**
 * Menghapus workspace context ketika user log out.
 */
export async function clearWorkspaceContext(): Promise<void> {
  try {
    await localDb.delete(WORKSPACE_STORE, ACTIVE_WORKSPACE_KEY);
  } catch (error) {
    console.error('Failed to clear workspace context:', error);
  }
}
