// apps/web/src/tumbu-api.ts - Adapter to real backend tumbu-runtime

function normalizeApiBase(raw: string): string {
  const base = raw.replace(/\/$/, '');
  if (base === '/api' || base.endsWith('/api')) return base;
  if (base.startsWith('/')) return `${base}/api`;
  return `${base}/api`;
}

const resolveApiUrl = (envUrl: string): string => {
  if (typeof window !== 'undefined') {
    if (!window.location.hostname.includes('localhost') && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return '/api';
    }
  }
  return normalizeApiBase(envUrl);
};

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL || '/api');

export async function tumbuFetch(path: string, token?: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = typeof err?.message === 'string' ? err.message : 'API Error';
    throw new Error(message);
  }
  return res.json();
}

// Auth - matches apps/api/src/auth/auth.controller.ts
export const authApi = {
  login: (email: string, password: string) =>
    tumbuFetch('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    tumbuFetch('/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  me: (token: string) => tumbuFetch('/auth/me', token),
  logout: (token: string) => tumbuFetch('/auth/logout', token, { method: 'POST' }),
};

// Platform / workspace - matches PlatformController
export const platformApi = {
  catalogBlueprints: (token: string) => tumbuFetch('/platform/catalog/blueprints', token),
  createMyWorkspace: (token: string, body: object) =>
    tumbuFetch('/platform/my/workspaces', token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  activateWorkspace: (token: string, id: string) =>
    tumbuFetch('/platform/workspaces/activate', token, {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  context: (token: string) => tumbuFetch('/platform/workspace/context', token),
  onboarding: (token: string) => tumbuFetch('/platform/onboarding', token),
  updateOnboarding: (token: string, body: object) =>
    tumbuFetch('/platform/onboarding', token, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  ownerWorkspaces: (token: string) => tumbuFetch('/platform/owner/workspaces', token),
  overview: (token: string) => tumbuFetch('/platform/overview', token),
  workspaces: (token: string) => tumbuFetch('/platform/workspaces', token),
  approveWorkspace: (token: string, workspaceId: string) =>
    tumbuFetch('/platform/workspaces/approve', token, { method: 'POST', body: JSON.stringify({ workspaceId }) }),
  rejectWorkspace: (token: string, workspaceId: string) =>
    tumbuFetch('/platform/workspaces/reject', token, { method: 'POST', body: JSON.stringify({ workspaceId }) }),
  listMembers: (token: string) => tumbuFetch('/platform/members', token),
  createMember: (token: string, body: object) =>
    tumbuFetch('/platform/members', token, { method: 'POST', body: JSON.stringify(body) }),
};

// ERP - live read/write adapter
export const erpApi = {
  products: (token: string) => tumbuFetch('/erp/products', token),
  createProduct: (token: string, body: object) =>
    tumbuFetch('/erp/products', token, { method: 'POST', body: JSON.stringify(body) }),
  transactions: (token: string, type?: 'SALE' | 'PURCHASE') =>
    tumbuFetch(`/erp/transactions${type ? `?type=${type}` : ''}`, token),
  createTransaction: (token: string, body: object) =>
    tumbuFetch('/erp/transactions', token, { method: 'POST', body: JSON.stringify(body) }),
  partners: (token: string, type?: 'CUSTOMER' | 'SUPPLIER') =>
    tumbuFetch(`/erp/partners${type ? `?type=${type}` : ''}`, token),
  createPartner: (token: string, body: object) =>
    tumbuFetch('/erp/partners', token, { method: 'POST', body: JSON.stringify(body) }),
  cash: (token: string) => tumbuFetch('/erp/cash', token),
  createCash: (token: string, body: object) =>
    tumbuFetch('/erp/cash', token, { method: 'POST', body: JSON.stringify(body) }),
  suratJalan: (token: string) => tumbuFetch('/erp/surat-jalan', token),
  createSuratJalan: (token: string, body: object) =>
    tumbuFetch('/erp/surat-jalan', token, { method: 'POST', body: JSON.stringify(body) }),
  beritaAcara: (token: string) => tumbuFetch('/erp/berita-acara', token),
  createBeritaAcara: (token: string, body: object) =>
    tumbuFetch('/erp/berita-acara', token, { method: 'POST', body: JSON.stringify(body) }),
};

// Budidaya - matches BudidayaCycleController
export const cycleApi = {
  list: (token: string, q: { state?: string; pondId?: string } = {}) => {
    const qs = new URLSearchParams(q as Record<string, string>).toString();
    return tumbuFetch(`/budidaya/cycles${qs ? `?${qs}` : ''}`, token);
  },
  get: (token: string, id: string) => tumbuFetch(`/budidaya/cycles/${id}`, token),
  create: (token: string, body: object) =>
    tumbuFetch('/budidaya/cycles', token, { method: 'POST', body: JSON.stringify(body) }),
  markReady: (token: string, id: string) =>
    tumbuFetch(`/budidaya/cycles/${id}/ready`, token, { method: 'POST' }),
  cancel: (token: string, id: string) =>
    tumbuFetch(`/budidaya/cycles/${id}/cancel`, token, { method: 'POST' }),
};

export const serviceApi = {
  listMembers: (token: string) => tumbuFetch('/service/members', token),
  inviteMember: (token: string, body: object) =>
    tumbuFetch('/service/members', token, { method: 'POST', body: JSON.stringify(body) }),
};

// Sync - kept as existing contract until Sync V1 is audited end-to-end.
export const syncApi = {
  push: (token: string, payload: any) =>
    tumbuFetch('/api/v1/sync/push', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  pull: (token: string, since: number = 0) =>
    tumbuFetch(`/api/v1/sync/pull?since=${since}`, token),
};
