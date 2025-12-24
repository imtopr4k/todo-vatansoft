"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireSupervisor = requireSupervisor;
const jwt_1 = require("../services/jwt");
const Agent_1 = require("../models/Agent");
async function requireAuth(req, res, next) {
    try {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        if (!token)
            return res.status(401).json({ message: 'Unauthorized' });
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const agent = await Agent_1.Agent.findById(payload.sub);
        if (!agent)
            return res.status(401).json({ message: 'Unauthorized' });
        // Otomatik çıkış kontrolü kaldırıldı - kullanıcılar manuel çıkış yapana kadar oturumları açık kalacak
        // const last = agent.lastActivityAt?.getTime() ?? 0;
        // const now = Date.now();
        // const idleSec = (now - last) / 1000;
        // if (agent.isActive && agent.lastActivityAt && idleSec > 3600) {
        //   agent.isActive = false;
        //   await agent.save();
        //   return res.status(440).json({ message: 'Session expired by inactivity' });
        // }
        req.auth = payload;
        next();
    }
    catch (e) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}
function requireSupervisor(req, res, next) {
    const { role } = req.auth || {};
    if (role !== 'supervisor')
        return res.status(403).json({ message: 'Forbidden' });
    next();
}
