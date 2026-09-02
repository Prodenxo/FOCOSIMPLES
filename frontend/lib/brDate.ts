/** Formata ISO (YYYY-MM-DD) para exibição dd/mm/aaaa. */
export function formatBRDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Converte dd/mm/aaaa para ISO; string vazia se inválido. */
export function parseBRDateToIso(br: string): string {
  if (!br || br.length < 10) return '';
  const cleaned = br.replace(/[^\d/]/g, '');
  const parts = cleaned.split('/');
  if (parts.length !== 3 || String(parts[2]).length !== 4) return '';
  const day = String(parts[0]).padStart(2, '0');
  const month = String(parts[1]).padStart(2, '0');
  const year = String(parts[2]);
  const iso = `${year}-${month}-${day}`;
  const dt = new Date(`${iso}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? '' : iso;
}

export function formatPartialBrDateInput(raw: string): string {
  const digits = String(raw).replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function countDigitsBeforeDisplayIndex(str: string, displayIndex: number): number {
  const lim = Math.min(Math.max(0, displayIndex), str.length);
  let n = 0;
  for (let i = 0; i < lim; i++) {
    if (/\d/.test(str[i])) n++;
  }
  return n;
}

function displayCaretAfterNDigits(str: string, nDigits: number): number {
  if (nDigits <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      seen++;
      if (seen === nDigits) return i + 1;
    }
  }
  return str.length;
}

export function computeBrDateInputUpdate(
  prevDisplay: string,
  nativeText: string,
  caretStart: number,
): { formatted: string; caret: number } {
  const formatted = formatPartialBrDateInput(nativeText);
  const prevDigits = prevDisplay.replace(/\D/g, '').length;
  const newDigits = formatted.replace(/\D/g, '').length;
  const digitsBeforeCaret = countDigitsBeforeDisplayIndex(prevDisplay, caretStart);

  let caretDigitIndex = digitsBeforeCaret;
  if (newDigits < prevDigits) {
    caretDigitIndex = Math.max(0, digitsBeforeCaret - 1);
  } else if (newDigits > prevDigits) {
    caretDigitIndex = Math.min(digitsBeforeCaret + 1, newDigits);
  } else {
    caretDigitIndex = Math.min(digitsBeforeCaret, newDigits);
  }

  const caret = displayCaretAfterNDigits(formatted, caretDigitIndex);
  return { formatted, caret };
}

export function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}
