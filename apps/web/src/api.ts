const API = import.meta.env.VITE_API_BASE_URL || 'http://77.37.54.190:8990';

export async function api<T>(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: any = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
