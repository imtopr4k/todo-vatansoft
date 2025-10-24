import fetch from 'node-fetch';
import { env } from './env';

export async function createTicketAndAssign(payload: {
  chatId: number; messageId: number; text: string;
  from: { id: number; username?: string; firstName?: string; lastName?: string; displayName?: string }
}): Promise<{ ticketId: string; assignedAgentName: string }> {
  const res = await fetch(`${env.API_BASE_URL}/bot/intake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as any;
}

export async function markResolved(ticketId: string): Promise<void> {
  await fetch(`${env.API_BASE_URL}/bot/tickets/${ticketId}/resolved`, { method: 'POST' });
}

export async function markUnreachable(ticketId: string): Promise<void> {
  await fetch(`${env.API_BASE_URL}/bot/tickets/${ticketId}/unreachable`, { method: 'POST' });
}
