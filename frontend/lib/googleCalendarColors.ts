/**
 * Paleta oficial de cores de eventos do Google Calendar (colorId 1–11).
 * @see https://developers.google.com/calendar/api/v3/reference/colors
 */
export type GoogleCalendarColorOption = {
  id: string;
  name: string;
  hex: string;
  light: string;
};

export const GOOGLE_CALENDAR_COLORS: GoogleCalendarColorOption[] = [
  { id: '1', name: 'Lavanda', hex: '#7986CB', light: '#A4BDFC' },
  { id: '2', name: 'Sálvia', hex: '#33B679', light: '#7AE7BF' },
  { id: '3', name: 'Uva', hex: '#8E24AA', light: '#DBADFF' },
  { id: '4', name: 'Flamingo', hex: '#E67C73', light: '#FF887C' },
  { id: '5', name: 'Banana', hex: '#F6BF26', light: '#FBD75B' },
  { id: '6', name: 'Tangerina', hex: '#F4511E', light: '#FFB878' },
  { id: '7', name: 'Pavão', hex: '#039BE5', light: '#46D6DB' },
  { id: '8', name: 'Grafite', hex: '#616161', light: '#E1E1E1' },
  { id: '9', name: 'Mirtilo', hex: '#3F51B5', light: '#5484ED' },
  { id: '10', name: 'Manjericão', hex: '#0B8043', light: '#51B749' },
  { id: '11', name: 'Tomate', hex: '#D50000', light: '#DC2127' },
];

const COLOR_BY_ID = new Map(GOOGLE_CALENDAR_COLORS.map((c) => [c.id, c]));

export function getGoogleEventColorHex(colorId?: string | null, fallback = '#2563EB'): string {
  if (!colorId) return fallback;
  return COLOR_BY_ID.get(String(colorId))?.hex ?? fallback;
}

export function getGoogleEventColorLight(colorId?: string | null, fallback = '#DBEAFE'): string {
  if (!colorId) return fallback;
  return COLOR_BY_ID.get(String(colorId))?.light ?? fallback;
}
