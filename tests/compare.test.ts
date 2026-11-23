import { describe, expect, it } from 'vitest';
import { cashbackInEuros, comparePrices, convertCashbackInput } from '../src/domain/compare';

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
