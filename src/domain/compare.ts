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

export function comparePrices(p1: number, p2: number, liters: number, cashback: number) {
  if (![p1, p2, liters, cashback].every(Number.isFinite) || p1 <= 0 || p2 <= 0 || liters <= 0 || cashback < 0) throw new Error('Introduce litros y precios positivos y un cashback no negativo.');
  if (cashback > p2) throw new Error('El cashback supera el precio del combustible. Revisa las condiciones de la promoción; no calculamos un coste negativo.');
  const nearbyTotal = p1 * liters;
  const brandOriginal = p2 * liters;
  const cashbackTotal = cashback * liters;
  const effectivePrice = p2 - cashback;
  const brandTotal = brandOriginal - cashbackTotal;
  if (![nearbyTotal, brandOriginal, cashbackTotal, brandTotal].every(Number.isFinite)) throw new Error('Los importes exceden el rango de cálculo. Reduce los litros o revisa los precios.');
  const difference = nearbyTotal - brandTotal;
  // Solo tolerancia de coma flotante; no redondeamos precios ni importes intermedios.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(nearbyTotal), Math.abs(brandTotal)) * 8;
  const winner = Math.abs(difference) <= tolerance ? 'tie' : difference > 0 ? 'brand' : 'nearby';
  return { nearbyTotal, brandOriginal, cashbackTotal, effectivePrice, brandTotal, difference, winner, breakEven: p2 - p1 } as const;
}
