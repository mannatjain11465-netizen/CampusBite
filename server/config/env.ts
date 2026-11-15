import 'dotenv/config';
import path from 'node:path';

function resolvePort(): number {
  const portIdx = process.argv.indexOf('--port');
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    const cliPort = Number(process.argv[portIdx + 1]);
    if (!Number.isNaN(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  return Number(process.env.PORT || 3000);
}

export const config = {
  port: resolvePort(),
  jwtSecret: process.env.JWT_SECRET || 'campusbite_dev_jwt_secret_change_in_production_2026',
  jwtExpiresIn: '7d' as const,
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'campusbite.db'),
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  assetsImagesDir: path.resolve(process.cwd(), 'src', 'assets', 'images'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
