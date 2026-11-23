import { describe, expect, it } from 'vitest';
import { availableBrands, availableMunicipalities, distanceKm, filterStationList, filterStations, searchLocations } from '../src/domain/stations';
import { station } from './fixtures';

const origin = { lat: 40.4168, lon: -3.7038 };
const samples = [station(), station({ id: '2', brand: 'GALP', lat: 40.43, price: 1.6 }), station({ id: '3', lat: 41, price: 1.5 }), station({ id: '4', coordinatesAvailable: false })];
describe('distancia y filtros', () => {
  it('Haversine: cero, distancia conocida y simetría', () => {
    expect(distanceKm(origin, origin)).toBe(0);
    const barcelona = { lat: 41.3874, lon: 2.1686 };
    expect(distanceKm(origin, barcelona)).toBeCloseTo(505.1, 0);
    expect(distanceKm(origin, barcelona)).toBe(distanceKm(barcelona, origin));
  });
  it('filtra radio y descarta coordenadas ausentes', () => expect(filterStations(samples, origin, 10).map(s => s.id)).toEqual(['1', '2']));
  it('ordena por precio sin mutar los datos originales', () => {
    expect(filterStations(samples, origin, 10, '', 'price').map(s => s.id)).toEqual(['2', '1']);
    expect(samples[0].id).toBe('1'); expect(samples[0]).not.toHaveProperty('distance');
  });
  it('marca exacta, sin distinguir mayúsculas y acentos', () => expect(filterStations(samples, origin, 10, 'répsol').map(s => s.id)).toEqual(['1']));
  it('devuelve marcas únicas', () => expect(availableBrands(samples)).toEqual(['GALP', 'REPSOL']));
  it('combina población y marca sin mezclar municipios homónimos', () => {
    const local = [
      station({ municipality: 'Ávila', province: 'ÁVILA' }),
      station({ id: '2', municipality: 'AVILA', province: 'avila', brand: 'GALP' }),
      station({ id: '3', municipality: 'Ávila', province: 'SALAMANCA' }),
      station({ id: '4', municipality: '' }),
    ];
    const choices = availableMunicipalities(local);
    expect(choices.map(option => option.label)).toEqual(['Ávila, ÁVILA', 'Ávila, SALAMANCA']);
    const inRadius = filterStations(local, origin, 10);
    expect(filterStationList(inRadius, { municipality: choices[0].value }).map(s => s.id)).toEqual(['1', '2']);
    expect(filterStationList(inRadius, { municipality: choices[0].value, brand: 'GALP' }).map(s => s.id)).toEqual(['2']);
  });
  it('busca municipio y CP con ubicación explícitamente aproximada', () => {
    const local = samples.slice(0, 2);
    expect(searchLocations(local, 'mÁdri')[0]).toMatchObject({ label: 'Madrid, MADRID', approximate: true });
    expect(searchLocations(local, '28001')[0].lat).toBeCloseTo((40.4168 + 40.43) / 2);
    expect(searchLocations(local, '99999')).toEqual([]);
    expect(searchLocations(local, 'm')).toEqual([]);
  });
  it('desambigua municipios homónimos por provincia', () => {
    const result = searchLocations([station({ municipality: 'Villa', province: 'A' }), station({ id: '2', municipality: 'Villa', province: 'B' })], 'Villa');
    expect(result).toHaveLength(2);
  });
});
