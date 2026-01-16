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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const db_1 = require("./db");
const env_1 = require("./env");
const auth_1 = __importDefault(require("./routes/auth"));
const tickets_1 = __importDefault(require("./routes/tickets"));
const agents_1 = __importDefault(require("./routes/agents"));
const bot_1 = __importDefault(require("./routes/bot"));
const admin_1 = __importDefault(require("./routes/admin"));
const logs_1 = __importDefault(require("./routes/logs"));
const chat_1 = __importDefault(require("./routes/chat"));
const businessSetup_1 = __importDefault(require("./routes/businessSetup"));
const scheduler_1 = require("./services/scheduler");
const healthCheck_1 = require("./services/healthCheck");
(async () => {
    await (0, db_1.connectMongo)();
    await (0, scheduler_1.initScheduler)();
    const app = (0, express_1.default)();
    const corsOptions = {
        origin: (origin, cb) => {
            // Postman/curl gibi origin'siz istekler
            if (!origin)
                return cb(null, true);
            // İzinli kökenler
            const allowList = [
                'http://localhost:5173',
                'http://localhost:5174',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:5174',
                'http://77.37.54.190:5173',
                'http://todo.vatansoft.net'
            ];
            // İstersen wildcard: herhangi bir localhost:5xxx (Vite)
            const isViteLocal = /^http:\/\/(localhost|127\.0\.0\.1):51\d{2}$/.test(origin);
            if (allowList.includes(origin) || isViteLocal)
                return cb(null, true);
            return cb(new Error('CORS blocked: ' + origin));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
    app.use((0, cors_1.default)(corsOptions));
    app.options('*', (0, cors_1.default)(corsOptions));
    app.use(express_1.default.json());
    app.use('/admin', admin_1.default);
    app.use('/', (0, healthCheck_1.createHealthRouter)());
    app.use('/auth', auth_1.default);
    app.use('/agents', agents_1.default);
    app.use('/tickets', tickets_1.default);
    app.use('/logs', logs_1.default);
    app.use('/chat', chat_1.default);
    app.use('/business-setup', businessSetup_1.default);
    app.use(express_1.default.json());
    app.use('/bot', bot_1.default);
    app.get('/debug/db', async (_req, res) => {
        const mongoose = (await Promise.resolve().then(() => __importStar(require('mongoose')))).default;
        const db = mongoose.connection.db;
        if (!db) {
            return res.status(500).json({ message: 'Database not connected' });
        }
        const colls = await db.listCollections().toArray();
        res.json({
            mongoUri: process.env.MONGO_URI,
            dbName: db.databaseName,
            collections: colls.map(c => c.name),
        });
    });
    app.get('/debug/find', async (req, res) => {
        const { ext } = req.query;
        const q = ext ? [{ externalUserId: String(ext).trim() }, { externalUserId: String(Number(ext)) }] : [];
        const agent = await (await Promise.resolve().then(() => __importStar(require('./models/Agent')))).Agent.findOne(q.length ? { $or: q } : {});
        res.json({ query: q, agent });
    });
    const server = http_1.default.createServer(app);
    const io = new socket_io_1.Server(server, { cors: { origin: '*' } });
    // Socket.IO bağlantıları
    io.on('connection', (socket) => {
        console.log('[socket] Client connected:', socket.id);
        socket.on('disconnect', () => {
            console.log('[socket] Client disconnected:', socket.id);
        });
    });
    // Socket.IO instance'ı global olarak erişilebilir yap
    global.io = io;
    server.listen(env_1.env.PORT, () => console.log(`[api] listening on ${env_1.env.PORT}`));
    // Crash durumunda yeniden başlatma
    process.on('uncaughtException', (error) => {
        console.error('[api] Uncaught Exception:', error);
        console.log('[api] Restarting in 5 seconds...');
        setTimeout(() => {
            process.exit(1);
        }, 5000);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('[api] Unhandled Rejection at:', promise, 'reason:', reason);
        console.log('[api] Restarting in 5 seconds...');
        setTimeout(() => {
            process.exit(1);
        }, 5000);
    });
})();
