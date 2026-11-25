import type { comparePrices } from '../domain/compare';
import { decimal, money } from '../utils/format';
import { Icon } from './Icon';

type Result = ReturnType<typeof comparePrices>;
type Thresholds = NonNullable<Result['thresholds']>;

function signedMoney(amount: number) {
  return amount === 0 ? money(0) : `${amount > 0 ? '+' : '−'}${money(Math.abs(amount))}`;
}

function DistanceThreshold({ distance, costPerKm }: { distance: number | null; costPerKm: number }) {
  if (costPerKm === 0) return <>El coste por kilómetro es cero. El desplazamiento no cambia el resultado.</>;
  if (distance === null) return <>La distancia de equilibrio excede el rango de cálculo.</>;
  if (distance < 0) return <>Para empatar, el trayecto de ida de B debe ser <strong>{decimal(-distance, 2)} km</strong> más corto que el de A.</>;
  if (distance === 0) return <>Con los mismos kilómetros adicionales, las dos opciones empatan.</>;
  return <>B puede sumar hasta <strong>{decimal(distance, 2)} km de ida</strong> respecto a A. En ese límite, las dos opciones empatan.</>;
}

function LitersThreshold({ threshold }: { threshold: NonNullable<Thresholds['liters']> }) {
  const { winningRange, canTie } = threshold;
  if (!winningRange) return canTie
    ? <>B puede empatar con A. Con estos datos, ningún volumen hace que B sea más económica.</>
    : <>Ningún volumen compensa el desplazamiento con estos precios y esta promoción.</>;
  const { min, max } = winningRange;
  if (min === 0 && max === null) return <>B ahorra con cualquier cantidad positiva de litros.</>;
  if (min === 0) return <>B ahorra por debajo de <strong>{decimal(max!, 2)} L</strong>. En ese límite, las dos opciones empatan.</>;
  if (max === null) return <>B alcanza el empate con <strong>{decimal(min, 2)} L</strong>. Por encima de ese volumen, B ahorra.</>;
  return <>B ahorra entre <strong>{decimal(min, 2)} L</strong> y <strong>{decimal(max, 2)} L</strong>. En los extremos, las dos opciones empatan.</>;
}

function CashbackThreshold({ threshold }: { threshold: Thresholds['cashback'] }) {
  if (threshold.kind === 'not-needed') return <>B ya resulta más económica sin cashback.</>;
  if (threshold.kind === 'unreachable') return <>La promoción no permite compensar la diferencia. Harían falta <strong>{money(threshold.total)}</strong> de cashback total.</>;
  if (threshold.total === 0) return threshold.onlyTie
    ? <>B empata sin cashback. Los límites de la promoción impiden mejorar el resultado.</>
    : <>B empata sin cashback. Una devolución positiva la hace más económica.</>;
  return <>Para empatar, B necesita <strong>{money(threshold.total)}</strong> de cashback total, equivalente a <strong>{decimal(threshold.perLiter)} €/L</strong> bonificado.
    {' '}{threshold.onlyTie ? 'La promoción permite como máximo el empate.' : 'Con una devolución mayor, B ahorra.'}</>;
}

export function ComparisonInsights({ result }: { result: Result }) {
  const { travel, thresholds, winner, difference, priceSavings, cashbackTotal, refuelSavings, travelDifference, savingsPercent } = result;
  if (!thresholds) return null;
  return <>
    <section className="savings-breakdown" aria-labelledby="savings-title">
      <h3 id="savings-title">Desglose del ahorro</h3>
      <p className="field-hint">Opción B frente a A. Los importes negativos favorecen a A.</p>
      <dl>
        <div><dt>Ahorro por precio del combustible</dt><dd>{signedMoney(priceSavings)}</dd></div>
        <div><dt>Ahorro mediante cashback</dt><dd>{signedMoney(cashbackTotal)}</dd></div>
        {travel && <div><dt>Ahorro antes del desplazamiento</dt><dd>{signedMoney(refuelSavings)}</dd></div>}
        <div><dt>Diferencia de coste entre desplazamientos</dt><dd>{signedMoney(-travelDifference)}</dd></div>
        <div className="net-savings"><dt>Ahorro neto de B frente a A</dt><dd>{signedMoney(winner === 'tie' ? 0 : difference)}</dd></div>
        <div><dt>Ahorro respecto a la alternativa más cara</dt><dd>{decimal(savingsPercent, 2)} %</dd></div>
      </dl>
    </section>
    <section className="break-even" aria-labelledby="travel-thresholds-title">
      <Icon name="info" size={18}/>
      <div>
        <h3 id="travel-thresholds-title">{travel ? '¿Hasta dónde compensa desplazarse?' : '¿Con qué cashback compensa?'}</h3>
        <dl className="comparison-thresholds">
          {travel && thresholds.liters && <>
            <div><dt>Distancia adicional máxima rentable</dt><dd><DistanceThreshold distance={thresholds.extraDistance} costPerKm={travel.costPerKm}/></dd></div>
            <div><dt>Litros para compensar el desplazamiento</dt><dd><LitersThreshold threshold={thresholds.liters}/></dd></div>
          </>}
          <div><dt>Cashback mínimo necesario</dt><dd><CashbackThreshold threshold={thresholds.cashback}/></dd></div>
        </dl>
      </div>
    </section>
  </>;
}
