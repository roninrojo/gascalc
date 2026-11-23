import type { Dataset, Station } from '../types';

export const SOURCE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

export function parseSpanishNumber(value: unknown): number | null {
  if (typeof value !== 'string' || !/^-?\d+(?:[,.]\d+)?$/.test(value.trim())) return null;
  const number = Number(value.trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

// El servicio utiliza hora peninsular española sin incluir el huso horario.
export function parsePublicationDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match.map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(utc);
  if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1 || hour > 23 || minute > 59 || second > 59) return null;
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' }).format(check);
  const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(formatted);
  if (!offset) return null;
  const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '+' ? 1 : -1);
  return new Date(utc - minutes * 60_000).toISOString();
}

const text = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string' ? row[key].trim() : '';

export function normalizeStation(raw: unknown): Station | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = text(row, 'IDEESS');
  const price = parseSpanishNumber(row['Precio Gasoleo A']);
  // Tipo Venta R: venta restringida; no es una estación accesible al público general.
  if (!id || price === null || price <= 0 || text(row, 'Tipo Venta') !== 'P') return null;
  const lat = parseSpanishNumber(row.Latitud);
  const lon = parseSpanishNumber(row['Longitud (WGS84)']);
  const coordinatesAvailable = lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  const brand = text(row, 'Rótulo') || 'Sin rótulo';
  return {
    id, name: brand, brand, price,
    address: text(row, 'Dirección') || 'Dirección no disponible',
    municipality: text(row, 'Municipio') || text(row, 'Localidad'),
    province: text(row, 'Provincia'), postalCode: text(row, 'C.P.'),
    lat: coordinatesAvailable ? lat! : 0, lon: coordinatesAvailable ? lon! : 0,
    coordinatesAvailable,
  };
}

export function normalizeDataset(raw: unknown, now = new Date()): Dataset {
  if (!raw || typeof raw !== 'object') throw new Error('Respuesta oficial no válida.');
  const data = raw as Record<string, unknown>;
  if (data.ResultadoConsulta !== 'OK' || !Array.isArray(data.ListaEESSPrecio)) throw new Error('El servicio oficial no ha devuelto un listado válido.');
  const stations: Station[] = [];
  const seen = new Set<string>();
  for (const row of data.ListaEESSPrecio) {
    const station = normalizeStation(row);
    if (station && !seen.has(station.id)) { stations.push(station); seen.add(station.id); }
  }
  if (!stations.length) throw new Error('La respuesta oficial no contiene precios de gasóleo A utilizables.');
  return { stations, publishedAt: parsePublicationDate(data.Fecha), fetchedAt: now.toISOString(), stale: false, skipped: data.ListaEESSPrecio.length - stations.length, source: SOURCE };
}
