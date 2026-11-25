import { useMemo, useState, type ReactNode } from 'react';
import type { Location, Station } from '../types';
import { searchLocations } from '../domain/stations';
import { locate } from '../services/geolocation';
import { Icon } from './Icon';
import { Button } from './fluid/Button';
import { FluidList } from './fluid/FluidList';

interface LookupProps {
  stations: Station[];
  onSelect: (location: Location) => void;
  disabled: boolean;
  action?: ReactNode;
  afterSearch?: ReactNode;
  comparison?: boolean;
  location?: Location | null;
}

function LocationLookup({ stations, onSelect, disabled, action, afterSearch, comparison = false, location }: LookupProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const results = useMemo(() => searched && query ? searchLocations(stations, query, comparison) : [], [stations, query, comparison, searched]);
  const id = comparison ? 'comparison-location-query' : 'location-query';
  const placeholder = comparison ? 'Municipio' : 'Municipio o código postal';

  return <>
    <div className="location-actions">
      <form className="search-form" onSubmit={e => { e.preventDefault(); if (query !== null) setSearched(true); }}>
        {!comparison && <label className="sr-only" htmlFor={id}>Municipio o código postal</label>}
        <Icon name="search" />
        <input id={id} type="search" placeholder={placeholder}
          value={(disabled ? null : query) ?? location?.label ?? ''}
          onFocus={e => { if (comparison && query === null) e.currentTarget.select(); }}
          onChange={e => { setQuery(e.target.value); setSearched(false); }}
          minLength={2} required disabled={disabled}
        />
        <Button className="search-submit" variant="primary" size="icon" type="submit" disabled={disabled} aria-label={comparison ? 'Buscar municipio de comparación' : 'Buscar ubicación'} title={comparison ? 'Buscar municipio de comparación' : 'Buscar ubicación'}><Icon name="arrow" size={20}/></Button>
      </form>
      {action}
    </div>
    {afterSearch}
    {!disabled && searched && <div className="location-results" aria-live="polite">
      {results.length ? <><p className="small muted">Selecciona una ubicación. La distancia partirá de un punto aproximado de sus gasolineras.</p><FluidList>{results.map(result => <li key={result.label}><button type="button" data-fluid-row onClick={() => { onSelect(result); setQuery(null); setSearched(false); }}><Icon name="pin" size={17}/>{result.label}<Icon name="arrow" size={16}/></button></li>)}</FluidList></> : <p className="notice">{comparison ? 'No hay municipios coincidentes con estaciones y precio de gasóleo A. Prueba otro municipio.' : 'No hay ubicaciones coincidentes con estaciones y precio de gasóleo A. Prueba otro municipio, un CP completo o tu ubicación.'}</p>}
    </div>}
  </>;
}

interface LocationSearchProps {
  stations: Station[];
  location: Location | null;
  onSelect: (location: Location) => void;
  onClear: () => void;
  disabled: boolean;
  comparison: {
    location: Location | null;
    sameZone: boolean;
    onSelect: (location: Location) => void;
    onSameZoneChange: (sameZone: boolean) => void;
  };
}

export function LocationSearch({ stations, location, onSelect, onClear, disabled, comparison }: LocationSearchProps) {
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [lookupVersion, setLookupVersion] = useState(0);
  async function useLocation() {
    setError(''); setLocating(true);
    try { onSelect(await locate()); setLookupVersion(version => version + 1); }
    catch (e) { setError((e as Error).message); }
    finally { setLocating(false); }
  }
  return <section className="location-panel" aria-labelledby="location-title">
    <div className="location-label"><span className="icon-tile"><Icon name="pin" /></span><div><h2 id="location-title">¿Dónde vas a repostar?</h2><p>Busca tu zona y encuentra opciones cerca.</p></div></div>
    <LocationLookup key={lookupVersion} stations={stations} onSelect={onSelect} disabled={disabled}
      action={<Button className="locate-button" onClick={useLocation} disabled={locating} leadingIcon={<Icon name="locate"/>} label={locating ? 'Localizando…' : 'Usar mi ubicación'}/>}
      afterSearch={error && <p className="notice error" role="alert">{error}</p>}
    />
    {location && <div className="active-location"><span className="status-dot"/><strong>{location.label}</strong><span>{location.approximate ? 'Punto de búsqueda aproximado' : 'Posición del dispositivo · guardada solo en este navegador'}</span><Button className="clear-location" variant="ghost" label="Borrar ubicación" onClick={onClear}/></div>}
    <div className="comparison-location">
      <label className="location-label" htmlFor="comparison-location-query"><span className="icon-tile"><Icon name="pin"/></span><strong>¿Dónde quieres comparar?</strong></label>
      <LocationLookup comparison stations={stations} location={comparison.location} onSelect={comparison.onSelect} disabled={disabled || comparison.sameZone}
        afterSearch={<label className="same-zone"><input type="checkbox" checked={comparison.sameZone} onChange={e => comparison.onSameZoneChange(e.target.checked)}/>Misma zona donde repostaré</label>}
      />
    </div>
  </section>;
}
