import express from 'express';
import { createStationCache } from './cache.js';

export function createApp() {
  const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS || 600);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) throw new Error('CACHE_TTL_SECONDS no válido.');

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self)');
    next();
  });
  const getStations = createStationCache(ttlSeconds * 1000);
  app.get('/api/stations', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(await getStations()); }
    catch (error) {
      console.error('No se pudo consultar el servicio oficial:', error instanceof Error ? error.message : 'error desconocido');
      res.status(502).json({ error: 'El servicio del Ministerio no está disponible en este momento. Vuelve a intentarlo en unos minutos.' });
    }
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta no encontrada.' }); });

  return app;
}
