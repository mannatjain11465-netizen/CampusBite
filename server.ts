import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.ts';
import { config } from './server/config/env.ts';

async function startServer() {
  const app = createApp();

  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`CampusBite server listening on http://localhost:${config.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CampusBite server:', err);
  process.exit(1);
});
