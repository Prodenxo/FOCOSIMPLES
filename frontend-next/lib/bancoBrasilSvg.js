import { svgBanco } from '@edusites/bancos-brasil/core';

export function renderBancoSvg(options) {
  if (typeof window === 'undefined') return null;
  try {
    return svgBanco(options);
  } catch {
    return null;
  }
}
