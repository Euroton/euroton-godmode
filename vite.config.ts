import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    server: {
        port: 8090,
        host: '127.0.0.1',
    },
    preview: {
        port: 8090,
        host: '127.0.0.1',
        strictPort: true,
        // Selfhost deployments put Caddy in front with the install's own
        // hostname, which this file can't know. Preview only serves the built
        // dist/ on loopback, & Caddy applies the private-network gate.
        allowedHosts: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
