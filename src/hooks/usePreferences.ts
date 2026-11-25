import { useEffect, useState } from 'react';
import type { Preferences, TravelDistancePreference } from '../types';

const KEY = 'gascalc.preferences.v1';
const defaults: Preferences = {
  location: null, brand: '', liters: '50', cashback: '0', unit: 'cent',
  maxCashback: '', maxBonusLiters: '',
  travelEnabled: false, travelConsumption: '6', travelFuelPrice: null,
  nearbyTravelDistance: null, brandTravelDistance: null, includeReturn: true,
};

function readDistance(value: unknown): TravelDistancePreference | null {
  if (typeof value !== 'object' || value === null || !('route' in value) || !('value' in value)) return null;
  return typeof value.route === 'string' && typeof value.value === 'string' ? { route: value.route, value: value.value } : null;
}
export function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value || typeof value !== 'object') return defaults;
    const l = value.location;
    return {
      location: l && Number.isFinite(l.lat) && Math.abs(l.lat) <= 90 && Number.isFinite(l.lon) && Math.abs(l.lon) <= 180 && typeof l.label === 'string' && typeof l.approximate === 'boolean' ? l : null,
      brand: typeof value.brand === 'string' ? value.brand : '',
      liters: typeof value.liters === 'string' ? value.liters : defaults.liters,
      cashback: typeof value.cashback === 'string' ? value.cashback : defaults.cashback,
      unit: value.unit === 'eur' ? 'eur' : 'cent',
      maxCashback: typeof value.maxCashback === 'string' ? value.maxCashback : defaults.maxCashback,
      maxBonusLiters: typeof value.maxBonusLiters === 'string' ? value.maxBonusLiters : defaults.maxBonusLiters,
      travelEnabled: value.travelEnabled === true,
      travelConsumption: typeof value.travelConsumption === 'string' ? value.travelConsumption : defaults.travelConsumption,
      travelFuelPrice: typeof value.travelFuelPrice === 'string' ? value.travelFuelPrice : null,
      nearbyTravelDistance: readDistance(value.nearbyTravelDistance),
      brandTravelDistance: readDistance(value.brandTravelDistance),
      includeReturn: value.includeReturn !== false,
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
