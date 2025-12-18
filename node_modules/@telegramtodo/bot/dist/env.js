"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
exports.env = {
    BOT_TOKEN: process.env.BOT_TOKEN || '8450757648:AAEk_lxB5x8-vGGueYhM6vAATAhMYaNVa1g',
    GROUP_ID: Number(process.env.GROUP_ID),
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8080'
};
