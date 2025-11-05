import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        allowedHosts: ['todo.vatansoft.net', 'localhost', '127.0.0.1', '0.0.0.0'],
        host: '0.0.0.0',
        port: 5173,
        hmr: {
            // host: 'todo.vatansoft.net',
            // Use bare host without protocol. Vite will build ws:// correctly.
            host: 'localhost',
            port: 5173,
            // protocol should be ws or wss for websocket HMR; leave default or use 'ws'
            protocol: 'ws',
            // protocol: 'https',
        },
    },
});
