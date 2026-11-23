import { describe, expect, it, vi } from 'vitest';
import { createStationCache } from '../server/cache';
import { rawDataset } from './fixtures';

describe('caché del backend', () => {
  it('comparte peticiones concurrentes y renueva al expirar', async () => {
    let now = 1_000;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(rawDataset)));
    const get = createStationCache(600, fetcher, () => now);
    await Promise.all([get(), get(), get()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await get(); expect(fetcher).toHaveBeenCalledTimes(1);
    now = 1700; await get(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('conserva las fechas y la señal stale durante caídas, también en cache hit', async () => {
    let now = 1000;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(rawDataset))).mockRejectedValue(new Error('sin conexión'));
    const get = createStationCache(600, fetcher, () => now);
    const original = await get();
    now = 1700;
    const stale = await get(); expect(stale.stale).toBe(true);
    expect(stale.fetchedAt).toBe(original.fetchedAt); expect(stale.publishedAt).toBe(original.publishedAt);
    expect((await get()).stale).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('no utiliza datos ficticios si no hay ninguna consulta correcta', async () => {
    const get = createStationCache(600, vi.fn<typeof fetch>().mockRejectedValue(new Error('sin conexión')));
    await expect(get()).rejects.toThrow('sin conexión');
  });
  it('sale del estado desactualizado al recuperarse el servicio', async () => {
    let now = 1000;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(rawDataset)));
    const get = createStationCache(600, fetcher, () => now);
    await get(); now = 1700;
    fetcher.mockRejectedValueOnce(new Error('caída temporal'));
    expect((await get()).stale).toBe(true);
    now = 2400;
    expect((await get()).stale).toBe(false);
    expect((await get()).fetchedAt).toBe(new Date(2400).toISOString());
  });
  it('no sustituye una caché correcta por una respuesta corrupta', async () => {
    let now = 1000;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(rawDataset))).mockImplementation(async () => new Response('{}'));
    const get = createStationCache(600, fetcher, () => now);
    await get(); now = 1700;
    expect((await get()).stations).toHaveLength(1); expect((await get()).stale).toBe(true);
  });
});
