export type Role = 'agent' | 'supervisor';
export interface Me { id: string; name: string; role: Role; }
export interface Ticket {
    id: string;
    status: 'open' | 'resolved' | 'unreachable' | 'reported' | 'waiting';
    telegram: {
        chatId: number;
        messageId: number;
        userChatId?: number;
        text?: string;
        from: { id?: number; username?: string; firstName?: string; lastName?: string; displayName: string }
    };
    assignedTo: string;
    assignedAt: string;
    resolutionText?: string;
    interestedBy?: string;
    interestedAt?: string;
    updatedAt?: string;
    isUrgent?: boolean;
}

export interface BusinessSetup {
    id: string;
    memberId: string;
    status: string;
    description: string;
    createdBy?: {
        id: string;
        name: string;
        externalUserId: string;
    };
    updatedBy?: {
        id: string;
        name: string;
        externalUserId: string;
    };
    createdAt?: string;
    updatedAt?: string;
}
