import { formatBrl } from './format';

export function parseNumberBR(value) {
  if (!value || String(value).trim() === '') return NaN;
  const cleaned = String(value).trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

export function getMoedaFractionDigits(moeda) {
  const code = String(moeda || 'USD').toUpperCase();
  try {
    const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code });
    return fmt.resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoedaValorAmount(value, moeda) {
  const code = String(moeda || 'USD').toUpperCase();
  const n = Number(value) || 0;
  try {
    const parts = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
    }).formatToParts(n);
    return parts
      .filter((p) => p.type !== 'currency')
      .map((p) => p.value)
      .join('')
      .trim();
  } catch {
    const digits = getMoedaFractionDigits(code);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
}

export function formatMoedaValorInput(text, fractionDigits = 2) {
  const digits = String(text || '').replace(/\D/g, '');
  if (!digits) return '';
  const divisor = 10 ** fractionDigits;
  const num = parseInt(digits, 10) / divisor;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function parseMoedaValorInput(text) {
  return parseNumberBR(text);
}

export function formatMoedaValorForInput(value, moeda) {
  if (!Number.isFinite(value) || value < 0) return '';
  const digits = getMoedaFractionDigits(moeda);
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatRateToBrl(moeda, rate) {
  if (rate == null || !Number.isFinite(rate)) return null;
  return `1 ${String(moeda).toUpperCase()} ≈ ${formatBrl(rate)}`;
}

export { formatBrl };
