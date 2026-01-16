"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBotPing = updateBotPing;
exports.getBotStatus = getBotStatus;
exports.getDatabaseStatus = getDatabaseStatus;
exports.getSystemHealth = getSystemHealth;
exports.createHealthRouter = createHealthRouter;
const express_1 = require("express");
let botLastPing = null;
const BOT_TIMEOUT = 30000; // 30 saniye
function updateBotPing() {
    botLastPing = new Date();
}
function getBotStatus() {
    if (!botLastPing)
        return 'down';
    const now = Date.now();
    const lastPingTime = botLastPing.getTime();
    return (now - lastPingTime) < BOT_TIMEOUT ? 'up' : 'down';
}
async function getDatabaseStatus() {
    try {
        const mongoose = (await Promise.resolve().then(() => __importStar(require('mongoose')))).default;
        if (mongoose.connection.readyState === 1) {
            return 'up';
        }
        return 'down';
    }
    catch {
        return 'down';
    }
}
async function getSystemHealth() {
    const dbStatus = await getDatabaseStatus();
    return {
        api: {
            status: 'up',
            uptime: process.uptime(),
            lastCheck: new Date()
        },
        bot: {
            status: getBotStatus(),
            lastPing: botLastPing
        },
        database: {
            status: dbStatus,
            lastCheck: new Date()
        }
    };
}
function createHealthRouter() {
    const r = (0, express_1.Router)();
    r.get('/health', async (_req, res) => {
        const health = await getSystemHealth();
        // Sadece API'nin ayakta olduğunu kontrol et, bot ve db sorunları warning olsun
        res.status(200).json({
            ...health,
            overallStatus: health.api.status === 'up' ? 'healthy' : 'unhealthy',
            warnings: [
                health.bot.status === 'down' ? 'Bot is not responding' : null,
                health.database.status === 'down' ? 'Database connection is down' : null
            ].filter(Boolean)
        });
    });
    r.post('/bot/ping', (_req, res) => {
        updateBotPing();
        res.json({ success: true });
    });
    return r;
}
