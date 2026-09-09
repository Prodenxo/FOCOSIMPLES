const HTML_ENTITY_MAP = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Converte descrições do Google Calendar (HTML simples) em texto legível. */
export function plainTextFromEventDescription(raw) {
  if (!raw) return '';
  let text = String(raw);

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  text = text.replace(/<\/?p[^>]*>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/?ul[^>]*>/gi, '\n');
  text = text.replace(/<\/?ol[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&([a-zA-Z#0-9]+);/g, (match, entity) => {
    if (HTML_ENTITY_MAP[match]) return HTML_ENTITY_MAP[match];
    if (entity.startsWith('#x')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });

  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
