import cors from 'cors';
import express from 'express';
import { config } from './config/env.ts';
import { getDb } from './db/database.ts';
import { seedDatabase } from './db/seed.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import adminRoutes from './routes/admin.routes.ts';
import authRoutes from './routes/auth.routes.ts';
import inventoryRoutes from './routes/inventory.routes.ts';
import menuRoutes from './routes/menu.routes.ts';
import notificationsRoutes from './routes/notifications.routes.ts';
import ordersRoutes from './routes/orders.routes.ts';
import stallsRoutes from './routes/stalls.routes.ts';

export function createApp(options?: { dbPath?: string; skipSeed?: boolean }) {
  const db = getDb(options?.dbPath);
  if (!options?.skipSeed) {
    seedDatabase(db);
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Serve uploaded food item images
  app.use('/uploads', express.static(config.uploadDir));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CampusBite API',
      timestamp: new Date().toISOString(),
    });
  });

  // Domain API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/stalls', stallsRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown API routes return clean JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use(errorHandler);
  return app;
}
