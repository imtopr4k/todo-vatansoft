"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Ticket_1 = require("../models/Ticket");
const ChatMessage_1 = require("../models/ChatMessage");
const DirectChat_1 = require("../models/DirectChat");
const auth_1 = require("../middlewares/auth");
const env_1 = require("../env");
const Agent_1 = require("../models/Agent");
const r = (0, express_1.Router)();
// Kullanıcı kayd etme (Telegram'dan /start ile)
r.post('/register-user', async (req, res) => {
    try {
        const { userId, chatId, firstName, lastName, username } = req.body;
        // Kullanıcının aktif bir ticket'ı varsa, chatId'sini güncelle
        const ticket = await Ticket_1.Ticket.findOne({ 'telegram.from.id': Number(userId) }).sort({ createdAt: -1 });
        if (ticket && !ticket.telegram.userChatId) {
            ticket.telegram.userChatId = chatId;
            await ticket.save();
        }
        return res.json({ success: true, message: 'User registered' });
    }
    catch (e) {
        console.error('[API] Error registering user:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Ticket'a mesaj gönder
r.post('/send-message', auth_1.requireAuth, async (req, res) => {
    try {
        const { ticketId, message } = req.body;
        const auth = req.auth;
        if (!ticketId || !message) {
            return res.status(400).json({ message: 'ticketId and message required' });
        }
        const ticket = await Ticket_1.Ticket.findById(ticketId).populate('assignedTo');
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        const userChatId = ticket.telegram.userChatId;
        if (!userChatId) {
            return res.status(400).json({ message: 'User has not started bot yet. Ask them to send /start to the bot.' });
        }
        // Agent bilgisini al
        const agent = await Agent_1.Agent.findById(auth.sub);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }
        // Mesajı veritabanına kaydet
        const chatMsg = new ChatMessage_1.ChatMessage({
            ticketId: ticket._id,
            fromType: 'agent',
            fromId: String(agent._id),
            fromName: agent.name,
            message,
            timestamp: new Date()
        });
        await chatMsg.save();
        // Telegram'a mesaj gönder (agent imzası ile)
        const botToken = env_1.env.BOT_TOKEN;
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const messageWithSignature = `${agent.name} (Destek Ekibi):\n\n${message}`;
        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: userChatId,
                text: messageWithSignature
            })
        });
        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Telegram send failed:', error);
            return res.status(500).json({ message: 'Failed to send message to Telegram' });
        }
        return res.json({ success: true, chatMsg });
    }
    catch (e) {
        console.error('[API] Error sending message:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Chat geçmişini al
r.get('/chat-history/:ticketId', auth_1.requireAuth, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const messages = await ChatMessage_1.ChatMessage.find({ ticketId })
            .sort({ timestamp: 1 })
            .limit(200)
            .lean();
        return res.json({ messages });
    }
    catch (e) {
        console.error('[API] Error fetching chat history:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Kullanıcıdan gelen mesajı kaydet (Bot'tan çağrılır)
r.post('/user-reply', async (req, res) => {
    try {
        const { userId, message, firstName, lastName, username, fromName } = req.body;
        // Kullanıcının en son ticket'ını bul
        const ticket = await Ticket_1.Ticket.findOne({ 'telegram.from.id': Number(userId) })
            .sort({ createdAt: -1 });
        if (!ticket) {
            return res.status(404).json({ message: 'No ticket found for this user' });
        }
        // Mesajı veritabanına kaydet
        const displayName = `${firstName || ''} ${lastName || ''}`.trim() || username || fromName || 'Kullanıcı';
        const chatMsg = new ChatMessage_1.ChatMessage({
            ticketId: ticket._id,
            fromType: 'user',
            fromId: String(userId),
            fromName: displayName,
            message,
            timestamp: new Date()
        });
        await chatMsg.save();
        return res.json({ success: true, chatMsg });
    }
    catch (e) {
        console.error('[API] Error saving user reply:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Chat kullanıcılarını listele (chatId'si olan tüm ticket'lar)
r.get('/users', auth_1.requireAuth, async (req, res) => {
    try {
        // userChatId'si olan tüm ticket'ları getir
        const tickets = await Ticket_1.Ticket.find({
            'telegram.userChatId': { $exists: true, $ne: null }
        })
            .populate('assignedTo')
            .sort({ updatedAt: -1 })
            .lean();
        console.log('[API /chat/users] Found', tickets.length, 'tickets with userChatId');
        // Her kullanıcı için son mesaj ve okunmamış mesaj sayısını al
        const usersWithMessages = await Promise.all(tickets.map(async (ticket) => {
            const lastMessage = await ChatMessage_1.ChatMessage.findOne({ ticketId: ticket._id })
                .sort({ timestamp: -1 })
                .lean();
            const unreadCount = await ChatMessage_1.ChatMessage.countDocuments({
                ticketId: ticket._id,
                fromType: 'user',
                read: false
            });
            return {
                ticketId: ticket._id,
                userId: ticket.telegram.from.id,
                userName: ticket.telegram.from.displayName || ticket.telegram.from.username || `User ${ticket.telegram.from.id}`,
                username: ticket.telegram.from.username,
                firstName: ticket.telegram.from.firstName,
                lastName: ticket.telegram.from.lastName,
                userChatId: ticket.telegram.userChatId,
                assignedTo: ticket.assignedTo?.name || 'Atanmamış',
                status: ticket.status,
                lastMessage: lastMessage ? {
                    message: lastMessage.message,
                    fromType: lastMessage.fromType,
                    fromName: lastMessage.fromName,
                    timestamp: lastMessage.timestamp
                } : null,
                unreadCount,
                updatedAt: ticket.updatedAt
            };
        }));
        return res.json({ users: usersWithMessages });
    }
    catch (e) {
        console.error('[API] Error fetching chat users:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Mesajları okundu olarak işaretle
r.post('/mark-read/:ticketId', auth_1.requireAuth, async (req, res) => {
    try {
        const { ticketId } = req.params;
        await ChatMessage_1.ChatMessage.updateMany({ ticketId, fromType: 'user', read: false }, { $set: { read: true } });
        return res.json({ success: true });
    }
    catch (e) {
        console.error('[API] Error marking messages as read:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// ===== GENEL SOHBET (Ticket olmadan) =====
// Genel sohbet kullanıcılarını listele
r.get('/direct-users', auth_1.requireAuth, async (req, res) => {
    try {
        // Tüm chatId'leri benzersiz şekilde al
        const userChats = await DirectChat_1.DirectChatMessage.aggregate([
            {
                $group: {
                    _id: '$chatId',
                    userId: { $first: '$userId' },
                    userName: { $first: '$userName' },
                    username: { $first: '$username' },
                    firstName: { $first: '$firstName' },
                    lastName: { $first: '$lastName' },
                    lastMessageTime: { $max: '$timestamp' }
                }
            },
            { $sort: { lastMessageTime: -1 } }
        ]);
        // Her kullanıcı için son mesaj ve okunmamış sayısını al
        const usersWithMessages = await Promise.all(userChats.map(async (chat) => {
            const lastMessage = await DirectChat_1.DirectChatMessage.findOne({ chatId: chat._id })
                .sort({ timestamp: -1 })
                .lean();
            const unreadCount = await DirectChat_1.DirectChatMessage.countDocuments({
                chatId: chat._id,
                fromType: 'user',
                read: false
            });
            // Bu kullanıcının ticket'ı var mı kontrol et
            const ticket = await Ticket_1.Ticket.findOne({ 'telegram.from.id': chat.userId })
                .sort({ createdAt: -1 })
                .populate('assignedTo')
                .lean();
            return {
                chatId: chat._id,
                userId: chat.userId,
                userName: chat.userName,
                username: chat.username,
                firstName: chat.firstName,
                lastName: chat.lastName,
                lastMessage: lastMessage ? {
                    message: lastMessage.message,
                    fromType: lastMessage.fromType,
                    fromName: lastMessage.fromName,
                    timestamp: lastMessage.timestamp
                } : null,
                unreadCount,
                updatedAt: chat.lastMessageTime,
                ticket: ticket ? {
                    ticketId: ticket._id,
                    status: ticket.status,
                    assignedTo: ticket.assignedTo?.name || 'Atanmamış',
                    detay: ticket.detay
                } : null
            };
        }));
        return res.json({ users: usersWithMessages });
    }
    catch (e) {
        console.error('[API] Error fetching direct chat users:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Genel sohbet geçmişini al
r.get('/direct-history/:chatId', auth_1.requireAuth, async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await DirectChat_1.DirectChatMessage.find({ chatId: Number(chatId) })
            .sort({ timestamp: 1 })
            .limit(200)
            .lean();
        return res.json({ messages });
    }
    catch (e) {
        console.error('[API] Error fetching direct chat history:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Genel sohbete mesaj gönder
r.post('/direct-send', auth_1.requireAuth, async (req, res) => {
    try {
        const { chatId, message } = req.body;
        const auth = req.auth;
        if (!chatId || !message) {
            return res.status(400).json({ message: 'chatId and message required' });
        }
        // Agent bilgisini al
        const agent = await Agent_1.Agent.findById(auth.sub);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }
        // Kullanıcı bilgisini al
        const lastUserMsg = await DirectChat_1.DirectChatMessage.findOne({ chatId: Number(chatId) }).sort({ timestamp: -1 });
        if (!lastUserMsg) {
            return res.status(404).json({ message: 'Chat not found' });
        }
        // Telegram'a mesaj gönder (agent imzası ile)
        const botToken = env_1.env.BOT_TOKEN;
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const messageWithSignature = `💬 ${agent.name} (Destek Ekibi):\n\n${message}`;
        await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageWithSignature
            })
        });
        // Mesajı kaydet
        const newMessage = new DirectChat_1.DirectChatMessage({
            userId: lastUserMsg.userId,
            userName: lastUserMsg.userName,
            username: lastUserMsg.username,
            firstName: lastUserMsg.firstName,
            lastName: lastUserMsg.lastName,
            chatId: Number(chatId),
            fromType: 'agent',
            fromId: agent._id.toString(),
            fromName: agent.name,
            message,
            timestamp: new Date(),
            read: false
        });
        await newMessage.save();
        return res.json({ success: true, message: newMessage });
    }
    catch (e) {
        console.error('[API] Error sending direct message:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Genel sohbet mesajlarını okundu işaretle
r.post('/direct-mark-read/:chatId', auth_1.requireAuth, async (req, res) => {
    try {
        const { chatId } = req.params;
        await DirectChat_1.DirectChatMessage.updateMany({ chatId: Number(chatId), fromType: 'user', read: false }, { $set: { read: true } });
        return res.json({ success: true });
    }
    catch (e) {
        console.error('[API] Error marking direct messages as read:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
// Kullanıcıdan gelen mesajı kaydet (Bot'tan çağrılır)
r.post('/direct-user-message', async (req, res) => {
    try {
        console.log('[API] Received direct user message:', req.body);
        const { userId, chatId, firstName, lastName, username, message } = req.body;
        const displayName = firstName || username || `User ${userId}`;
        // Önce kullanıcının bir ticket'ı var mı kontrol et
        const ticket = await Ticket_1.Ticket.findOne({ 'telegram.from.id': Number(userId) }).sort({ createdAt: -1 });
        if (ticket) {
            console.log('[API] Found ticket for user, saving to Ticket Chat', ticket._id);
            const chatMsg = new ChatMessage_1.ChatMessage({
                ticketId: ticket._id,
                fromType: 'user',
                fromId: String(userId),
                fromName: displayName,
                message,
                timestamp: new Date(),
                read: false
            });
            await chatMsg.save();
            return res.json({ success: true, type: 'ticket', ticketId: ticket._id });
        }
        console.log('[API] No ticket found, saving to Direct Chat');
        const newMessage = new DirectChat_1.DirectChatMessage({
            userId: Number(userId),
            userName: displayName,
            username,
            firstName,
            lastName,
            chatId: Number(chatId),
            fromType: 'user',
            fromId: String(userId),
            fromName: displayName,
            message,
            timestamp: new Date(),
            read: false
        });
        await newMessage.save();
        return res.json({ success: true, type: 'direct' });
    }
    catch (e) {
        console.error('[API] Error saving direct user message:', e);
        return res.status(500).json({ message: 'Internal error' });
    }
});
exports.default = r;
