import { Router } from 'express';

export interface SystemHealth {
  api: {
    status: 'up' | 'down';
    uptime: number;
    lastCheck: Date;
  };
  bot: {
    status: 'up' | 'down';
    lastPing: Date | null;
  };
  database: {
    status: 'up' | 'down';
    lastCheck: Date;
  };
}

let botLastPing: Date | null = null;
const BOT_TIMEOUT = 30000; // 30 saniye

export function updateBotPing() {
  botLastPing = new Date();
}

export function getBotStatus(): 'up' | 'down' {
  if (!botLastPing) return 'down';
  const now = Date.now();
  const lastPingTime = botLastPing.getTime();
  return (now - lastPingTime) < BOT_TIMEOUT ? 'up' : 'down';
}

export async function getDatabaseStatus(): Promise<'up' | 'down'> {
  try {
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState === 1) {
      return 'up';
    }
    return 'down';
  } catch {
    return 'down';
  }
}

export async function getSystemHealth(): Promise<SystemHealth> {
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

export function createHealthRouter(): Router {
  const r = Router();

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
