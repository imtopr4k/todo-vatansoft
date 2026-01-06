const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  // DEBUG: log outgoing API calls for easier tracing
  try {
    const bodyPreview = (opts.body && typeof opts.body === 'string') ? opts.body : undefined;
  } catch (e) {
  }

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text;
    try {
      const json = JSON.parse(text);
      errorMsg = json.message || json.error || text;
    } catch (e) {
      // text is not JSON, use as-is
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

// Helper method for GET requests
api.get = async function<T>(path: string, opts?: RequestInit): Promise<T> {
  return api<T>(path, { ...opts, method: 'GET' });
};

// Business Setup API functions
export const businessSetupAPI = {
  getAll: () => api<any[]>('/business-setup', { method: 'GET' }),
  create: (data: { memberId: string; status: string; description: string }) =>
    api<any>('/business-setup', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { memberId?: string; status?: string; description?: string }) =>
    api<any>(`/business-setup/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    api<{ message: string }>(`/business-setup/${id}`, { method: 'DELETE' }),
};
