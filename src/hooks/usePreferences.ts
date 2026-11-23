import { useEffect, useState } from 'react';
import type { Preferences } from '../types';

const KEY = 'gascalc.preferences.v1';
const defaults: Preferences = { location: null, brand: '', liters: '50', cashback: '0', unit: 'cent' };
export function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value || typeof value !== 'object') return defaults;
    const l = value.location;
    return {
      location: l && Number.isFinite(l.lat) && Math.abs(l.lat) <= 90 && Number.isFinite(l.lon) && Math.abs(l.lon) <= 180 && typeof l.label === 'string' && typeof l.approximate === 'boolean' ? l : null,
      brand: typeof value.brand === 'string' ? value.brand : '',
      liters: typeof value.liters === 'string' ? value.liters : '50',
      cashback: typeof value.cashback === 'string' ? value.cashback : '0',
      unit: value.unit === 'eur' ? 'eur' : 'cent',
    };
  } catch { return defaults; }
}
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Modo privado o almacenamiento lleno: la aplicación sigue funcionando. */ }
  }, [preferences]);
  function update(patch: Partial<Preferences>) { setPreferences(current => ({ ...current, ...patch })); }
  function clearLocation() { update({ location: null }); }
  return { preferences, update, clearLocation };
}
