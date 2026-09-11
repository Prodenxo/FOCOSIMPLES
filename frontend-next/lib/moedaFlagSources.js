const CIRCLE_FLAG_SLUG = { eu: 'european_union' };
const FLAG_RASTER_FALLBACK = { eu: 'https://flagcdn.com/w80/eu.png' };

export function getMoedaCircleFlagSvgUrl(countryIso) {
  const code = countryIso.trim().toLowerCase();
  const slug = CIRCLE_FLAG_SLUG[code] ?? code;
  return `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${slug}.svg`;
}

export function getMoedaFlagPngUrl(countryIso, size = 40) {
  const code = countryIso.trim().toLowerCase();
  const fallback = FLAG_RASTER_FALLBACK[code];
  if (fallback) return fallback;
  const w = Math.max(20, Math.min(160, Math.round(size * 2)));
  return `https://flagcdn.com/w${w}/${code}.png`;
}

export function getMoedaFlagUrls(moeda, countryIso, size = 40) {
  if (!countryIso) return [];
  return [getMoedaCircleFlagSvgUrl(countryIso), getMoedaFlagPngUrl(countryIso, size)];
}
