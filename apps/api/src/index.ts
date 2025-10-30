import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectMongo } from './db';
import { env } from './env';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import agentsRouter from './routes/agents';
import botRoutes from './routes/bot'; 
import adminRouter from './routes/admin';
import { initScheduler } from './services/scheduler';

(async () => {
  await connectMongo();
  await initScheduler();

  const app = express();

  const corsOptions: cors.CorsOptions = {
    origin: (origin, cb) => {
      // Postman/curl gibi origin'siz istekler
      if (!origin) return cb(null, true);

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
      const isViteLocal =
        /^http:\/\/(localhost|127\.0\.0\.1):51\d{2}$/.test(origin);

      if (allowList.includes(origin) || isViteLocal) return cb(null, true);
      return cb(new Error('CORS blocked: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json());
  app.use('/admin', adminRouter);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', authRoutes);
  app.use('/agents', agentsRouter);
  app.use('/tickets', ticketRoutes);
  app.use(express.json());
  app.use('/bot', botRoutes);
  app.get('/debug/db', async (_req, res) => {
    const mongoose = (await import('mongoose')).default;
    const db = mongoose.connection.db;
    const colls = await db.listCollections().toArray();
    res.json({
      mongoUri: process.env.MONGO_URI,
      dbName: db.databaseName,
      collections: colls.map(c => c.name),
    });
  });

  app.get('/debug/find', async (req, res) => {
    const { ext } = req.query as { ext?: string };
    const q = ext ? [{ externalUserId: String(ext).trim() }, { externalUserId: String(Number(ext)) }] : [];
    const agent = await (await import('./models/Agent')).Agent.findOne(q.length ? { $or: q } : {});
    res.json({ query: q, agent });
  });

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: 'http://localhost:5173' } });
  io.on('connection', () => {
    console.log('[socket] client connected');
  });

  server.listen(env.PORT, () => console.log(`[api] listening on ${env.PORT}`));
})();
