import { normalizeDataset, SOURCE } from '../src/domain/normalize';
import type { Dataset } from '../src/types';

export function createStationCache(ttl: number, fetcher: typeof fetch = fetch, clock = () => Date.now()) {
  let cached: Dataset | null = null;
  let expiresAt = 0;
  let pending: Promise<Dataset> | null = null;
  return async function get(): Promise<Dataset> {
    if (cached && clock() < expiresAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(SOURCE, { signal: AbortSignal.timeout(25_000), headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Servicio oficial: HTTP ${response.status}`);
        const data = normalizeDataset(await response.json(), new Date(clock()));
        cached = data;
        expiresAt = clock() + ttl;
        return data;
      } catch (error) {
        if (cached) {
          // Evita machacar el servicio durante una caída; conserva fechas originales y avisa.
          expiresAt = clock() + Math.min(ttl, 60_000);
          cached = { ...cached, stale: true };
          return cached;
        }
        throw error;
      } finally { pending = null; }
    })();
    return pending;
  };
}
