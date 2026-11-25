import { useState } from 'react';
import { distanceKm } from '../domain/stations';
import type { Location, Preferences, Station, TravelDistancePreference } from '../types';
import { Button } from './fluid/Button';

function numberField(value: string, required = true) {
  const amount = value.trim() === '' ? undefined : Number(value);
  const invalid = amount === undefined ? required : !Number.isFinite(amount) || amount < 0;
  return { value, amount, invalid };
}

function routeField(station: Station | undefined, origin: Location | null, estimateAllowed: boolean, saved: TravelDistancePreference | null) {
  const route = station && origin
    ? JSON.stringify([station.id, origin.approximate ? origin.label : [origin.lat, origin.lon]])
    : null;
  const estimate = estimateAllowed && origin && station?.coordinatesAvailable ? distanceKm(origin, station) : undefined;
  const value = route && saved?.route === route ? saved.value : estimate === undefined ? '' : String(estimate);
  return { ...numberField(value), route };
}

export function readComparisonSettings(
  preferences: Preferences,
  nearby: Station | undefined,
  brand: Station | undefined,
  nearbyOrigin: Location | null,
  brandOrigin: Location | null,
) {
  const hasOrigins = nearbyOrigin !== null && brandOrigin !== null;
  const differentOrigins = hasOrigins && (
    nearbyOrigin.lat !== brandOrigin.lat || nearbyOrigin.lon !== brandOrigin.lon || nearbyOrigin.label !== brandOrigin.label
  );
  const estimateAllowed = hasOrigins && !differentOrigins;
  const nearbyDistance = routeField(nearby, nearbyOrigin, estimateAllowed, preferences.nearbyTravelDistance);
  const brandDistance = routeField(brand, brandOrigin, estimateAllowed, preferences.brandTravelDistance);
  const consumption = numberField(preferences.travelConsumption);
  const fuelPrice = numberField(preferences.travelFuelPrice ?? (nearby ? String(nearby.price) : ''));
  const maxCashback = numberField(preferences.maxCashback, false);
  const maxBonusLiters = numberField(preferences.maxBonusLiters, false);
  const invalidTravel = preferences.travelEnabled && [nearbyDistance, brandDistance, consumption, fuelPrice].some(field => field.invalid);
  const invalidLimits = maxCashback.invalid || maxBonusLiters.invalid;
  return {
    nearbyDistance, brandDistance, consumption, fuelPrice, maxCashback, maxBonusLiters,
    differentOrigins, invalidTravel, invalidLimits,
    limited: maxCashback.amount !== undefined || maxBonusLiters.amount !== undefined,
    options: {
      maxCashback: maxCashback.amount,
      maxBonusLiters: maxBonusLiters.amount,
      travel: preferences.travelEnabled && !invalidTravel ? {
        consumption: consumption.amount!,
        fuelPrice: fuelPrice.amount!,
        nearbyDistance: nearbyDistance.amount!,
        brandDistance: brandDistance.amount!,
        includeReturn: preferences.includeReturn,
      } : undefined,
    },
  };
}

type Settings = ReturnType<typeof readComparisonSettings>;

function NumericField({ id, label, unit, field, onChange, disabled, error = 'Introduce un valor igual o mayor que cero.' }: {
  id: string;
  label: string;
  unit: string;
  field: ReturnType<typeof numberField>;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const invalid = !disabled && field.invalid;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className="input-suffix">
      <input id={id} type="number" min="0" step="any" inputMode="decimal" value={field.value} disabled={disabled}
        onChange={event => onChange(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error ${id}-unit` : `${id}-unit`}/>
      <span id={`${id}-unit`}>{unit}</span>
    </div>
    {invalid && <p id={`${id}-error`} className="field-error">{error}</p>}
  </div>;
}

export function ComparisonSettings({ settings, preferences, onChange }: {
  settings: Settings;
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
}) {
  const [limitsOpen, setLimitsOpen] = useState(settings.limited);
  const [travelOpen, setTravelOpen] = useState(preferences.travelEnabled);
  const { maxCashback, maxBonusLiters, nearbyDistance, brandDistance, consumption, fuelPrice, differentOrigins } = settings;
  return <div className="comparison-settings">
    <details className="comparison-disclosure" open={limitsOpen} onToggle={event => setLimitsOpen(event.currentTarget.open)}>
      <summary>Límites del cashback{settings.limited && <span className="disclosure-state">Configurados</span>}</summary>
      <div className="disclosure-body">
        <p className="field-hint">Deja vacíos los límites que no se apliquen a tu promoción.</p>
        <div className="settings-grid">
          <NumericField id="max-cashback" label="Importe máximo de cashback" unit="€" field={maxCashback} onChange={value => onChange({ maxCashback: value })}/>
          <NumericField id="max-bonus-liters" label="Litros máximos bonificados" unit="L" field={maxBonusLiters} onChange={value => onChange({ maxBonusLiters: value })}/>
        </div>
      </div>
    </details>
    <details className="comparison-disclosure" open={travelOpen} onToggle={event => setTravelOpen(event.currentTarget.open)}>
      <summary>Coste de desplazamiento{preferences.travelEnabled && <span className="disclosure-state">Incluido</span>}</summary>
      <div className="disclosure-body">
        <label className="comparison-check">
          <input type="checkbox" checked={preferences.travelEnabled} onChange={event => onChange({ travelEnabled: event.target.checked })}/>
          Incluir coste de desplazamiento
        </label>
        {preferences.travelEnabled && <>
          <div className="settings-grid">
            <NumericField id="travel-consumption" label="Consumo medio del vehículo" unit="L/100 km" field={consumption} onChange={value => onChange({ travelConsumption: value })}/>
            <div>
              <NumericField id="travel-fuel-price" label="Precio del combustible consumido" unit="€/L"
                field={nearbyDistance.route || preferences.travelFuelPrice !== null ? fuelPrice : { ...fuelPrice, invalid: false }}
                onChange={value => onChange({ travelFuelPrice: value })}/>
              {preferences.travelFuelPrice === null
                ? <p className="field-hint">Usa el precio de A como referencia para ambos trayectos.</p>
                : <Button className="travel-reset" variant="ghost" label="Usar el precio de A" onClick={() => onChange({ travelFuelPrice: null })}/>}
            </div>
          </div>
          <p className="field-hint" id="travel-distance-hint">{differentOrigins
            ? 'Los listados tienen orígenes distintos. Introduce los kilómetros adicionales reales de ida para cada alternativa.'
            : 'Las distancias iniciales se estiman en línea recta. Sustitúyelas por los kilómetros adicionales de ida por carretera.'}
            {' '}Introduce 0 km si la gasolinera queda en tu trayecto habitual.</p>
          <div className="settings-grid" aria-describedby="travel-distance-hint" role="group" aria-label="Distancias adicionales de ida">
            <NumericField id="nearby-travel-distance" label="Distancia adicional hasta la gasolinera A" unit="km" field={nearbyDistance} disabled={!nearbyDistance.route}
              onChange={value => nearbyDistance.route && onChange({ nearbyTravelDistance: { route: nearbyDistance.route, value } })}/>
            <NumericField id="brand-travel-distance" label="Distancia adicional hasta la gasolinera B" unit="km" field={brandDistance} disabled={!brandDistance.route}
              onChange={value => brandDistance.route && onChange({ brandTravelDistance: { route: brandDistance.route, value } })}/>
          </div>
          <label className="comparison-check">
            <input type="checkbox" checked={preferences.includeReturn} onChange={event => onChange({ includeReturn: event.target.checked })}/>
            Incluir trayecto de vuelta
          </label>
        </>}
      </div>
    </details>
  </div>;
}
