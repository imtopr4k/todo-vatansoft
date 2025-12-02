export type Role = 'agent' | 'supervisor';

export interface AgentDTO {
  id: string;
  externalUserId: string;
  name: string;
  username?: string;
  telegramUserId?: number;
  email?: string;
  role: 'agent' | 'supervisor';
  isActive: boolean;
  lastActivityAt?: string;
}


export type TicketStatus = 'open' | 'resolved' | 'unreachable' | 'reported' | 'waiting';

export interface TicketDTO {
  id: string;
  source: 'telegram';
  telegram: { chatId: number; messageId: number };
  status: TicketStatus;
  assignedTo: string;
  assignedAt: string;
  resolutionText?: string;
}
