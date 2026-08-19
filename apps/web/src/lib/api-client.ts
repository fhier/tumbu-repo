const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tumbu_token') : null;
    const activeWorkspace = typeof window !== 'undefined' ? localStorage.getItem('tumbu_active_workspace') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeWorkspace ? { 'x-workspace-id': activeWorkspace } : {}),
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { error: errBody.message || `Request failed with status ${res.status}` };
    }

    const data = await res.json();
    return { data };
  } catch (err: any) {
    return { error: err.message || 'Network error connecting to TUMBU API' };
  }
}