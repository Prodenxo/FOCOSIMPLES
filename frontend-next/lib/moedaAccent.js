const MOEDA_ACCENTS = {
  USD: '#22c55e',
  EUR: '#3b82f6',
  GBP: '#8b5cf6',
  JPY: '#f43f5e',
  ARS: '#0ea5e9',
  CAD: '#ef4444',
  CHF: '#f59e0b',
  AUD: '#14b8a6',
  CNY: '#dc2626',
  MXN: '#10b981',
  BRL: '#1d4ed8',
  AED: '#059669',
  HKD: '#6366f1',
  KWD: '#0d9488',
};

export function getMoedaAccent(code, fallback = '#00856A') {
  return MOEDA_ACCENTS[String(code || '').toUpperCase()] ?? fallback;
}

export function getMoedaSymbol(code) {
  const c = String(code || '').toUpperCase();
  const symbols = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', BRL: 'R$', ARS: '$',
    CAD: 'C$', CHF: 'Fr', AUD: 'A$', CNY: '¥', MXN: '$',
  };
  return symbols[c] ?? c;
}
