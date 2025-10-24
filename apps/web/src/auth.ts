import { api } from './api';

export async function login(externalUserId: string, password: string) {
  const res = await api<{ accessToken:string; agent:{ id:string; name:string; role:'agent'|'supervisor' } }>(
    '/auth/login', { method: 'POST', body: JSON.stringify({ externalUserId, password }) }
  );
  localStorage.setItem('token', res.accessToken);
  localStorage.setItem('me', JSON.stringify(res.agent));
  return res.agent;
}

export function me() {
  const raw = localStorage.getItem('me');
  return raw ? JSON.parse(raw) as { id:string; name:string; role:'agent'|'supervisor'} : null;
}

export async function heartbeat() {
  const user = me();
  if (!user) return;
  try {
    await api('/auth/heartbeat', { method: 'POST', body: JSON.stringify({ agentId: user.id }) });
  } catch {}
}

// 60 saniyede bir aktiflik ping'i
setInterval(heartbeat, 60_000);

// ✅ Logout: API'ye bildir + localStorage temizle
export async function logout() {
  const user = me();
  try {
    if (user) await api('/auth/logout', { method: 'POST', body: JSON.stringify({ agentId: user.id }) });
  } catch {/* sessiz */}
  localStorage.removeItem('token');
  localStorage.removeItem('me');
  window.location.href = '/login';
}
