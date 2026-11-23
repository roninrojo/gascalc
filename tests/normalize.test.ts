import { describe, expect, it } from 'vitest';
import { normalizeDataset, normalizeStation, parsePublicationDate, parseSpanishNumber } from '../src/domain/normalize';
import { rawDataset, rawStation } from './fixtures';

describe('normalización del servicio oficial', () => {
  it('normaliza comas, coordenadas WGS84, rótulo y gasóleo A', () => {
    expect(normalizeStation(rawStation)).toMatchObject({ id: '123', brand: 'REPSOL', price: 1.835, lat: 40.4168, lon: -3.7038, postalCode: '28001', coordinatesAvailable: true });
  });
  it.each(['', ' ', 'no disponible', '1,8 €', '1.000,30'])('no inventa números para %j', value => expect(parseSpanishNumber(value)).toBeNull());
  it('descarta precio ausente, cero, negativo e identificador ausente', () => {
    for (const price of ['', '0', '-1', 'NaN']) expect(normalizeStation({ ...rawStation, 'Precio Gasoleo A': price })).toBeNull();
    expect(normalizeStation({ ...rawStation, IDEESS: '' })).toBeNull();
  });
  it('excluye venta restringida y venta desconocida', () => {
    expect(normalizeStation({ ...rawStation, 'Tipo Venta': 'R' })).toBeNull();
    expect(normalizeStation({ ...rawStation, 'Tipo Venta': '' })).toBeNull();
  });
  it('marca coordenadas no utilizables sin inventar una posición', () => {
    expect(normalizeStation({ ...rawStation, Latitud: '' })?.coordinatesAvailable).toBe(false);
    expect(normalizeStation({ ...rawStation, Latitud: '100' })?.coordinatesAvailable).toBe(false);
    expect(normalizeStation({ ...rawStation, Latitud: '0', 'Longitud (WGS84)': '0' })?.coordinatesAvailable).toBe(false);
  });
  it('conserva la falta de rótulo o dirección explícitamente', () => expect(normalizeStation({ ...rawStation, 'Rótulo': '', 'Dirección': '' })).toMatchObject({ brand: 'Sin rótulo', address: 'Dirección no disponible' }));
  it('interpreta hora peninsular en invierno y verano', () => {
    expect(parsePublicationDate('23/11/2026 11:28:38')).toBe('2026-11-23T10:28:38.000Z');
    expect(parsePublicationDate('23/07/2026 11:28:38')).toBe('2026-07-23T09:28:38.000Z');
    expect(parsePublicationDate('31/02/2026 11:28:38')).toBeNull();
    expect(parsePublicationDate('fecha desconocida')).toBeNull();
  });
  it('valida el conjunto, elimina duplicados y conserva su publicación', () => {
    const result = normalizeDataset({ ...rawDataset, ListaEESSPrecio: [rawStation, rawStation, {}] });
    expect(result.stations).toHaveLength(1); expect(result.skipped).toBe(2);
    expect(result.publishedAt).toBe('2026-11-23T10:28:38.000Z');
    expect(() => normalizeDataset({ ResultadoConsulta: 'ERROR' })).toThrow();
    expect(() => normalizeDataset({ ...rawDataset, ListaEESSPrecio: [] })).toThrow();
  });
});
