import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no válido.');

const app = createApp();
const dist = path.resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => { res.sendFile(path.join(dist, 'index.html')); });
}
app.listen(port, '127.0.0.1', () => console.log(`Gascalc API disponible en http://127.0.0.1:${port}`));
