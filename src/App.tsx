import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dataset, Station, StationDistance } from './types';
import { getStations } from './services/stations';
import { availableBrands, availableMunicipalities, filterStationList, filterStations, searchKey } from './domain/stations';
import { usePreferences } from './hooks/usePreferences';
import { dateTime } from './utils/format';
import { Icon } from './components/Icon';
import { LocationSearch } from './components/LocationSearch';
import { StationList } from './components/StationList';
import { Comparator } from './components/Comparator';
import { Button } from './components/fluid/Button';
import { Select, type SelectOption } from './components/fluid/Select';

const RADII = [5, 10, 20, 50].map(km => ({ value: String(km), label: `${km} km` }));
const SORT_ORDERS = [
  { value: 'distance', label: 'Más cercanas' },
  { value: 'price', label: 'Menor precio' },
] as const;
type SortOrder = typeof SORT_ORDERS[number]['value'];
type FilterOption = SelectOption<string>;

const EMPTY: Station[] = [];
const EMPTY_IN_RADIUS: StationDistance[] = [];

function filterChoices(options: FilterOption[], selected?: FilterOption): FilterOption[] {
  const choices = [{ value: '', label: 'Todas' }, ...options];
  if (selected && !options.some(option => option.value === selected.value)) choices.push(selected);
  return choices;
}

export default function App() {
  const { preferences, update, clearLocation } = usePreferences();
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nearbyId, setNearbyId] = useState<string>();
  const [brandId, setBrandId] = useState<string>();
  const [radius, setRadius] = useState(10);
  const [sort, setSort] = useState<SortOrder>('distance');
  const [brandSort, setBrandSort] = useState<SortOrder>('distance');
  const [nearbyMunicipality, setNearbyMunicipality] = useState<FilterOption>();
  const [nearbyBrand, setNearbyBrand] = useState<FilterOption>();
  const [brandMunicipality, setBrandMunicipality] = useState<FilterOption>();
  const [brandQuery, setBrandQuery] = useState('');
  const [now, setNow] = useState(Date.now());
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError('');
    try { const result = await getStations(request.signal); if (!request.signal.aborted) { setData(result); setNow(Date.now()); } }
    catch (e) { if (!request.signal.aborted) setError((e as Error).message); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 600_000);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { controller.current?.abort(); window.clearInterval(timer); window.clearInterval(tick); };
  }, [refresh]);
  const stations = data?.stations || EMPTY;
  const brands = useMemo(() => availableBrands(stations), [stations]);
  const brandOptions = useMemo(() => brands.filter(b => searchKey(b).includes(searchKey(brandQuery)) || b === preferences.brand), [brands, brandQuery, preferences.brand]);
  const brandChoices = useMemo(() => {
    const choices = [{ value: '', label: 'Selecciona una marca' }];
    if (preferences.brand && !brands.includes(preferences.brand)) {
      choices.push({ value: preferences.brand, label: `${preferences.brand} (sin datos actuales)` });
    }
    return choices.concat(brandOptions.map(brand => ({ value: brand, label: brand })));
  }, [brandOptions, brands, preferences.brand]);
  const inRadius = useMemo(() => preferences.location ? filterStations(stations, preferences.location, radius) : EMPTY_IN_RADIUS, [stations, preferences.location, radius]);
  const brandInRadius = useMemo(() => preferences.brand ? filterStationList(inRadius, { brand: preferences.brand }) : EMPTY_IN_RADIUS, [inRadius, preferences.brand]);
  const nearbyMunicipalities = useMemo(() => availableMunicipalities(inRadius), [inRadius]);
  const nearbyBrands = useMemo(() => availableBrands(inRadius).map(brand => ({ value: brand, label: brand })), [inRadius]);
  const brandMunicipalities = useMemo(() => availableMunicipalities(brandInRadius), [brandInRadius]);
  const nearby = useMemo(() => filterStationList(inRadius, { municipality: nearbyMunicipality?.value, brand: nearbyBrand?.value, sort }), [inRadius, nearbyMunicipality, nearbyBrand, sort]);
  const branded = useMemo(() => filterStationList(brandInRadius, { municipality: brandMunicipality?.value, sort: brandSort }), [brandInRadius, brandMunicipality, brandSort]);
  const selectedNearby = useMemo(() => stations.find(s => s.id === nearbyId), [stations, nearbyId]);
  const selectedBrand = useMemo(() => stations.find(s => s.id === brandId), [stations, brandId]);
  const nearbyMunicipalityChoices = filterChoices(nearbyMunicipalities, nearbyMunicipality);
  const nearbyBrandChoices = filterChoices(nearbyBrands, nearbyBrand);
  const brandMunicipalityChoices = filterChoices(brandMunicipalities, brandMunicipality);
  const staleHours = Number(import.meta.env.VITE_STALE_HOURS || 24);
  const stale = Boolean(data && (data.stale || error || !data.publishedAt || now - Date.parse(data.publishedAt) > (Number.isFinite(staleHours) && staleHours > 0 ? staleHours : 24) * 3600_000));

  function resetLocationFilters() {
    setNearbyId(undefined);
    setBrandId(undefined);
    setNearbyMunicipality(undefined);
    setNearbyBrand(undefined);
    setBrandMunicipality(undefined);
  }

  return <>
    <a className="skip-link" href="#main">Saltar al contenido</a>
    <header className="site-header"><div className="container header-inner"><a className="wordmark" href="#" aria-label="Gascalc, inicio"><span className="logo-mark"><svg width="19" height="24" viewBox="0 0 24 30" aria-hidden="true"><path d="M14 1 2 17h10L8 29 23 10H12Z" fill="currentColor"/></svg></span>gascalc<span className="wordmark-dot">.</span></a><a className="header-link" href="#como-funciona">Cómo funciona <Icon name="arrow" size={16}/></a></div></header>
    <main id="main" className="container">
      <h1 className="mobile-title sr-only">Gascalc, comparador de gasóleo A</h1>
      <section className="hero" aria-labelledby="title">
        <div className="hero-copy">
          <h1 id="title">Cada céntimo <span>cuenta.</span></h1>
          <p className="hero-description">Compara el precio real de repostar. Encuentra tu gasolinera y descubre si el cashback compensa.</p>
        </div>
        <div className="hero-note">
          <Icon name="fuel" size={28}/>
          <div><strong>Gasóleo A</strong><p>Estaciones públicas en España</p></div>
        </div>
      </section>
      <div className="data-bar">
        <span className={`data-indicator ${stale || error ? 'warning-indicator' : ''}`}><span className="status-dot"/>{loading && !data ? 'Conectando con el Ministerio' : data ? 'Datos oficiales · MITECO' : 'Sin datos disponibles'}</span>
        <span className="data-date">Publicación: {dateTime(data?.publishedAt || null)}{data?.publishedAt && ' · hora peninsular'}</span>
        <Button className="refresh" variant="ghost" leadingIcon={<Icon name="refresh" size={17}/>} label={loading ? 'Consultando…' : 'Actualizar'} onClick={() => void refresh()} disabled={loading}/>
      </div>
      {error && <div className="notice error" role="alert">{error} {data && 'Se conserva la última consulta disponible.'}<Button className="retry" variant="ghost" label="Reintentar" onClick={() => void refresh()} disabled={loading}/></div>}
      {stale && <p className="notice warning" role="status">Los precios pueden estar desactualizados: {data?.stale || error ? 'no se ha podido renovar la consulta oficial.' : !data?.publishedAt ? 'la fuente no indica una fecha de publicación válida.' : 'la publicación tiene más de ' + (Number.isFinite(staleHours) && staleHours > 0 ? staleHours : 24) + ' horas.'} Confirma el precio en el surtidor.</p>}
      <LocationSearch stations={stations} location={preferences.location} onSelect={location => { update({ location }); resetLocationFilters(); }} onClear={() => { clearLocation(); resetLocationFilters(); }} disabled={!data}/>
      <div className="selection-intro"><h2>Dos opciones. Una buena decisión.</h2><p>Elige una estación en cada listado para comparar.</p></div>
      <div className="station-columns">
        <section className="station-panel" aria-labelledby="nearby-option nearby-title"><div className="section-heading"><span className="option-label" id="nearby-option">A</span><div><h3 id="nearby-title">Cerca de ti</h3><p>Tu alternativa sin cashback.</p></div></div>
          <div className="panel-filters">
            <div className="field">
              <label id="radius-label" htmlFor="radius">Distancia máxima</label>
              <Select id="radius" describedBy="radius-hint" value={String(radius)} options={RADII} onValueChange={value => setRadius(Number(value))}/>
            </div>
            <div className="field">
              <label id="sort-label" htmlFor="sort">Ordenar por</label>
              <Select id="sort" value={sort} options={SORT_ORDERS} onValueChange={setSort}/>
            </div>
            <div className="field">
              <label id="nearby-municipality-label" htmlFor="nearby-municipality">Población</label>
              <Select id="nearby-municipality" value={nearbyMunicipality?.value ?? ''} options={nearbyMunicipalityChoices} disabled={nearbyMunicipalityChoices.length === 1} onValueChange={value => setNearbyMunicipality(nearbyMunicipalities.find(option => option.value === value))}/>
            </div>
            <div className="field">
              <label id="nearby-brand-label" htmlFor="nearby-brand">Marca</label>
              <Select id="nearby-brand" value={nearbyBrand?.value ?? ''} options={nearbyBrandChoices} disabled={nearbyBrandChoices.length === 1} onValueChange={value => setNearbyBrand(nearbyBrands.find(option => option.value === value))}/>
            </div>
            <p className="field-hint radius-hint" id="radius-hint">La distancia se aplica a ambos listados.</p>
          </div>
          <div>
            <StationList stations={nearby} selectedId={nearbyId} onSelect={s => setNearbyId(s.id)} publishedAt={data?.publishedAt || null} loading={loading && !data} label="Gasolineras cercanas" empty={!data ? 'No hay precios disponibles. Reintenta la consulta oficial.' : !preferences.location ? 'Indica tu ubicación para encontrar gasolineras cercanas.' : nearbyMunicipality || nearbyBrand ? 'No hay estaciones en este radio con los filtros elegidos. Cambia la población o la marca, o amplía la distancia.' : 'No hay estaciones con gasóleo A en este radio. Prueba a ampliar la distancia.'}/>
          </div>
        </section>
        <section className="station-panel" aria-labelledby="brand-option brand-title"><div className="section-heading"><span className="option-label" id="brand-option">B</span><div><h3 id="brand-title">Tu marca, con ventaja</h3><p>La opción con tu promoción.</p></div></div>
          <div className="panel-filters brand-filters">
            <div className="field">
              <label htmlFor="brand-search">Buscar marca o rótulo</label>
              <div className="brand-search">
                <Icon name="search" size={17}/>
                <input id="brand-search" type="search" placeholder="Repsol, Galp, Shell…" value={brandQuery} onChange={e => setBrandQuery(e.target.value)} disabled={!data}/>
              </div>
            </div>
            <div className="field">
              <label id="brand-select-label" htmlFor="brand-select">Marca seleccionada</label>
              <Select id="brand-select" value={preferences.brand} options={brandChoices} disabled={!data} onValueChange={brand => { update({ brand }); setBrandId(undefined); setBrandMunicipality(undefined); }}/>
            </div>
            <div className="field">
              <label id="brand-municipality-label" htmlFor="brand-municipality">Población</label>
              <Select id="brand-municipality" value={brandMunicipality?.value ?? ''} options={brandMunicipalityChoices} disabled={brandMunicipalityChoices.length === 1} onValueChange={value => setBrandMunicipality(brandMunicipalities.find(option => option.value === value))}/>
            </div>
            <div className="field">
              <label id="brand-sort-label" htmlFor="brand-sort">Ordenar por</label>
              <Select id="brand-sort" value={brandSort} options={SORT_ORDERS} onValueChange={setBrandSort}/>
            </div>
          </div>
          <div>
            {brandQuery && !brandOptions.some(b => searchKey(b).includes(searchKey(brandQuery))) && <p className="field-hint">No hay marcas coincidentes con esa búsqueda.</p>}
            <StationList stations={branded} selectedId={brandId} onSelect={s => setBrandId(s.id)} publishedAt={data?.publishedAt || null} loading={loading && !data} label="Gasolineras de la marca" empty={!data ? 'No hay precios disponibles. Reintenta la consulta oficial.' : !preferences.location ? 'Indica primero una ubicación para encontrar gasolineras.' : !preferences.brand ? 'Selecciona una marca para encontrar sus estaciones.' : brandMunicipality ? 'No hay estaciones de esta marca en la población y el radio elegidos. Cambia la población o amplía la distancia.' : 'No hay estaciones de esta marca en el radio elegido. Amplía la distancia o cambia de marca.'}/>
          </div>
        </section>
      </div>
      {preferences.location && <p className="distance-note">Distancias en línea recta, no por carretera.{preferences.location.approximate && ' Calculadas desde un punto aproximado del municipio o CP, no desde tu posición exacta.'} Las estaciones elegidas se conservan al filtrar u ordenar los listados.</p>}
      <Comparator nearby={selectedNearby} brand={selectedBrand} preferences={preferences} onChange={update}/>
      <section className="how-it-works" id="como-funciona" aria-labelledby="how-title"><div><h2 id="how-title">Lo que debes saber.</h2></div><div className="how-items"><article><span>Datos oficiales</span><p>Precios de gasóleo A publicados por el Ministerio. Sin precios inventados ni estaciones de venta restringida.</p></article><article><span>Tu promoción</span><p>El cashback lo introduces tú. Comprueba sus límites, plazos y condiciones con la marca.</p></article><article><span>Tu privacidad</span><p>La ubicación y tus preferencias se guardan en este navegador. No enviamos tus coordenadas al servidor.</p></article></div></section>
      <details className="source-details"><summary>Fuente, actualización y límites de los datos</summary><p>Fuente: <a href="https://geoportalgasolineras.es/" target="_blank" rel="noreferrer">Geoportal de Gasolineras — MITECO</a>. <a href="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help" target="_blank" rel="noreferrer">Documentación del servicio REST</a>.</p><p>El servicio declara una publicación cada media hora. Nuestra caché dura 10 minutos por defecto; actualizar no obliga al Ministerio a publicar nuevos precios. La fecha mostrada corresponde al conjunto de datos, no a la última modificación individual de cada estación. Importes con impuestos comunicados a la fuente; verifica el surtidor.</p><p>La marca corresponde al rótulo comunicado: pueden existir variantes de una misma cadena y no se infieren afiliaciones. La búsqueda manual solo encuentra municipios y CP presentes en estaciones con datos válidos. Sin coordenadas no podemos mostrar distancia y la estación se excluye de los listados geográficos.</p>{data && <p>Última consulta correcta: {dateTime(data.fetchedAt)} (hora peninsular). {data.stations.length} estaciones públicas con precio válido. {data.skipped} registros omitidos por precio ausente, venta restringida, identificador ausente o duplicado.</p>}</details>
    </main>
    <footer className="site-footer container"><a className="wordmark footer-wordmark" href="#">gascalc<span className="wordmark-dot">.</span></a><a href="#como-funciona">Cómo funciona</a></footer>
  </>;
}
