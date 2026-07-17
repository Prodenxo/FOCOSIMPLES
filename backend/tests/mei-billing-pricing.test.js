import { describe, expect, it } from 'vitest';
import {
  resolveMeiPricing,
  MEI_SLOT_PACKAGE_OPTIONS,
  MEI_PUBLIC_PACKAGES,
} from '../src/services/mei-billing-pricing.js';

describe('mei-billing-pricing', () => {
  it('lista pacotes 5, 20, 50 e 100', () => {
    expect(MEI_SLOT_PACKAGE_OPTIONS).toEqual([5, 20, 50, 100]);
    expect(MEI_PUBLIC_PACKAGES).toHaveLength(4);
  });

  it('pacote 5: R$ 100/mês', () => {
    expect(resolveMeiPricing(5)).toEqual({ total: 100, unit: 20, tier: 'fixed_5' });
  });

  it('pacote 20: R$ 300/mês', () => {
    expect(resolveMeiPricing(20)).toEqual({ total: 300, unit: 15, tier: 'fixed_20' });
  });

  it('pacote 50: R$ 600/mês', () => {
    expect(resolveMeiPricing(50)).toEqual({ total: 600, unit: 12, tier: 'fixed_50' });
  });

  it('pacote 100: R$ 1.000/mês', () => {
    expect(resolveMeiPricing(100)).toEqual({ total: 1000, unit: 10, tier: 'fixed_100' });
  });

  it('rejeita pacotes fora da tabela', () => {
    expect(resolveMeiPricing(0)).toBeNull();
    expect(resolveMeiPricing(1)).toBeNull();
    expect(resolveMeiPricing(19)).toBeNull();
    expect(resolveMeiPricing(21)).toBeNull();
  });
});
