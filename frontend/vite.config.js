import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app runs on 5173 and the Express API on 3001, so the
// dev server proxies the API and OAuth routes across. In production there is no
// proxy at all: Express serves the built frontend and the API from one origin.
//
// changeOrigin is deliberately left off so the Host header survives the hop.
// The OAuth callback URL is derived from that host, which keeps it correct both
// locally (http://localhost:5173/...) and on the deployed host
// (https://<service>.onrender.com/... - see RENDER_DEPLOY.md).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001' },
      '/auth': { target: 'http://localhost:3001' },
    },
  },
});
