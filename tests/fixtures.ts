import type { Station } from '../src/types';

// Datos exclusivamente de pruebas. Nunca se importan desde la aplicación.
export const rawStation = {
  IDEESS: '123', 'Rótulo': 'REPSOL', 'Precio Gasoleo A': '1,835',
  Latitud: '40,4168', 'Longitud (WGS84)': '-3,7038',
  'Dirección': 'CALLE DE PRUEBA, 1', Municipio: 'Madrid', Provincia: 'MADRID',
  'C.P.': '28001', 'Tipo Venta': 'P',
};
export const rawDataset = { Fecha: '23/11/2026 11:28:38', ResultadoConsulta: 'OK', ListaEESSPrecio: [rawStation] };
export function station(overrides: Partial<Station> = {}): Station {
  return { id: '1', name: 'Estación de prueba', brand: 'REPSOL', address: 'Calle de prueba', municipality: 'Madrid', province: 'MADRID', postalCode: '28001', price: 1.835, lat: 40.4168, lon: -3.7038, coordinatesAvailable: true, ...overrides };
}
