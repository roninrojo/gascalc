import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createStationCache } from './cache';

if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT || 3001);
const ttlSeconds = Number(process.env.CACHE_TTL_SECONDS || 600);
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(ttlSeconds) || ttlSeconds < 1) throw new Error('PORT o CACHE_TTL_SECONDS no válidos.');
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
const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => { res.sendFile(path.join(dist, 'index.html')); });
}
app.listen(port, '127.0.0.1', () => console.log(`Gascalc API disponible en http://127.0.0.1:${port}`));
