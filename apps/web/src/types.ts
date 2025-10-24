export type Role = 'agent' | 'supervisor';
export interface Me { id: string; name: string; role: Role; }
export interface Ticket {
    id: string;
    status: 'open' | 'resolved' | 'unreachable';
    telegram: {
        chatId: number;
        messageId: number;
        text?: string;
        from: { id?: number; username?: string; firstName?: string; lastName?: string; displayName: string }
    };
    assignedTo: string;
    assignedAt: string;
    resolutionText?: string;
}
