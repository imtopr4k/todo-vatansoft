const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export async function api<T>(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  // DEBUG: log outgoing API calls for easier tracing
  try {
    const bodyPreview = (opts.body && typeof opts.body === 'string') ? opts.body : undefined;
  } catch (e) {
  }

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
