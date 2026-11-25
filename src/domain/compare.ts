import type { CashbackUnit } from '../types';

export function cashbackInEuros(value: number, unit: CashbackUnit): number {
  return unit === 'cent' ? value / 100 : value;
}

// Desplaza la coma en el texto del campo, sin artefactos como 0.29 * 100.
export function convertCashbackInput(value: string, from: CashbackUnit, to: CashbackUnit): string {
  if (from === to || !value.trim() || !Number.isFinite(Number(value))) return value;
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value.trim());
  if (!match) return value;
  if (Number(value) === 0) return '0';
  const [, sign, integer, fraction = '', exponent = '0'] = match;
  const digits = integer + fraction;
  const point = integer.length + Number(exponent) + (to === 'cent' ? 2 : -2);
  const shifted = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const normalized = shifted.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return `${sign === '-' ? '-' : ''}${normalized}`;
}

export interface TravelCosts {
  consumption: number;
  fuelPrice: number;
  nearbyDistance: number;
  brandDistance: number;
  includeReturn: boolean;
}

interface ComparisonOptions {
  maxCashback?: number;
  maxBonusLiters?: number;
  travel?: TravelCosts;
}

function nonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function checkAmounts(...values: number[]) {
  if (!values.every(Number.isFinite)) throw new Error('Los importes exceden el rango de cálculo. Reduce los valores introducidos.');
}

function sign(value: number, ...reference: number[]) {
  const tolerance = Number.EPSILON * Math.max(1, ...reference.map(Math.abs)) * 8;
  return Math.abs(value) <= tolerance ? 0 : Math.sign(value);
}

function travelCost(distance: number, multiplier: number, consumption: number, fuelPrice: number) {
  const totalDistance = distance * multiplier;
  const fuel = (totalDistance * consumption) / 100;
  const cost = fuel * fuelPrice;
  checkAmounts(totalDistance, fuel, cost);
  return { totalDistance, fuel, cost };
}

function calculateTravel(travel: TravelCosts) {
  const { consumption, fuelPrice, nearbyDistance, brandDistance, includeReturn } = travel;
  if (![consumption, fuelPrice, nearbyDistance, brandDistance].every(nonNegative)) {
    throw new Error('Introduce distancias, consumo y precio de desplazamiento iguales o mayores que cero.');
  }
  const multiplier = includeReturn ? 2 : 1;
  const costPerKm = (consumption / 100) * fuelPrice;
  checkAmounts(costPerKm);
  return {
    nearby: travelCost(nearbyDistance, multiplier, consumption, fuelPrice),
    brand: travelCost(brandDistance, multiplier, consumption, fuelPrice),
    costPerKm,
    multiplier,
  };
}

// B ahorra cuando la diferencia de costes es positiva. A partir del primer
// límite alcanzado, el cashback queda fijo y cambia la pendiente.
function litersForSavings(priceDifference: number, cashback: number, travelDifference: number, maxBonusLiters: number, maxCashback: number, prices: number[]) {
  const cap = cashback === 0 ? 0 : Math.min(maxBonusLiters, maxCashback / cashback);
  const initialSlope = priceDifference + cashback;
  const segments = [];
  if (cap > 0) segments.push({ start: 0, end: cap, slope: initialSlope, gainAtStart: -travelDifference });
  if (Number.isFinite(cap)) {
    const gainAtCap = initialSlope * cap;
    segments.push({ start: cap, end: Infinity, slope: priceDifference, gainAtStart: gainAtCap - travelDifference });
  }

  let firstWinning = Infinity;
  let lastWinning = 0;
  let canTie = false;
  for (const { start, end, slope, gainAtStart } of segments) {
    const direction = sign(slope, ...prices, cashback);
    const initialGain = sign(gainAtStart, travelDifference) === 0 ? 0 : gainAtStart;
    let min = start;
    let max = end;
    if (direction === 0) {
      if (initialGain === 0) canTie = true;
      if (initialGain <= 0) continue;
    } else {
      const crossesAtEnd = Number.isFinite(end)
        && sign(gainAtStart + slope * (end - start), gainAtStart, travelDifference) === 0;
      const crossing = crossesAtEnd ? end : start - initialGain / slope;
      if (Number.isFinite(crossing) && crossing > 0 && crossing >= start && crossing <= end) canTie = true;
      if (direction > 0) min = Math.max(start, crossing);
      else max = Math.min(end, crossing);
    }
    if (max > min) {
      firstWinning = Math.min(firstWinning, min);
      lastWinning = max;
    }
  }
  const winningRange = Number.isFinite(firstWinning)
    ? { min: firstWinning, max: Number.isFinite(lastWinning) ? lastWinning : null }
    : null;
  return { winningRange, canTie };
}

function requiredCashback(total: number, eligibleLiters: number, maxCashback: number, brandPrice: number, costScale: number) {
  const required = sign(total, costScale);
  if (required < 0) return { kind: 'not-needed' } as const;
  const maximum = Math.min(maxCashback, eligibleLiters * brandPrice);
  const remaining = sign(maximum - total, maximum, costScale);
  if (required > 0 && remaining < 0) return { kind: 'unreachable', total } as const;
  return {
    kind: 'threshold',
    total: required === 0 ? 0 : total,
    perLiter: required === 0 ? 0 : total / eligibleLiters,
    onlyTie: remaining <= 0,
  } as const;
}

export function comparePrices(p1: number, p2: number, liters: number, cashback: number, options: ComparisonOptions = {}) {
  if (![p1, p2, liters, cashback].every(Number.isFinite) || p1 <= 0 || p2 <= 0 || liters <= 0 || cashback < 0) throw new Error('Introduce litros y precios positivos y un cashback no negativo.');
  if (cashback > p2) throw new Error('El cashback supera el precio del combustible. Revisa las condiciones de la promoción; no calculamos un coste negativo.');
  if ([options.maxCashback, options.maxBonusLiters].some(limit => limit !== undefined && !nonNegative(limit))) {
    throw new Error('Introduce límites de promoción iguales o mayores que cero.');
  }
  const { maxCashback = Infinity, maxBonusLiters = Infinity } = options;
  const limited = options.maxCashback !== undefined || options.maxBonusLiters !== undefined;
  const nearbyTotal = p1 * liters;
  const brandOriginal = p2 * liters;
  const eligibleLiters = Math.min(liters, maxBonusLiters);
  const cashbackTotal = Math.min(eligibleLiters * cashback, maxCashback);
  const brandTotal = brandOriginal - cashbackTotal;
  const effectivePrice = limited ? brandTotal / liters : p2 - cashback;
  const travel = options.travel ? calculateTravel(options.travel) : undefined;
  const nearbyReal = nearbyTotal + (travel?.nearby.cost ?? 0);
  const brandReal = brandTotal + (travel?.brand.cost ?? 0);
  checkAmounts(nearbyTotal, brandOriginal, cashbackTotal, brandTotal, effectivePrice, nearbyReal, brandReal);
  const refuelSavings = nearbyTotal - brandTotal;
  const priceSavings = nearbyTotal - brandOriginal;
  const travelDifference = (travel?.brand.cost ?? 0) - (travel?.nearby.cost ?? 0);
  const difference = nearbyReal - brandReal;
  const costScale = Math.max(nearbyReal, brandReal, brandOriginal);
  // Solo tolerancia de coma flotante. Los importes conservan su precisión.
  const winningSign = sign(difference, nearbyReal, brandReal);
  const winner = winningSign === 0 ? 'tie' : winningSign > 0 ? 'brand' : 'nearby';
  const savingsPercent = winner === 'tie' ? 0 : Math.abs(difference) / Math.max(nearbyReal, brandReal) * 100;

  const cashbackNeeded = travelDifference - priceSavings;
  checkAmounts(cashbackNeeded);
  const distanceSavings = sign(refuelSavings, nearbyTotal, brandTotal) === 0 ? 0 : refuelSavings;
  const extraDistance = travel?.costPerKm ? (distanceSavings / travel.costPerKm) / travel.multiplier : null;
  const thresholds = travel || limited ? {
    cashback: requiredCashback(cashbackNeeded, eligibleLiters, maxCashback, p2, costScale),
    liters: travel ? litersForSavings(p1 - p2, cashback, travelDifference, maxBonusLiters, maxCashback, [p1, p2]) : null,
    extraDistance: extraDistance !== null && Number.isFinite(extraDistance) ? extraDistance : null,
  } : null;
  return {
    nearbyTotal, brandOriginal, cashbackTotal, effectivePrice, brandTotal,
    nearbyReal, brandReal, travel, refuelSavings, priceSavings, travelDifference,
    difference, winner, savingsPercent, thresholds, breakEven: p2 - p1,
  } as const;
}
