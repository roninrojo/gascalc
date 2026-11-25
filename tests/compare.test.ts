import { describe, expect, it } from 'vitest';
import { cashbackInEuros, comparePrices, convertCashbackInput, type TravelCosts } from '../src/domain/compare';

describe('comparador de cashback', () => {
  it('reproduce el ejemplo: Repsol ahorra 4,30 € para 50 litros', () => {
    const result = comparePrices(1.621, 1.835, 50, .30);
    expect(result.nearbyTotal).toBeCloseTo(81.05, 10);
    expect(result.brandOriginal).toBeCloseTo(91.75, 10);
    expect(result.cashbackTotal).toBeCloseTo(15, 10);
    expect(result.brandTotal).toBeCloseTo(76.75, 10);
    expect(result.effectivePrice).toBeCloseTo(1.535, 10);
    expect(result.difference).toBeCloseTo(4.30, 10);
    expect(result.breakEven).toBeCloseTo(.214, 10);
    expect(result.winner).toBe('brand');
  });
  it('convierte céntimos sin alterar euros', () => {
    expect(cashbackInEuros(30, 'cent')).toBe(.3);
    expect(cashbackInEuros(.3, 'eur')).toBe(.3);
    expect(cashbackInEuros(2.5, 'cent')).toBe(.025);
  });
  it('convierte el texto de entrada sin artefactos ni pérdida de precisión decimal', () => {
    expect(convertCashbackInput('0.29', 'eur', 'cent')).toBe('29');
    expect(convertCashbackInput('29', 'cent', 'eur')).toBe('0.29');
    expect(convertCashbackInput('1.23456789', 'cent', 'eur')).toBe('0.0123456789');
    expect(convertCashbackInput('1e-7', 'eur', 'cent')).toBe('0.00001');
    expect(convertCashbackInput('', 'eur', 'cent')).toBe('');
  });
  it('gana la cercana con cashback insuficiente', () => expect(comparePrices(1.5, 1.8, 50, .1).winner).toBe('nearby'));
  it('reconoce empate sin errores de coma flotante', () => expect(comparePrices(1.6, 1.8, 50, .2).winner).toBe('tie'));
  it('la marca puede ser más barata sin cashback', () => {
    const r = comparePrices(1.8, 1.6, 50, 0);
    expect(r.winner).toBe('brand'); expect(r.breakEven).toBeCloseTo(-.2);
  });
  it('los litros cambian el ahorro pero no el ganador', () => {
    const a = comparePrices(1.621, 1.835, 1, .3), b = comparePrices(1.621, 1.835, 100, .3);
    expect(a.winner).toBe(b.winner); expect(b.difference).toBeCloseTo(a.difference * 100, 10);
  });
  it('no redondea valores intermedios ni empata diferencias reales pequeñas', () => {
    const r = comparePrices(1.60001, 1.8, .1, .2);
    expect(r.winner).toBe('brand'); expect(r.nearbyTotal).toBe(1.60001 * .1);
  });
  it('admite cashback igual al precio pero bloquea costes negativos', () => {
    expect(comparePrices(1.6, 1.8, 10, 1.8).brandTotal).toBe(0);
    expect(() => comparePrices(1.6, 1.8, 10, 2)).toThrow('supera');
  });
  it.each([0, -1, NaN, Infinity])('rechaza litros no válidos: %s', n => expect(() => comparePrices(1.6, 1.8, n, 0)).toThrow());
  it('rechaza precio y cashback inválidos', () => {
    expect(() => comparePrices(0, 1.8, 50, 0)).toThrow();
    expect(() => comparePrices(1.6, 1.8, 50, -.1)).toThrow();
    expect(() => comparePrices(1.6, Infinity, 50, 0)).toThrow();
  });
  it('rechaza desbordamientos aunque los operandos sean finitos', () => expect(() => comparePrices(1.6, 1.8, Number.MAX_VALUE, 0)).toThrow('rango'));
});

describe('coste real y límites promocionales', () => {
  const travel: TravelCosts = {
    consumption: 6, fuelPrice: 1.5, nearbyDistance: 0, brandDistance: 10, includeReturn: true,
  };
  const tenCentsPerKm: TravelCosts = { ...travel, consumption: 10, fuelPrice: 1, includeReturn: false };

  it('reproduce todos los importes y los puntos de equilibrio del caso de referencia', () => {
    const result = comparePrices(1.621, 1.835, 50, .30, { travel });
    expect(result).toMatchObject({ nearbyTotal: 81.05, brandOriginal: 91.75, cashbackTotal: 15, brandTotal: 76.75, winner: 'brand' });
    expect(result.travel?.nearby).toEqual({ totalDistance: 0, fuel: 0, cost: 0 });
    expect(result.travel?.brand).toMatchObject({ totalDistance: 20, fuel: 1.2 });
    expect(result.travel?.brand.cost).toBeCloseTo(1.8, 12);
    expect(result.nearbyReal).toBeCloseTo(81.05, 12);
    expect(result.brandReal).toBeCloseTo(78.55, 12);
    expect(result.priceSavings).toBeCloseTo(-10.70, 12);
    expect(result.refuelSavings).toBeCloseTo(4.30, 12);
    expect(result.difference).toBeCloseTo(2.50, 12);
    expect(result.savingsPercent).toBeCloseTo(2.50 / 81.05 * 100, 12);
    expect(result.thresholds?.extraDistance).toBeCloseTo(23.888889, 6);
    expect(result.thresholds?.liters?.winningRange?.min).toBeCloseTo(20.930233, 6);
    expect(result.thresholds?.liters?.winningRange?.max).toBeNull();
    const threshold = result.thresholds?.cashback;
    expect(threshold?.kind).toBe('threshold');
    if (threshold?.kind !== 'threshold') throw new Error('Falta el umbral esperado');
    expect(threshold.total).toBeCloseTo(12.50, 12);
    expect(threshold.perLiter).toBeCloseTo(.25, 12);
  });

  it('utiliza el mismo precio para ambas alternativas y respeta el trayecto de solo ida', () => {
    const result = comparePrices(1.621, 1.835, 50, .30, { travel: { ...travel, nearbyDistance: 5, includeReturn: false } });
    expect(result.travel?.nearby.cost).toBeCloseTo(.45, 12);
    expect(result.travel?.brand.cost).toBeCloseTo(.9, 12);
    expect(result.travelDifference).toBeCloseTo(.45, 12);
    expect(result.thresholds?.extraDistance).toBeCloseTo(47.777778, 6);
  });

  it('detecta el empate real y el cambio de ganador aunque B tenga un precio efectivo inferior', () => {
    const equal = comparePrices(1.6, 1.8, 50, .3, { travel: { ...tenCentsPerKm, brandDistance: 50 } });
    expect(equal.winner).toBe('tie');
    expect(equal.savingsPercent).toBe(0);
    const farther = comparePrices(1.6, 1.8, 50, .3, { travel: { ...tenCentsPerKm, brandDistance: 70 } });
    expect(farther.effectivePrice).toBeLessThan(1.6);
    expect(farther.winner).toBe('nearby');
  });

  it.each([
    [{ maxCashback: 10 }, 10],
    [{ maxBonusLiters: 30 }, 9],
    [{ maxCashback: 7, maxBonusLiters: 30 }, 7],
    [{ maxCashback: 12, maxBonusLiters: 30 }, 9],
    [{ maxCashback: 0 }, 0],
    [{ maxBonusLiters: 0 }, 0],
  ])('limita la devolución (%j)', (options, reward) => {
    const result = comparePrices(1.621, 1.835, 50, .30, options);
    expect(result.cashbackTotal).toBeCloseTo(reward, 12);
    expect(result.effectivePrice).toBeCloseTo((91.75 - reward) / 50, 12);
  });

  it.each([{ maxBonusLiters: 20, maxCashback: 10 }, { maxBonusLiters: 30, maxCashback: 6 }])(
    'encuentra los dos puntos de equilibrio con límites (%j)', options => {
      const { winningRange } = comparePrices(1.6, 1.8, 15, .3, { ...options, travel: tenCentsPerKm }).thresholds!.liters!;
      expect(winningRange?.min).toBeCloseTo(10, 12);
      expect(winningRange?.max).toBeCloseTo(25, 12);
      expect(comparePrices(1.6, 1.8, 30, .3, { ...options, travel: tenCentsPerKm }).winner).toBe('nearby');
    },
  );

  it('distingue una promoción siempre insuficiente de una que solo alcanza el empate en el límite', () => {
    const options = { maxBonusLiters: 20, travel: { ...tenCentsPerKm, brandDistance: 20 } };
    const tie = comparePrices(1.6, 1.8, 20, .3, options);
    expect(tie.winner).toBe('tie');
    expect(tie.thresholds?.liters).toEqual({ winningRange: null, canTie: true });
    expect(tie.thresholds?.cashback.kind).toBe('threshold');
    const insufficient = comparePrices(1.6, 1.8, 20, .3, { ...options, maxCashback: 5 });
    expect(insufficient.thresholds?.liters).toEqual({ winningRange: null, canTie: false });
    expect(insufficient.thresholds?.cashback.kind).toBe('unreachable');
  });

  it('utiliza los litros bonificables para el mínimo y detecta si el tope en euros lo impide', () => {
    const limited = comparePrices(1.621, 1.835, 50, .3, { travel, maxBonusLiters: 40 });
    expect(limited.thresholds?.cashback).toMatchObject({ kind: 'threshold', onlyTie: false });
    const threshold = limited.thresholds?.cashback;
    if (threshold?.kind !== 'threshold') throw new Error('Falta el umbral esperado');
    expect(threshold.perLiter).toBeCloseTo(.3125, 12);
    expect(comparePrices(1.621, 1.835, 50, .3, { travel, maxCashback: 10 }).thresholds?.cashback.kind).toBe('unreachable');
    expect(comparePrices(1.621, 1.835, 50, .3, { travel, maxBonusLiters: 0 }).thresholds?.cashback.kind).toBe('unreachable');
  });

  it('compara sin cashback cuando B gana siempre, gana solo con pocos litros o pierde siempre', () => {
    const sameDistance = { ...travel, brandDistance: 0 };
    const always = comparePrices(1.8, 1.6, 50, 0, { travel: sameDistance });
    expect(always.thresholds?.liters?.winningRange).toEqual({ min: 0, max: null });
    expect(always.thresholds?.cashback.kind).toBe('not-needed');
    const shorter = comparePrices(1.6, 1.8, 2, 0, { travel: { ...tenCentsPerKm, nearbyDistance: 10, brandDistance: 0 } });
    expect(shorter.thresholds?.liters?.winningRange?.min).toBe(0);
    expect(shorter.thresholds?.liters?.winningRange?.max).toBeCloseTo(5, 12);
    expect(shorter.thresholds?.extraDistance).toBeCloseTo(-4, 12);
    const never = comparePrices(1.6, 1.8, 50, 0, { travel });
    expect(never.thresholds?.liters).toEqual({ winningRange: null, canTie: false });
  });

  it('evita divisiones por cero con viajes gratuitos, promociones sin litros y precios iguales', () => {
    const result = comparePrices(1.6, 1.6, 50, .3, { travel: { ...travel, fuelPrice: 0 }, maxBonusLiters: 0 });
    expect(result.travel?.brand.cost).toBe(0);
    expect(result.winner).toBe('tie');
    expect(result.thresholds).toEqual({
      extraDistance: null, liters: { winningRange: null, canTie: true },
      cashback: { kind: 'threshold', total: 0, perLiter: 0, onlyTie: true },
    });
  });

  it('valida límites, trayectos y posibles desbordamientos', () => {
    expect(() => comparePrices(1.6, 1.8, 50, .3, { maxCashback: -1 })).toThrow('límites');
    expect(() => comparePrices(1.6, 1.8, 50, .3, { maxBonusLiters: Infinity })).toThrow('límites');
    expect(() => comparePrices(1.6, 1.8, 50, .3, { travel: { ...travel, consumption: NaN } })).toThrow('desplazamiento');
    expect(() => comparePrices(1.6, 1.8, 50, .3, { travel: { ...travel, brandDistance: -1 } })).toThrow('desplazamiento');
    expect(() => comparePrices(1.6, 1.8, 50, .3, { travel: { ...travel, brandDistance: Number.MAX_VALUE } })).toThrow('rango');
  });
});
