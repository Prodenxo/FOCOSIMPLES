/** Pacotes MEI públicos (self-serve + admin Stripe). */
export const MEI_SLOT_PACKAGE_OPTIONS = [5, 20, 50, 100];

/** Tabela comercial FocoMEI — planos por quantidade de CNPJs MEI. */
export const MEI_PUBLIC_PACKAGES = [
  { meiSlots: 5, total: 100, unit: 20, featured: false, label: '5 CNPJs MEI' },
  { meiSlots: 20, total: 300, unit: 15, featured: false, label: '20 CNPJs MEI' },
  { meiSlots: 50, total: 600, unit: 12, featured: false, label: '50 CNPJs MEI' },
  {
    meiSlots: 100,
    total: 1000,
    unit: 10,
    featured: true,
    label: '100 CNPJs MEI',
    badge: 'MELHOR CUSTO-BENEFÍCIO',
  },
];

const validateMeiSlots = (meiSlots) =>
  Number.isInteger(meiSlots) && MEI_SLOT_PACKAGE_OPTIONS.includes(meiSlots);

/**
 * 5 → R$ 100 · 20 → R$ 300 · 50 → R$ 600 · 100 → R$ 1.000 (/mês)
 */
export const resolveMeiPricing = (meiSlots) => {
  if (!validateMeiSlots(meiSlots)) {
    return null;
  }

  const pack = MEI_PUBLIC_PACKAGES.find((p) => p.meiSlots === meiSlots);
  if (!pack) return null;

  return {
    total: pack.total,
    unit: pack.unit,
    tier: `fixed_${meiSlots}`,
  };
};

export const MEI_PRICING_INVALID_MESSAGE =
  'Pacote inválido: escolha 5 (R$ 100), 20 (R$ 300), 50 (R$ 600) ou 100 (R$ 1.000) CNPJs MEI /mês';
