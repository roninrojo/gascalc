import type { Location } from '../types';

export function locate(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este navegador no admite geolocalización. Busca un municipio o código postal.'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude, label: 'Mi ubicación', approximate: false }),
      error => reject(new Error(error.code === 1 ? 'Permiso de ubicación denegado. Puedes buscar por municipio o código postal.' : error.code === 3 ? 'La ubicación ha tardado demasiado. Prueba de nuevo o busca manualmente.' : 'No se ha podido obtener tu ubicación. Prueba la búsqueda manual.')),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
