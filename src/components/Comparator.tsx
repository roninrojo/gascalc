import { comparePrices, cashbackInEuros, convertCashbackInput } from '../domain/compare';
import type { Preferences, Station } from '../types';
import { decimal, money, quantity } from '../utils/format';
import { Icon } from './Icon';
import { Select } from './fluid/Select';

const CASHBACK_UNITS = [
  { value: 'cent', label: 'céntimos/L' },
  { value: 'eur', label: '€/L' },
] as const;

export function Comparator({ nearby, brand, preferences, onChange }: { nearby?: Station; brand?: Station; preferences: Preferences; onChange: (patch: Partial<Preferences>) => void }) {
  const liters = preferences.liters.trim() ? Number(preferences.liters) : NaN;
  const cashbackValue = preferences.cashback.trim() ? Number(preferences.cashback) : NaN;
  const cashback = cashbackInEuros(cashbackValue, preferences.unit);
  const litersError = !Number.isFinite(liters) || liters <= 0;
  const cashbackError = !Number.isFinite(cashback) || cashback < 0;
  let result: ReturnType<typeof comparePrices> | undefined;
  let error = '';
  if (nearby && brand && !litersError && !cashbackError) {
    if (nearby.id === brand.id) error = 'Has seleccionado la misma estación en ambos listados. Elige dos estaciones distintas para comparar alternativas; el cashback no crea una segunda gasolinera.';
    else {
      try { result = comparePrices(nearby.price, brand.price, liters, cashback); }
      catch (e) { error = (e as Error).message; }
    }
  }
  function switchUnit(unit: Preferences['unit']) {
    onChange({ unit, cashback: convertCashbackInput(preferences.cashback, preferences.unit, unit) });
  }
  return <section className="comparator" id="comparador" aria-labelledby="compare-title">
    <div className="section-heading compare-heading"><div><h2 id="compare-title">Las cuentas, claras.</h2><p>El precio del surtidor no siempre es el precio final.</p></div></div>
    <div className="compare-controls">
      <div className="field"><label htmlFor="liters">Litros a repostar</label><div className="input-suffix"><input id="liters" type="number" min="0" step="any" inputMode="decimal" value={preferences.liters} onChange={e => onChange({ liters: e.target.value })} aria-invalid={litersError} aria-describedby={litersError ? 'liters-error' : undefined}/><span>litros</span></div>{litersError && <p className="field-error" id="liters-error">Introduce una cantidad mayor que cero.</p>}</div>
      <div className="field cashback-field"><label htmlFor="cashback">Cashback de la estación de marca <span className="optional">Solo opción B</span></label><div className="cashback-input"><input id="cashback" type="number" min="0" step="any" inputMode="decimal" value={preferences.cashback} onChange={e => onChange({ cashback: e.target.value })} aria-invalid={cashbackError} aria-describedby={cashbackError ? 'cashback-error' : 'cashback-hint'}/><label className="sr-only" id="cashback-unit-label" htmlFor="cashback-unit">Unidad del cashback</label><Select id="cashback-unit" variant="borderless" value={preferences.unit} options={CASHBACK_UNITS} onValueChange={switchUnit}/></div>{cashbackError ? <p className="field-error" id="cashback-error">Introduce un cashback igual o mayor que cero.</p> : <p id="cashback-hint" className="field-hint">Introduce tu promoción; no se aplica automáticamente.</p>}</div>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="comparison-cards">
      <article className={`comparison-card ${result?.winner === 'nearby' ? 'winner' : ''}`} aria-label="Coste de la gasolinera cercana">
        <div className="comparison-card-heading"><span className="comparison-option">A · Cercana</span>{result?.winner === 'nearby' && <span className="winner-label"><Icon name="check" size={14}/>Mejor opción</span>}</div>
        <h3>{nearby?.name || 'Tu estación cercana'}</h3><p className="comparison-address">{nearby ? `${nearby.address} · ${nearby.municipality}` : 'Selecciona una gasolinera en el listado A.'}</p>
        <dl><div><dt>Precio gasóleo A</dt><dd>{nearby ? `${decimal(nearby.price)} €/L` : '—'}</dd></div><div><dt>Litros a repostar</dt><dd>{!litersError ? `${quantity(liters)} L` : '—'}</dd></div></dl>
        <div className="total"><span>Coste total</span><strong>{result ? money(result.nearbyTotal) : '—'}</strong></div>
      </article>
      <article className={`comparison-card ${result?.winner === 'brand' ? 'winner' : ''}`} aria-label="Coste de la gasolinera de marca">
        <div className="comparison-card-heading"><span className="comparison-option">B · Con cashback</span>{result?.winner === 'brand' && <span className="winner-label"><Icon name="check" size={14}/>Mejor opción</span>}</div>
        <h3>{brand?.name || 'Tu estación de marca'}</h3><p className="comparison-address">{brand ? `${brand.address} · ${brand.municipality}` : 'Selecciona una gasolinera en el listado B.'}</p>
        <dl><div><dt>Precio original</dt><dd>{brand ? `${decimal(brand.price)} €/L` : '—'}</dd></div><div><dt>Cashback por litro</dt><dd>{!cashbackError ? `−${decimal(cashback)} €/L` : '—'}</dd></div><div className="effective-row"><dt>Precio efectivo</dt><dd>{result ? `${decimal(result.effectivePrice)} €/L` : '—'}</dd></div><div><dt>Coste original · {!litersError ? `${quantity(liters)} L` : '—'}</dt><dd>{result ? money(result.brandOriginal) : '—'}</dd></div><div><dt>Cashback total</dt><dd>{result ? `−${money(result.cashbackTotal)}` : '—'}</dd></div></dl>
        <div className="total"><span>Coste efectivo</span><strong>{result ? money(result.brandTotal) : '—'}</strong></div>
      </article>
    </div>
    <div className={`conclusion ${result && result.winner !== 'tie' ? 'has-result' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      {result ? result.winner === 'tie' ? <><Icon name="info"/><p><strong>Las dos opciones cuestan lo mismo.</strong><br/>{money(result.nearbyTotal)} al repostar {quantity(liters)} litros. Elige la que más te convenga.</p></> : <><span className="conclusion-icon"><Icon name="check" size={23}/></span><p>Te conviene repostar en <strong>{result.winner === 'brand' ? brand!.name : nearby!.name}.</strong><br/>Ahorrarás <strong>{money(Math.abs(result.difference))}</strong> al repostar {quantity(liters)} litros.</p><span className="savings">{money(Math.abs(result.difference))}<small>de ahorro total</small></span></> : <><Icon name="info"/><p>{error ? 'Revisa la selección o el cashback para ver una comparación válida.' : litersError || cashbackError ? 'Revisa los valores del comparador.' : 'Selecciona una estación en cada listado para descubrir cuál compensa.'}</p></>}
    </div>
    {result && <div className="break-even"><Icon name="info" size={18}/><div><h3>¿Con qué cashback o precio original compensa?</h3>
      <p>{result.breakEven < 0 ? <>La estación de marca ya es más barata sin cashback: {decimal(-result.breakEven)} €/L menos.</> : result.breakEven === 0 ? <>Los precios originales son iguales. Cualquier cashback positivo hace más económica la estación de marca.</> : <>Con los precios originales actuales, el punto de equilibrio del cashback es <strong>{decimal(result.breakEven)} €/L</strong> ({quantity(result.breakEven * 100)} céntimos/L). Con ese cashback, empatan; con uno mayor, gana la estación de marca; con uno menor, la cercana.</>}</p>
      <p>Con el cashback introducido de {decimal(cashback)} €/L, el punto de equilibrio es <strong>{decimal(nearby!.price + cashback)} €/L</strong> para el precio original del gasóleo en {brand!.name}. Por debajo de ese precio de surtidor, gana la estación de marca; por encima, la cercana. A ese precio, empatan.</p>
      <p className="muted">Con un cashback fijo por litro, los litros cambian el ahorro total, no qué estación gana.</p></div></div>}
    <p className="comparison-disclaimer">El cashback es una devolución, no necesariamente un descuento inmediato. No incluimos desvíos, consumos de desplazamiento, límites de promoción ni comisiones.</p>
  </section>;
}
