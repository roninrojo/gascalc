import { useEffect, useState } from 'react';
import type { StationDistance } from '../types';
import { dateTime, decimal } from '../utils/format';
import { Icon } from './Icon';
import { Button } from './fluid/Button';
import { FluidList } from './fluid/FluidList';

interface Props { stations: StationDistance[]; selectedId?: string; onSelect: (station: StationDistance) => void; publishedAt: string | null; empty: string; loading: boolean; label: string }
export function StationList({ stations, selectedId, onSelect, publishedAt, empty, loading, label }: Props) {
  const [limit, setLimit] = useState(12);
  useEffect(() => { setLimit(12); }, [stations]);
  if (loading) return <div className="list-state" role="status"><span className="spinner"/>Consultando precios oficiales…</div>;
  if (!stations.length) return <div className="list-state"><span className="empty-icon"><Icon name="fuel" size={28}/></span><p>{empty}</p></div>;
  return <><p className="result-count">{stations.length} {stations.length === 1 ? 'estación disponible' : 'estaciones disponibles'}<span>Gasóleo A</span></p>
    <FluidList className="station-list" aria-label={label}>
      {stations.slice(0, limit).map(station => <li key={station.id}>
        <button type="button" data-fluid-row className={`station ${selectedId === station.id ? 'is-selected' : ''}`} aria-pressed={selectedId === station.id} onClick={() => onSelect(station)}>
          <span className="station-top"><span className="station-brand-icon"><Icon name="fuel" size={19}/></span><span className="station-name">{station.name}</span><span className="selection-mark">{selectedId === station.id && <Icon name="check" size={14}/>}</span></span>
          <span className="station-address">{station.address}<br/>{station.postalCode} · {station.municipality}, {station.province}</span>
          <span className="station-bottom"><span className="station-distance"><Icon name="pin" size={14}/>{decimal(station.distance, 1)} km <span className="sr-only">en línea recta</span></span><span className="station-price">{decimal(station.price)} <small>€/L</small></span></span>
          <span className="station-date">Publicación: {dateTime(publishedAt)} · hora peninsular</span>
        </button>
      </li>)}
    </FluidList>
    {stations.length > limit && <Button className="load-more" label={`Mostrar más estaciones (${stations.length - limit})`} onClick={() => setLimit(n => n + 12)}/>}
  </>;
}
