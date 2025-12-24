"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Rotation_1 = require("../models/Rotation");
const auth_1 = require("../middlewares/auth");
const r = (0, express_1.Router)();
r.use(auth_1.requireAuth);
r.post('/rotation/reset', async (req, res) => {
    if (req.auth?.role !== 'supervisor')
        return res.status(403).json({ message: 'forbidden' });
    await Rotation_1.Rotation.replaceOne({ _id: 'telegram' }, { _id: 'telegram', index: 0, cycle: 0, assignedThisCycle: [] }, { upsert: true });
    res.json({ ok: true });
});
exports.default = r;
