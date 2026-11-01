import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    server: {
        port: 8090,
        host: '127.0.0.1',
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
