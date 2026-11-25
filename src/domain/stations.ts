import type { Coordinates, Location, Station, StationDistance } from '../types';

export const searchKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function filterStations(stations: Station[], location: Coordinates, maxDistance: number, brand = '', sort: 'distance' | 'price' = 'distance'): StationDistance[] {
  const inRadius = stations
    .filter(s => s.coordinatesAvailable)
    .map(s => ({ ...s, distance: distanceKm(location, s) }))
    .filter(s => s.distance <= maxDistance);
  return filterStationList(inRadius, { brand, sort });
}

interface StationFilters {
  brand?: string;
  municipality?: string;
  sort?: 'distance' | 'price';
}

export function filterStationList(stations: StationDistance[], { brand, municipality, sort = 'distance' }: StationFilters): StationDistance[] {
  const brandKey = brand ? searchKey(brand) : '';
  return stations
    .filter(s => (!brand || searchKey(s.brand) === brandKey) && (!municipality || municipalityKey(s) === municipality))
    .sort((a, b) => sort === 'price' ? a.price - b.price || a.distance - b.distance : a.distance - b.distance || a.price - b.price);
}

function municipalityKey({ municipality, province }: Station): string {
  const name = searchKey(municipality);
  return name ? JSON.stringify([name, searchKey(province)]) : '';
}

export function availableMunicipalities(stations: Station[]): { value: string; label: string }[] {
  const municipalities = new Map<string, string>();
  for (const station of stations) {
    const key = municipalityKey(station);
    if (key && !municipalities.has(key)) {
      municipalities.set(key, station.province ? `${station.municipality}, ${station.province}` : station.municipality);
    }
  }
  return Array.from(municipalities, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function availableBrands(stations: Station[]): string[] {
  return [...new Set(stations.map(s => s.brand))].sort((a, b) => a.localeCompare(b, 'es'));
}

// Búsqueda sin terceros: centro aproximado de las estaciones con el mismo municipio/CP.
// No se afirma que sea el centro geográfico real ni una dirección exacta del usuario.
export function searchLocations(stations: Station[], query: string, municipalitiesOnly = false): Location[] {
  const key = searchKey(query);
  if (key.length < 2) return [];
  const postal = !municipalitiesOnly && /^\d/.test(key);
  const groups = new Map<string, { label: string; points: Station[]; exact: boolean }>();
  for (const s of stations) {
    if (!s.coordinatesAvailable) continue;
    const target = postal ? s.postalCode : searchKey(s.municipality);
    if (!target.includes(key)) continue;
    const groupId = postal ? s.postalCode : `${searchKey(s.municipality)}|${s.province}`;
    let group = groups.get(groupId);
    if (!group) {
      group = { label: postal ? `${s.postalCode} · ${s.municipality}, ${s.province}` : `${s.municipality}, ${s.province}`, points: [], exact: target === key };
      groups.set(groupId, group);
    }
    group.points.push(s);
  }
  return [...groups.values()].sort((a, b) => Number(b.exact) - Number(a.exact) || a.label.localeCompare(b.label, 'es')).slice(0, 8).map(g => ({
    label: g.label, approximate: true,
    lat: g.points.reduce((n, s) => n + s.lat, 0) / g.points.length,
    lon: g.points.reduce((n, s) => n + s.lon, 0) / g.points.length,
  }));
}
