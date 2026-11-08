import { describe, expect, it } from 'vitest';
import { capturePayPalOrder, centsToCurrencyString, currencyStringToCents } from './service';

describe('PayPal currency formatting helpers', () => {
  it('converts integer cents to currency string with two decimals (AC-1, AC-4)', () => {
    expect(centsToCurrencyString(1500)).toBe('15.00');
    expect(centsToCurrencyString(1000)).toBe('10.00');
    expect(centsToCurrencyString(99)).toBe('0.99');
    expect(centsToCurrencyString(5)).toBe('0.05');
    expect(centsToCurrencyString(0)).toBe('0.00');
    expect(centsToCurrencyString(250000)).toBe('2500.00');
  });

  it('converts currency strings to integer cents without floating point errors', () => {
    expect(currencyStringToCents('15.00')).toBe(1500);
    expect(currencyStringToCents('10')).toBe(1000);
    expect(currencyStringToCents('0.99')).toBe(99);
    expect(currencyStringToCents('25.50')).toBe(2550);
    expect(currencyStringToCents('invalid')).toBe(0);
  });

  it('captures simulated orders using the specified expected amount', async () => {
    const result = await capturePayPalOrder('SIMULATED-ORDER-TEST', 2500);
    expect(result.status).toBe('COMPLETED');
    expect(result.capturedAmountCents).toBe(2500);
    expect(result.captureId).toMatch(/^SIMULATED-CAPTURE-/);
  });
});
