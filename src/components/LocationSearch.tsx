import { useMemo, useState } from 'react';
import type { Location, Station } from '../types';
import { searchLocations } from '../domain/stations';
import { locate } from '../services/geolocation';
import { Icon } from './Icon';
import { Button } from './fluid/Button';
import { FluidList } from './fluid/FluidList';

export function LocationSearch({ stations, location, onSelect, onClear, disabled }: { stations: Station[]; location: Location | null; onSelect: (location: Location) => void; onClear: () => void; disabled: boolean }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const results = useMemo(() => searchLocations(stations, query), [stations, query]);
  async function useLocation() {
    setError(''); setLocating(true);
    try { onSelect(await locate()); setSearched(false); setQuery(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLocating(false); }
  }
  return <section className="location-panel" aria-labelledby="location-title">
    <div className="location-label"><span className="icon-tile"><Icon name="pin" /></span><div><h2 id="location-title">¿Dónde vas a repostar?</h2><p>Busca tu zona y encuentra opciones cerca.</p></div></div>
    <div className="location-actions">
      <form className="search-form" onSubmit={e => { e.preventDefault(); setSearched(true); }}>
        <label className="sr-only" htmlFor="location-query">Municipio o código postal</label>
        <Icon name="search" />
        <input id="location-query" type="search" placeholder="Municipio o código postal" value={query} onChange={e => { setQuery(e.target.value); setSearched(false); }} minLength={2} required disabled={disabled} />
        <Button className="search-submit" variant="primary" size="icon" type="submit" disabled={disabled} aria-label="Buscar ubicación" title="Buscar ubicación"><Icon name="arrow" size={20}/></Button>
      </form>
      <Button className="locate-button" onClick={useLocation} disabled={locating} leadingIcon={<Icon name="locate"/>} label={locating ? 'Localizando…' : 'Usar mi ubicación'}/>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {searched && <div className="location-results" aria-live="polite">
      {results.length ? <><p className="small muted">Selecciona una ubicación. La distancia partirá de un punto aproximado de sus gasolineras.</p><FluidList>{results.map(result => <li key={result.label}><button type="button" data-fluid-row onClick={() => { onSelect(result); setQuery(''); setSearched(false); }}><Icon name="pin" size={17} />{result.label}<Icon name="arrow" size={16} /></button></li>)}</FluidList></> : <p className="notice">No hay ubicaciones coincidentes con estaciones y precio de gasóleo A. Prueba otro municipio, un CP completo o tu ubicación.</p>}
    </div>}
    {location && <div className="active-location"><span className="status-dot"/><strong>{location.label}</strong><span>{location.approximate ? 'Punto de búsqueda aproximado' : 'Posición del dispositivo · guardada solo en este navegador'}</span><Button className="clear-location" variant="ghost" label="Borrar ubicación" onClick={onClear}/></div>}
  </section>;
}
