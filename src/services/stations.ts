import type { Dataset } from '../types';

export async function getStations(signal?: AbortSignal): Promise<Dataset> {
  const response = await fetch('/api/stations', { signal });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'No se pueden consultar los precios. Inténtalo de nuevo.');
  }
  const data = await response.json();
  if (!Array.isArray(data.stations) || !data.fetchedAt) throw new Error('El servidor ha devuelto datos no válidos.');
  return data;
}
